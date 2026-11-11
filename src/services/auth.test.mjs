import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const source = readFileSync(new URL('./auth.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
}).outputText
const { createAuthClient, AuthError, LoanOutcomeUnknown, findNewLoanForEquipment } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const epoch = 1800000000000
const user = { id: 'synthetic-user', email: 'test@example.invalid' }
const tokenData = { access_token: 'synthetic-access', token_type: 'bearer', expires_in: 60, user }
const json = (value, status = 200) => new Response(JSON.stringify(value), { status })
const options = { url: 'https://auth.example.invalid/api', now: () => epoch }
const successfulFetch = async (url) => json(url.endsWith('/me') ? { user } : tokenData)
const clientWith = (fetch, extra = {}) => createAuthClient({ ...options, fetch, ...extra })
const login = (client) => client.login('test@example.invalid', 'synthetic-password')

const equipmentItem = { id: 'equipment-1', nome: 'Notebook sintético', patrimonio: null, categoria: 'Notebook', status: 'DISPONIVEL' }
const loanItem = { id: 'loan-1', retirado_em: '2026-11-10T23:30:00-03:00', previsto_para: '2026-11-24', equipamento: equipmentItem }
const readClient = (respond, extra = {}) => clientWith((url, init) =>
  url.endsWith('/login') || url.endsWith('/me') ? successfulFetch(url) : respond(url, init), extra)
const requestClient = (respond, extra = {}) => clientWith((url, init) =>
  url.endsWith('/login') || url.endsWith('/me') ? successfulFetch(url) : respond(url, init), extra)

describe('Loan requests', () => {
  it('should POST only the equipment id and validate the confirmed response', async () => {
    const calls = []
    const created = {
      ...loanItem,
      id: 'loan-created',
      equipamento: {
        id: equipmentItem.id,
        nome: equipmentItem.nome,
        patrimonio: equipmentItem.patrimonio,
        categoria: equipmentItem.categoria,
      },
    }
    const client = requestClient(async (url, init) => {
      calls.push({ url, init })
      return json({ emprestimo: created }, 201)
    })
    await login(client)
    assert.deepEqual(await client.requestLoan(equipmentItem.id), created)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, 'https://auth.example.invalid/api/emprestimos')
    assert.equal(calls[0].init.method, 'POST')
    assert.equal(calls[0].init.body, JSON.stringify({ equipamento_id: equipmentItem.id }))
    assert.equal(calls[0].init.headers.Authorization, `Bearer ${tokenData.access_token}`)
    assert.equal(calls[0].init.cache, 'no-store')
    assert.equal(calls[0].init.credentials, 'omit')
    assert.equal(calls[0].init.redirect, 'error')
    assert.equal(calls[0].init.referrerPolicy, 'no-referrer')
  })

  for (const [status, reason, message] of [
    [409, 'equipamento_indisponivel', /não está mais disponível/],
    [409, 'limite_emprestimos', /limite de três/],
    [403, 'emprestimo_atrasado', /empréstimo em atraso/],
  ]) {
    it(`should show the safe ${reason} refusal`, async () => {
      const client = requestClient(async () => json({ reason, detail: 'synthetic-private-detail' }, status))
      await login(client)
      await assert.rejects(client.requestLoan(equipmentItem.id), (error) =>
        error instanceof AuthError && message.test(error.message) && !error.message.includes('synthetic'))
    })
  }

  it('should show infrastructure failures without exposing response details', async () => {
    const client = requestClient(async () => json({ detail: 'synthetic-private-detail' }, 503))
    await login(client)
    await assert.rejects(client.requestLoan(equipmentItem.id), (error) =>
      error instanceof AuthError && /infraestrutura/.test(error.message) && !error.message.includes('synthetic'))
  })

  it('should treat a lost response as unknown without retrying the POST', async () => {
    let attempts = 0
    const client = requestClient(async (url) => {
      if (url.endsWith('/emprestimos')) {
        attempts++
        throw new Error('synthetic-network-failure')
      }
      return json({ equipamentos: [] })
    })
    await login(client)
    await assert.rejects(client.requestLoan(equipmentItem.id), LoanOutcomeUnknown)
    assert.equal(attempts, 1)
  })

  it('should treat a timed-out POST as unknown instead of retrying it', async () => {
    let attempts = 0
    const client = requestClient(async (url) => {
      if (url.endsWith('/emprestimos')) {
        attempts++
        return new Promise(() => {})
      }
      return json({ equipamentos: [] })
    }, { timeoutMs: 10 })
    await login(client)
    await assert.rejects(client.requestLoan(equipmentItem.id), LoanOutcomeUnknown)
    assert.equal(attempts, 1)
  })

  it('should treat an invalid success body as unknown instead of reporting success', async () => {
    const client = requestClient(async () => new Response('invalid-json', { status: 201 }))
    await login(client)
    await assert.rejects(client.requestLoan(equipmentItem.id), LoanOutcomeUnknown)
  })

  it('should clear an invalid session after a 401 response', async () => {
    const client = requestClient(async () => json({ detail: 'synthetic-private-detail' }, 401))
    await login(client)
    await assert.rejects(client.requestLoan(equipmentItem.id), /Sessão expirada/)
    assert.equal(client.getSession(), null)
  })

  it('should discard an in-flight POST when logout invalidates its session', async () => {
    let resolveRequest
    const client = requestClient((url) => {
      if (url.endsWith('/logout')) return Promise.resolve(new Response(null, { status: 204 }))
      return new Promise((resolve) => { resolveRequest = resolve })
    })
    await login(client)
    const pending = client.requestLoan(equipmentItem.id)
    await new Promise((done) => setImmediate(done))
    const rejected = assert.rejects(pending, /Sessão expirada/)
    await client.logout()
    await rejected
    resolveRequest(json({ emprestimo: loanItem }, 201))
    assert.equal(client.getSession(), null)
  })

  it('should reconcile only a newly observed loan for the requested equipment', () => {
    const newLoan = { ...loanItem, id: 'loan-new', equipamento: { ...loanItem.equipamento, id: equipmentItem.id } }
    const otherEquipmentLoan = { ...newLoan, id: 'loan-other-item', equipamento: { ...newLoan.equipamento, id: 'equipment-2' } }
    assert.equal(findNewLoanForEquipment(equipmentItem.id, [loanItem], [loanItem]), undefined)
    assert.equal(findNewLoanForEquipment(equipmentItem.id, [loanItem], [loanItem, otherEquipmentLoan]), undefined)
    assert.deepEqual(findNewLoanForEquipment(equipmentItem.id, [loanItem], [loanItem, newLoan]), newLoan)
  })
})

