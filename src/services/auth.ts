export interface AuthSession {
  user: { id: string; email: string }
  expiresAt: number
}

export interface Equipment {
  id: string
  nome: string
  patrimonio: string | null
  categoria: string
  status: 'DISPONIVEL' | 'MANUTENCAO' | 'EMPRESTADO' | 'INATIVO'
}

export interface Loan {
  id: string
  retirado_em: string
  previsto_para: string
  equipamento: Omit<Equipment, 'status'>
}

function equipment(value: unknown): value is Omit<Equipment, 'status'> {
  return record(value) && typeof value.id === 'string' && !!value.id.trim() &&
    typeof value.nome === 'string' && typeof value.categoria === 'string' &&
    (value.patrimonio === null || typeof value.patrimonio === 'string')
}

function loan(value: unknown): value is Loan {
  return record(value) && typeof value.id === 'string' && !!value.id.trim() &&
    equipment(value.equipamento) &&
    typeof value.retirado_em === 'string' &&
    /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value.retirado_em) &&
    Number.isFinite(Date.parse(value.retirado_em)) &&
    typeof value.previsto_para === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.previsto_para) &&
    Number.isFinite(Date.parse(value.previsto_para)) &&
    new Date(value.previsto_para).toISOString().slice(0, 10) === value.previsto_para
}