describe('Authenticated equipment and loan reads', () => {
  it('should GET both contracts with a private bearer and safe request settings', async () => {
    const calls = []
    const client = readClient(async (url, init) => {
      calls.push({ url, init })
      return json(url.endsWith('/equipamentos') ? { equipamentos: [equipmentItem] } : { emprestimos: [loanItem] })
    })
    await login(client)
    assert.deepEqual(await client.getEquipment(), [equipmentItem])
    assert.deepEqual(await client.getMyLoans(), [loanItem])
    assert.deepEqual(calls.map(({ url }) => url), ['https://auth.example.invalid/api/equipamentos', 'https://auth.example.invalid/api/emprestimos/meus'])
    for (const { init } of calls) {
      assert.equal(init.method, 'GET')
      assert.equal(init.body, undefined)
      assert.equal(init.headers.Authorization, 'Bearer synthetic-access')
      assert.equal(init.cache, 'no-store')
      assert.equal(init.credentials, 'omit')
      assert.equal(init.redirect, 'error')
      assert.equal(init.referrerPolicy, 'no-referrer')
    }
    assert.equal('access_token' in client.getSession(), false)
  })

  it('should accept empty lists, every status and nullable property numbers', async () => {
    let empty = true
    const client = readClient(async (url) => json(url.endsWith('/equipamentos')
      ? { equipamentos: empty ? [] : ['DISPONIVEL', 'MANUTENCAO', 'EMPRESTADO', 'INATIVO'].map((status) => ({ ...equipmentItem, status })) }
      : { emprestimos: [] }))
    await login(client)
    assert.deepEqual(await client.getEquipment(), [])
    assert.deepEqual(await client.getMyLoans(), [])
    empty = false
    assert.equal((await client.getEquipment()).length, 4)
  })

  for (const [method, payload] of [
    ['getEquipment', null], ['getEquipment', { equipamentos: null }], ['getEquipment', { equipamentos: [{}] }],
    ['getEquipment', { equipamentos: [{ ...equipmentItem, status: 'OTHER' }] }],
    ['getEquipment', { equipamentos: [{ ...equipmentItem, patrimonio: 1 }] }],
    ['getMyLoans', []], ['getMyLoans', { emprestimos: [{}] }],
    ['getMyLoans', { emprestimos: [{ ...loanItem, previsto_para: '2026-02-30' }] }],
    ['getMyLoans', { emprestimos: [{ ...loanItem, previsto_para: '2026-11-24T00:00:00Z' }] }],
    ['getMyLoans', { emprestimos: [{ ...loanItem, retirado_em: '2026-11-10' }] }],
    ['getMyLoans', { emprestimos: [{ ...loanItem, equipamento: null }] }],
  ]) {
    it(`should reject invalid ${method} payload ${JSON.stringify(payload)}`, async () => {
      const client = readClient(async () => json(payload))
      await login(client)
      await assert.rejects(client[method](), /inválida/)
      assert.notEqual(client.getSession(), null)
    })
  }

  it('should sanitize invalid JSON and network failures and allow safe GET retry', async () => {
    let attempts = 0
    const client = readClient(async () => {
      attempts++
      if (attempts === 1) throw new Error('synthetic-private-detail')
      if (attempts === 2) return new Response('synthetic-private-detail')
      return json({ equipamentos: [] })
    })
    await login(client)
    for (let i = 0; i < 2; i++) {
      await assert.rejects(client.getEquipment(), (error) => error instanceof AuthError && !error.message.includes('synthetic'))
    }
    assert.deepEqual(await client.getEquipment(), [])
  })

  for (const status of [403, 429, 503]) {
    it(`should keep the session and hide HTTP ${status} response details`, async () => {
      const client = readClient(async () => ({ ok: false, status, json: () => assert.fail('must not read error body') }))
      await login(client)
      await assert.rejects(client.getMyLoans(), /Consulta indisponível/)
      assert.notEqual(client.getSession(), null)
    })
  }

  it('should clear the session on 401 and notify the UI exactly once', async () => {
    const client = readClient(async () => json({ detail: 'synthetic-private-detail' }, 401))
    await login(client)
    let notifications = 0
    const unsubscribe = client.subscribe(() => { notifications++; assert.equal(client.getSession(), null) })
    await assert.rejects(client.getEquipment(), /Sessão expirada/)
    assert.equal(client.getSession(), null)
    assert.equal(notifications, 1)
    unsubscribe()
    await assert.rejects(client.getMyLoans(), /Sessão expirada/)
  })

  it('should cancel on navigation even when fetch ignores abort and ignore a late 401', async () => {
    let resolve
    let signal
    const client = readClient((url, init) => { signal = init.signal; return new Promise((done) => { resolve = done }) })
    await login(client)
    const controller = new AbortController()
    const pending = client.getEquipment(controller.signal)
    const rejected = assert.rejects(pending, { name: 'AbortError' })
    controller.abort()
    await rejected
    assert.equal(signal.aborted, true)
    resolve(json({}, 401))
    await new Promise((done) => setImmediate(done))
    assert.notEqual(client.getSession(), null)
  })

  it('should cancel in-flight reads before logout and reject stale results after a new login', async () => {
    let resolve
    let signal
    const client = readClient((url, init) => {
      if (url.endsWith('/logout')) return Promise.resolve(new Response(null, { status: 204 }))
      signal = init.signal
      return new Promise((done) => { resolve = done })
    })
    await login(client)
    const pending = client.getMyLoans()
    const rejected = assert.rejects(pending, /Sessão expirada/)
    await client.logout()
    await rejected
    assert.equal(signal.aborted, true)
    await login(client)
    resolve(json({}, 401))
    await new Promise((done) => setImmediate(done))
    assert.notEqual(client.getSession(), null)
  })

  it('should reject expiration while the response body is pending', async () => {
    let clock = epoch
    let resolve
    const client = readClient(async () => ({ ok: true, json: () => new Promise((done) => { resolve = done }) }), { now: () => clock })
    await login(client)
    let notifications = 0
    client.subscribe(() => { notifications++ })
    const pending = client.getEquipment()
    await new Promise((done) => setImmediate(done))
    clock += 60000
    resolve({ equipamentos: [equipmentItem] })
    await assert.rejects(pending, /Sessão expirada/)
    assert.equal(notifications, 1)
  })

  it('should timeout stalled reads and allow retry without losing the session', async () => {
    let stalled = true
    const client = readClient(async () => stalled ? new Promise(() => {}) : json({ equipamentos: [] }), { timeoutMs: 10 })
    await login(client)
    await assert.rejects(client.getEquipment(), /consulta demorou demais/)
    stalled = false
    assert.deepEqual(await client.getEquipment(), [])
  })

  it('should never fetch without a session or for an already aborted read', async () => {
    let calls = 0
    const client = readClient(async () => { calls++; return json({ equipamentos: [] }) })
    await assert.rejects(client.getEquipment(), /Sessão expirada/)
    assert.equal(calls, 0)
    await login(client)
    const controller = new AbortController()
    controller.abort()
    await assert.rejects(client.getEquipment(controller.signal), { name: 'AbortError' })
  })
})