export function findNewLoanForEquipment(
  equipmentId: string,
  previousLoans: Loan[],
  currentLoans: Loan[],
): Loan | undefined {
  const previousIds = new Set(previousLoans.map((item) => item.id))
  return currentLoans.find((item) => item.equipamento.id === equipmentId && !previousIds.has(item.id))
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export class LoanOutcomeUnknown extends Error {
  constructor() {
    super('Não foi possível confirmar a solicitação.')
    this.name = 'LoanOutcomeUnknown'
  }
}

interface AuthOptions {
  url: unknown
  fetch?: typeof fetch
  now?: () => number
  timeoutMs?: number
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function configuration(url: unknown) {
  if (typeof url !== 'string' || !url.trim()) {
    throw new AuthError('Login indisponível: configure VITE_API_URL.')
  }
  try {
    const parsed = new URL(url.trim())
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
    if ((parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && loopback)) ||
        parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new Error()
    }
    return { url: `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}` }
  } catch {
    throw new AuthError('Configuração de login inválida. Use VITE_API_URL com HTTPS (HTTP apenas em loopback).')
  }
}

export function createAuthClient(options: AuthOptions) {
  const requestFetch = options.fetch ?? globalThis.fetch.bind(globalThis)
  const now = options.now ?? Date.now
  const timeoutMs = options.timeoutMs ?? 10000
  let config: ReturnType<typeof configuration> | undefined
  let configurationError = ''
  try {
    config = configuration(options.url)
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new AuthError('Configuração de login inválida.')
  } catch (error) {
    config = undefined
    configurationError = error instanceof AuthError ? error.message : 'Configuração de login inválida.'
  }
  let session: AuthSession | null = null
  let accessToken: string | null = null
  let busy = false
  const listeners = new Set<() => void>()
  const pendingAuthenticatedRequests = new Set<AbortController>()

  function clearSession() {
    const hadSession = session !== null
    session = null
    accessToken = null
    for (const controller of pendingAuthenticatedRequests) controller.abort()
    if (hadSession) for (const listener of listeners) listener()
  }

  function subscribe(listener: () => void) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }

  function getSession(): AuthSession | null {
    if (session && (!Number.isFinite(now()) || now() >= session.expiresAt)) clearSession()
    return session ? { user: { ...session.user }, expiresAt: session.expiresAt } : null
  }

  async function request(
    path: string,
    init: RequestInit,
    token?: string,
    signal?: AbortSignal,
    authenticated = false,
    unknownOutcomeOnTransportFailure = false,
  ): Promise<unknown> {
    if (!config) throw new AuthError(configurationError)
    if (signal?.aborted) throw new DOMException('Consulta cancelada.', 'AbortError')
    const controller = new AbortController()
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) controller.abort()
    if (authenticated) pendingAuthenticatedRequests.add(controller)
    const cancelled = new Promise<never>((_, reject) => {
      const rejectAbort = () => reject(new DOMException('Consulta cancelada.', 'AbortError'))
      controller.signal.addEventListener('abort', rejectAbort, { once: true })
      if (controller.signal.aborted) rejectAbort()
    })
    let timer: ReturnType<typeof setTimeout> | undefined
    let timedOut = false
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true
        controller.abort()
        reject(new AuthError('A autenticação demorou demais. Tente novamente.'))
      }, timeoutMs)
    })
    try {
      return await Promise.race([
        (async () => {
          const response = await requestFetch(`${config.url}/${path}`, {
            ...init,
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            signal: controller.signal,
            credentials: 'omit',
            redirect: 'error',
            cache: 'no-store',
            referrerPolicy: 'no-referrer',
          })
          if (controller.signal.aborted) throw new DOMException('Consulta cancelada.', 'AbortError')
          if (authenticated && response.status === 401 && accessToken === token) {
            clearSession()
            throw new AuthError('Sessão expirada. Entre novamente.')
          }
          if (!response.ok) {
            if (path === 'emprestimos') {
              let reason = ''
              try {
                const errorData: unknown = await response.json()
                if (record(errorData) && typeof errorData.reason === 'string') reason = errorData.reason
              } catch {
                reason = ''
              }
              if (response.status === 409 && reason === 'equipamento_indisponivel') {
                throw new AuthError('Este equipamento não está mais disponível.')
              }
              if (response.status === 409 && reason === 'limite_emprestimos') {
                throw new AuthError('Você atingiu o limite de três empréstimos em aberto.')
              }
              if (response.status === 403 && reason === 'emprestimo_atrasado') {
                throw new AuthError('Não é possível solicitar enquanto houver empréstimo em atraso.')
              }
              if (response.status >= 500) {
                throw new AuthError('Falha de infraestrutura ao solicitar o empréstimo. Tente novamente.')
              }
              throw new AuthError('Não foi possível solicitar o empréstimo. Tente novamente.')
            }
            if (authenticated) throw new AuthError('Consulta indisponível. Tente novamente.')
            throw new AuthError(response.status === 400 || response.status === 401 || response.status === 403
              ? 'Não foi possível autenticar. Confira e-mail e senha.'
              : 'Serviço de autenticação indisponível. Tente novamente.')
          }
          if (path === 'logout') return null
          return await response.json() as unknown
        })(),
        timeout,
        cancelled,
      ])
    } catch (error) {
      if (timedOut) {
        if (unknownOutcomeOnTransportFailure && getSession()) throw new LoanOutcomeUnknown()
        throw new AuthError(authenticated ? 'A consulta demorou demais. Tente novamente.' : 'A autenticação demorou demais. Tente novamente.')
      }
      if (authenticated && !getSession()) throw new AuthError('Sessão expirada. Entre novamente.')
      if (controller.signal.aborted) throw new DOMException('Consulta cancelada.', 'AbortError')
      if (error instanceof AuthError) throw error
      if (unknownOutcomeOnTransportFailure) throw new LoanOutcomeUnknown()
      throw new AuthError(authenticated ? 'Não foi possível carregar os dados. Tente novamente.' : 'Não foi possível confirmar a autenticação. Tente novamente.')
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      pendingAuthenticatedRequests.delete(controller)
    }
  }

  async function login(email: string, password: string): Promise<AuthSession> {
    if (busy) throw new AuthError('Aguarde a operação de autenticação em andamento.')
    if (!email.trim() || !password) throw new AuthError('Informe e-mail e senha.')
    busy = true
    clearSession()
    const startedAt = now()
    try {
      const data = await request('login', {
        method: 'POST', body: JSON.stringify({ email: email.trim(), password }),
      })
      if (!record(data) || typeof data.access_token !== 'string' || !/^[A-Za-z0-9._~+\/-]+=*$/.test(data.access_token) ||
          data.token_type !== 'bearer' || typeof data.expires_in !== 'number' ||
          !Number.isFinite(data.expires_in) || data.expires_in <= 0 ||
          !record(data.user) || typeof data.user.id !== 'string' || !data.user.id.trim() ||
          typeof data.user.email !== 'string' || !data.user.email.trim()) {
        throw new AuthError('Resposta de autenticação inválida. Tente novamente.')
      }
      const expiresAt = startedAt + data.expires_in * 1000
      if (!Number.isFinite(expiresAt) || !Number.isFinite(now()) || expiresAt <= now()) {
        throw new AuthError('Sessão expirada. Entre novamente.')
      }
      const identity = await request('me', { method: 'GET' }, data.access_token)
      const user = record(identity) ? identity.user : null
      if (!record(user) || user.id !== data.user.id || user.email !== data.user.email ||
          typeof user.email !== 'string' || !user.email.trim()) {
        throw new AuthError('Não foi possível confirmar a identidade. Tente novamente.')
      }
      if (!Number.isFinite(now()) || expiresAt <= now()) throw new AuthError('Sessão expirada. Entre novamente.')
      session = { user: { id: data.user.id, email: user.email }, expiresAt }
      accessToken = data.access_token
      return { user: { ...session.user }, expiresAt: session.expiresAt }
    } finally {
      busy = false
    }
  }

  async function logout(): Promise<void> {
    if (busy) throw new AuthError('Aguarde a operação de autenticação em andamento.')
    getSession()
    const token = accessToken
    clearSession()
    if (!token) return
    busy = true
    try {
      await request('logout', { method: 'POST' }, token)
    } catch {
      throw new AuthError('Sessão local encerrada. A saída no servidor não foi confirmada; a sessão remota pode permanecer válida até expirar.')
    } finally {
      busy = false
    }
  }

  async function authenticatedGet(path: 'equipamentos' | 'emprestimos/meus', signal?: AbortSignal) {
    if (!getSession() || !accessToken) throw new AuthError('Sessão expirada. Entre novamente.')
    const current = session
    const data = await request(path, { method: 'GET' }, accessToken, signal, true)
    if (signal?.aborted) throw new DOMException('Consulta cancelada.', 'AbortError')
    if (!getSession() || session !== current) throw new AuthError('Sessão expirada. Entre novamente.')
    return data
  }

  async function getEquipment(signal?: AbortSignal): Promise<Equipment[]> {
    const data = await authenticatedGet('equipamentos', signal)
    if (!record(data) || !Array.isArray(data.equipamentos) || !data.equipamentos.every((item: unknown) =>
      record(item) && typeof item.status === 'string' &&
      ['DISPONIVEL', 'MANUTENCAO', 'EMPRESTADO', 'INATIVO'].includes(item.status) && equipment(item))) {
      throw new AuthError('Resposta do catálogo inválida. Tente novamente.')
    }
    return data.equipamentos
  }

  async function getMyLoans(signal?: AbortSignal): Promise<Loan[]> {
    const data = await authenticatedGet('emprestimos/meus', signal)
    if (!record(data) || !Array.isArray(data.emprestimos) || !data.emprestimos.every(loan)) {
      throw new AuthError('Resposta de empréstimos inválida. Tente novamente.')
    }
    return data.emprestimos
  }

  async function requestLoan(equipmentId: string): Promise<Loan> {
    if (!getSession() || !accessToken) throw new AuthError('Sessão expirada. Entre novamente.')
    const current = session
    const data = await request('emprestimos', {
      method: 'POST',
      body: JSON.stringify({ equipamento_id: equipmentId }),
    }, accessToken, undefined, true, true)
    if (!getSession() || session !== current) throw new AuthError('Sessão expirada. Entre novamente.')
    if (!record(data) || !loan(data.emprestimo)) throw new LoanOutcomeUnknown()
    return data.emprestimo
  }

  return { configurationError, login, logout, getSession, subscribe, getEquipment, getMyLoans, requestLoan }
}