// Only synthetic fixtures are used; no real environment or network access.
describe('Backend HTTP authentication', () => {
  it('should confirm identity before granting access and keep the token private', async () => {
    const calls = []
    const client = clientWith(async (url, init) => {
      calls.push({ url, init })
      assert.equal(client.getSession(), null)
      return successfulFetch(url)
    })
    const session = await login(client)
    assert.deepEqual(session, { user, expiresAt: epoch + 60000 })
    assert.equal('access_token' in session, false)
    assert.deepEqual(calls.map(({ url, init }) => [url, init.method]), [
      ['https://auth.example.invalid/api/login', 'POST'], ['https://auth.example.invalid/api/me', 'GET'],
    ])
    assert.deepEqual(JSON.parse(calls[0].init.body), { email: user.email, password: 'synthetic-password' })
    assert.deepEqual(calls[0].init.headers, { 'Content-Type': 'application/json' })
    assert.equal(calls[1].init.headers.Authorization, 'Bearer synthetic-access')
    for (const { init } of calls) {
      assert.equal(init.redirect, 'error')
      assert.equal(init.credentials, 'omit')
      assert.equal(init.cache, 'no-store')
      assert.equal(init.referrerPolicy, 'no-referrer')
    }
  })

  it('should isolate returned snapshots and response objects from internal state', async () => {
    const client = clientWith(successfulFetch)
    const returned = await login(client)
    returned.user.id = 'changed'
    returned.expiresAt = epoch + 999999
    const snapshot = client.getSession()
    assert.deepEqual(snapshot, { user, expiresAt: epoch + 60000 })
    snapshot.user.email = 'changed@example.invalid'
    assert.deepEqual(client.getSession(), { user, expiresAt: epoch + 60000 })
  })

  for (const status of [400, 401, 403, 429, 500]) {
    it(`should reject HTTP ${status} without reading or exposing its body`, async () => {
      let read = false
      const client = clientWith(async () => ({ ok: false, status, json: () => { read = true } }))
      await assert.rejects(login(client), status === 401 ? /Confira e-mail e senha/ : AuthError)
      assert.equal(read, false)
      assert.equal(client.getSession(), null)
    })
  }

  it('should abort timeout and allow a later attempt', async () => {
    let signal
    let attempts = 0
    const client = clientWith(async (url, init) => {
      attempts++
      if (attempts === 1) { signal = init.signal; return new Promise(() => {}) }
      return successfulFetch(url)
    }, { timeoutMs: 10 })
    await assert.rejects(login(client), /demorou demais/)
    assert.equal(signal.aborted, true)
    assert.equal(client.getSession(), null)
    assert.deepEqual((await login(client)).user, user)
  })

  it('should enforce timeout while parsing a stalled response body', async () => {
    const client = clientWith(async () => ({ ok: true, json: () => new Promise(() => {}) }), { timeoutMs: 10 })
    await assert.rejects(login(client), /demorou demais/)
    assert.equal(client.getSession(), null)
  })

  it('should reject timeout during identity confirmation', async () => {
    const client = clientWith(async (url) => url.endsWith('/me') ? new Promise(() => {}) : json(tokenData), { timeoutMs: 10 })
    await assert.rejects(login(client), /demorou demais/)
    assert.equal(client.getSession(), null)
  })

  for (const [name, value] of [
    ['null response', null], ['array response', []], ['empty token', { ...tokenData, access_token: '' }],
    ['invalid bearer token', { ...tokenData, access_token: 'token\r\ninvalid' }],
    ['invalid lifetime', { ...tokenData, expires_in: '60' }],
    ['zero lifetime', { ...tokenData, expires_in: 0 }],
    ['negative lifetime', { ...tokenData, expires_in: -1 }],
    ['overflow lifetime', { ...tokenData, expires_in: Number.MAX_VALUE }],
    ['missing user', { ...tokenData, user: {} }],
    ['missing email', { ...tokenData, user: { id: user.id } }],
    ['invalid token type', { ...tokenData, token_type: 'other' }],
  ]) {
    it(`should reject malformed ${name}`, async () => {
      const client = clientWith(async () => json(value))
      await assert.rejects(login(client), AuthError)
      assert.equal(client.getSession(), null)
    })
  }

  it('should reject invalid JSON without exposing parser errors', async () => {
    const client = clientWith(async () => new Response('synthetic-invalid-json'))
    await assert.rejects(login(client), (error) => error instanceof AuthError && !error.message.includes('synthetic'))
  })

  for (const identity of [null, user, { user: {} }, { user: { ...user, id: 'other' } }, { user: { ...user, email: 'other@example.invalid' } }]) {
    it('should reject malformed or mismatched identity', async () => {
      const client = clientWith(async (url) => json(url.endsWith('/me') ? identity : tokenData))
      await assert.rejects(login(client), /identidade/)
      assert.equal(client.getSession(), null)
    })
  }

  it('should reject refusal during identity confirmation', async () => {
    const client = clientWith(async (url) => url.endsWith('/me') ? json({}, 403) : json(tokenData))
    await assert.rejects(login(client), AuthError)
    assert.equal(client.getSession(), null)
  })

  it('should fail closed at the exact expiration boundary and discard the expired token', async () => {
    let clock = epoch
    let calls = 0
    const client = clientWith(async (url) => { calls++; return successfulFetch(url) }, { now: () => clock })
    await login(client)
    clock = epoch + 59999
    assert.notEqual(client.getSession(), null)
    clock++
    assert.equal(client.getSession(), null)
    await client.logout()
    assert.equal(calls, 2)
  })

  it('should count login latency against expiration', async () => {
    let clock = epoch
    const client = clientWith(async (url) => {
      if (url.endsWith('/login')) clock += 10000
      return successfulFetch(url)
    }, { now: () => clock })
    assert.equal((await login(client)).expiresAt, epoch + 60000)
  })

  it('should reject expiration during identity confirmation', async () => {
    let clock = epoch
    const client = clientWith(async (url) => {
      if (url.endsWith('/me')) clock += 60000
      return successfulFetch(url)
    }, { now: () => clock })
    await assert.rejects(login(client), /expirada/)
    assert.equal(client.getSession(), null)
  })

  it('should fail closed when the clock becomes invalid', async () => {
    let clock = epoch
    const client = clientWith(successfulFetch, { now: () => clock })
    await login(client)
    clock = NaN
    assert.equal(client.getSession(), null)
  })

  it('should revoke remotely and clear locally first without parsing a 204 body', async () => {
    let logoutRequest
    const client = clientWith(async (url, init) => {
      if (url.endsWith('/logout')) {
        assert.equal(client.getSession(), null)
        logoutRequest = { url, init }
        return new Response(null, { status: 204 })
      }
      return successfulFetch(url)
    })
    await login(client)
    await client.logout()
    assert.equal(logoutRequest.url, 'https://auth.example.invalid/api/logout')
    assert.equal(logoutRequest.init.method, 'POST')
    assert.equal(logoutRequest.init.headers.Authorization, 'Bearer synthetic-access')
    assert.equal(logoutRequest.init.body, undefined)
    assert.equal(client.getSession(), null)
  })

  for (const timeout of [false, true]) {
    it(`should remain signed out when remote logout ${timeout ? 'times out' : 'fails'}`, async () => {
      const client = clientWith(async (url) => url.endsWith('/logout')
        ? timeout ? new Promise(() => {}) : json({}, 500) : successfulFetch(url), { timeoutMs: 10 })
      await login(client)
      await assert.rejects(client.logout(), /Sessão local encerrada/)
      assert.equal(client.getSession(), null)
      await client.logout()
      assert.deepEqual((await login(client)).user, user)
    })
  }

  it('should prevent concurrent login and logout during login', async () => {
    let resolve
    let calls = 0
    const client = clientWith(async (url) => {
      calls++
      if (calls === 1) return new Promise((done) => { resolve = done })
      return successfulFetch(url)
    })
    const pending = login(client)
    await assert.rejects(login(client), /em andamento/)
    await assert.rejects(client.logout(), /em andamento/)
    assert.equal(calls, 1)
    resolve(json(tokenData))
    await pending
  })

  it('should prevent duplicate logout and login while logout is pending', async () => {
    let resolve
    let calls = 0
    const client = clientWith(async (url) => {
      calls++
      return url.endsWith('/logout') ? new Promise((done) => { resolve = done }) : successfulFetch(url)
    })
    await login(client)
    const pending = client.logout()
    await assert.rejects(client.logout(), /em andamento/)
    await assert.rejects(login(client), /em andamento/)
    assert.equal(calls, 3)
    resolve(new Response(null, { status: 204 }))
    await pending
  })

  it('should not persist sessions across client instances', async () => {
    const client = clientWith(successfulFetch)
    await login(client)
    assert.equal(clientWith(successfulFetch).getSession(), null)
  })

  for (const url of ['http://example.invalid/api', 'https://user:pass@example.invalid/api', 'https://example.invalid/api?x=1', 'https://example.invalid/api#fragment', 'not a url']) {
    it('should reject unsafe configuration without sending credentials', async () => {
      const client = clientWith(async () => assert.fail('unexpected request'), { url })
      await assert.rejects(login(client), /Configuração/)
    })
  }

  it('should allow API paths and normalize trailing slashes', async () => {
    for (const url of ['http://localhost:5000/api/', 'http://127.0.0.1:5000/api/', 'http://[::1]:5000/api/']) {
      const calls = []
      const client = clientWith(async (target) => { calls.push(target); return successfulFetch(target) }, { url })
      await login(client)
      assert.equal(calls[0], `${url}login`)
      assert.equal(calls[1], `${url}me`)
    }
  })

  for (const url of ['', undefined, null, 123]) {
    it('should reject missing configuration without requests', async () => {
      const client = clientWith(async () => assert.fail('unexpected request'), { url })
      await assert.rejects(login(client), /configure VITE_API_URL/)
    })
  }

  for (const timeoutMs of [0, -1, NaN, Infinity]) {
    it('should reject invalid timeout configuration', async () => {
      const client = clientWith(async () => assert.fail('unexpected request'), { timeoutMs })
      await assert.rejects(login(client), /Configuração/)
    })
  }

  it('should validate input locally and preserve password whitespace', async () => {
    let body
    const client = clientWith(async (url, init) => { body ??= init.body; return successfulFetch(url) })
    await assert.rejects(client.login(' ', 'password'), /Informe/)
    await assert.rejects(client.login(user.email, ''), /Informe/)
    await client.login(` ${user.email} `, ' synthetic-password ')
    assert.deepEqual(JSON.parse(body), { email: user.email, password: ' synthetic-password ' })
  })

  it('should sanitize network failures', async () => {
    const client = clientWith(async () => { throw new Error('synthetic-private-body') })
    await assert.rejects(login(client), (error) => error instanceof AuthError && !error.message.includes('synthetic'))
  })
})
