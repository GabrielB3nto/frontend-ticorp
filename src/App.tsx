import { FormEvent, useEffect, useRef, useState } from 'react'
import {
  AuthError,
  AuthSession,
  Equipment,
  findNewLoanForEquipment,
  Loan,
  LoanOutcomeUnknown,
  createAuthClient,
} from './services/auth'
import './App.css'

const auth = createAuthClient({
  url: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
})

const categorias = ['Notebook', 'Monitor', 'Cabo', 'Câmera', 'Acessório']
type Page = 'catalogo' | 'emprestimos' | 'equipamentos'
const statusLabels: Record<Equipment['status'], string> = {
  DISPONIVEL: 'Disponível', MANUTENCAO: 'Em manutenção', EMPRESTADO: 'Emprestado', INATIVO: 'Inativo',
}
const calendarDate = (value: string) => value.split('-').reverse().join('/')

function App() {
  const [nome, setNome] = useState('')
  const [patrimonio, setPatrimonio] = useState('')
  const [categoria, setCategoria] = useState(categorias[0])
  const [situacao, setSituacao] = useState('DISPONIVEL')
  const [observacao, setObservacao] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [session, setSession] = useState<AuthSession | null>(null)
  const [authMessage, setAuthMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const submitting = useRef(false)
  const [loanSubmittingId, setLoanSubmittingId] = useState<string | null>(null)
  const [loanMessage, setLoanMessage] = useState('')
  const [loanMessageRole, setLoanMessageRole] = useState<'status' | 'alert'>('status')
  const loanSubmitting = useRef(false)
  const sessionRevision = useRef(0)
  const [page, setPage] = useState<Page>('catalogo')
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [readState, setReadState] = useState<'loading' | 'success' | 'error'>('loading')
  const [readError, setReadError] = useState('')
  const [attempt, setAttempt] = useState(0)

  function clearReads() {
    setEquipment([])
    setLoans([])
    setReadError('')
    setReadState('loading')
  }

  function navigate(target: Page) {
    if (target === page) return
    clearReads()
    setPage(target)
  }

  useEffect(() => auth.subscribe(() => {
    sessionRevision.current += 1
    loanSubmitting.current = false
    setLoanSubmittingId(null)
    setSession(null)
    clearEquipment()
    clearReads()
    setLoanMessage('Sessão expirada. Entre novamente.')
    setLoanMessageRole('alert')
    setAuthMessage('Sessão expirada. Entre novamente.')
  }), [])

  useEffect(() => {
    if (!session || page === 'equipamentos') return
    const controller = new AbortController()
    let active = true
    clearReads()
    const pending = page === 'catalogo' ? auth.getEquipment(controller.signal) : auth.getMyLoans(controller.signal)
    pending.then((items) => {
      if (!active || !auth.getSession()) return
      if (page === 'catalogo') setEquipment(items as Equipment[])
      else setLoans(items as Loan[])
      setReadState('success')
    }).catch((error: unknown) => {
      if (!active || !auth.getSession()) return
      setReadError(error instanceof AuthError ? error.message : 'Não foi possível carregar os dados. Tente novamente.')
      setReadState('error')
    })
    return () => { active = false; controller.abort() }
  }, [session, page, attempt])

  function clearEquipment() {
    setNome('')
    setPatrimonio('')
    setCategoria(categorias[0])
    setSituacao('DISPONIVEL')
    setObservacao('')
    setMensagem('')
  }

  useEffect(() => {
    if (!session) return
    function checkExpiration() {
      if (!auth.getSession()) {
        setSession(null)
        clearEquipment()
        setAuthMessage('Sessão expirada. Entre novamente.')
      }
    }
    const timer = window.setInterval(checkExpiration, 1000)
    window.addEventListener('focus', checkExpiration)
    document.addEventListener('visibilitychange', checkExpiration)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', checkExpiration)
      document.removeEventListener('visibilitychange', checkExpiration)
    }
  }, [session])

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    const form = event.currentTarget
    const data = new FormData(form)
    const email = String(data.get('email') ?? '')
    const password = String(data.get('password') ?? '')
    form.reset()
    data.delete('password')
    submitting.current = true
    setLoading(true)
    setAuthMessage('')
    try {
      const authenticated = await auth.login(email, password)
      clearReads()
      setPage('catalogo')
      sessionRevision.current += 1
      setLoanMessage('')
      setSession(authenticated)
    } catch (error) {
      setAuthMessage(error instanceof AuthError ? error.message : 'Não foi possível entrar. Tente novamente.')
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  async function signOut() {
    if (submitting.current) return
    submitting.current = true
    sessionRevision.current += 1
    loanSubmitting.current = false
    setLoanSubmittingId(null)
    setLoading(true)
    setSession(null)
    clearEquipment()
    clearReads()
    setLoanMessage('')
    setAuthMessage('')
    try {
      await auth.logout()
      setAuthMessage('Você saiu. Entre novamente para continuar.')
    } catch (error) {
      setAuthMessage(error instanceof AuthError ? error.message : 'Sessão local encerrada.')
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  function isCurrentSession(revision: number) {
    return revision === sessionRevision.current && auth.getSession() !== null
  }

  async function refreshLoanViews(revision: number) {
    const [equipmentResult, loansResult] = await Promise.allSettled([
      auth.getEquipment(),
      auth.getMyLoans(),
    ])
    if (!isCurrentSession(revision)) return null

    if (equipmentResult.status === 'fulfilled') setEquipment(equipmentResult.value)
    if (loansResult.status === 'fulfilled') setLoans(loansResult.value)
    if (equipmentResult.status === 'fulfilled' && loansResult.status === 'fulfilled') {
      setReadError('')
      setReadState('success')
      return { equipment: equipmentResult.value, loans: loansResult.value }
    }

    const refreshError = equipmentResult.status === 'rejected'
      ? equipmentResult.reason
      : loansResult.status === 'rejected' ? loansResult.reason : null
    setReadError(refreshError instanceof AuthError
      ? refreshError.message
      : 'Não foi possível atualizar o catálogo e seus empréstimos.')
    setReadState('error')
    return null
  }

  async function solicitarEmprestimo(item: Equipment) {
    if (item.status !== 'DISPONIVEL' || loanSubmitting.current) return
    if (!auth.getSession()) {
      setSession(null)
      setAuthMessage('Sessão expirada. Entre novamente.')
      return
    }

    loanSubmitting.current = true
    setLoanSubmittingId(item.id)
    setLoanMessage('')
    const revision = sessionRevision.current
    try {
      let previousLoans: Loan[]
      try {
        previousLoans = await auth.getMyLoans()
      } catch (error) {
        if (!isCurrentSession(revision)) return
        setLoanMessage(error instanceof AuthError
          ? `Não foi possível verificar seus empréstimos; a solicitação não foi enviada. ${error.message}`
          : 'Não foi possível verificar seus empréstimos; a solicitação não foi enviada.')
        setLoanMessageRole('alert')
        return
      }
      if (!isCurrentSession(revision)) return

      try {
        const created = await auth.requestLoan(item.id)
        if (!isCurrentSession(revision)) return

        setLoans((current) => current.some((loan) => loan.id === created.id) ? current : [...current, created])
        setEquipment((current) => current.map((equipmentItem) =>
          equipmentItem.id === item.id ? { ...equipmentItem, status: 'EMPRESTADO' } : equipmentItem))
        setLoanMessage(`Solicitação confirmada para ${item.nome}.`)
        setLoanMessageRole('status')
        await refreshLoanViews(revision)
      } catch (error) {
        if (!isCurrentSession(revision)) return
        if (error instanceof LoanOutcomeUnknown) {
          const currentViews = await refreshLoanViews(revision)
          if (!isCurrentSession(revision)) return
          const observedLoan = currentViews
            ? findNewLoanForEquipment(item.id, previousLoans, currentViews.loans)
            : undefined
          if (observedLoan) {
            setLoanMessage(`Solicitação confirmada para ${item.nome}.`)
            setLoanMessageRole('status')
          } else {
            setLoanMessage('Não foi possível confirmar a solicitação.')
            setLoanMessageRole('alert')
          }
          return
        }
        setLoanMessage(error instanceof AuthError
          ? error.message
          : 'Falha de infraestrutura ao solicitar o empréstimo. Tente novamente.')
        setLoanMessageRole('alert')
      }
    } finally {
      if (revision === sessionRevision.current) {
        loanSubmitting.current = false
        setLoanSubmittingId(null)
      }
    }
  }

  if (!session || !auth.getSession()) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <a className="brand" href="#inicio" aria-label="EMPREST.AI">
            <span className="brand-mark">E</span>
            <span>EMPREST<span>.AI</span></span>
          </a>
        </header>
        <main className="login-main">
          <section className="form-card" aria-labelledby="login-title">
            <p className="eyebrow">ACESSO À CONTA</p>
            <h1 id="login-title">Entrar</h1>
            <p>Use seu e-mail e senha para autenticar no backend. A sessão termina ao recarregar esta página.</p>
            <form className="login-form" onSubmit={signIn} aria-busy={loading}>
              <label className="field">
                <span>E-mail</span>
                <input name="email" type="email" autoComplete="username" required disabled={loading} />
              </label>
              <label className="field">
                <span>Senha</span>
                <input name="password" type="password" autoComplete="current-password" required disabled={loading} />
              </label>
              {auth.configurationError && <p className="form-message auth-error" role="alert">{auth.configurationError}</p>}
              {authMessage && <p className="form-message auth-error" role="alert">{authMessage}</p>}
              <button className="primary-button" type="submit" disabled={loading || !!auth.configurationError}>
                {loading ? 'Aguarde…' : 'Entrar'}
              </button>
            </form>
          </section>
        </main>
      </div>
    )
  }

  function enviarFormulario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!auth.getSession()) {
      setSession(null)
      clearEquipment()
      setAuthMessage('Sessão expirada. Entre novamente.')
      return
    }

    if (!nome.trim()) {
      setMensagem('Informe o nome do equipamento para continuar.')
      return
    }

    setMensagem('Dados validados. O envio ao banco será habilitado na próxima tarefa.')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="EMPREST.AI">
          <span className="brand-mark">E</span>
          <span>EMPREST<span>.AI</span></span>
        </a>

        <nav aria-label="Navegação principal">
          {(['catalogo', 'emprestimos', 'equipamentos'] as const).map((target) => (
            <a key={target} href={`#${target}`} className={page === target ? 'active' : ''}
              aria-current={page === target ? 'page' : undefined}
              onClick={(event) => { event.preventDefault(); navigate(target) }}>
              {{ catalogo: 'Catálogo', emprestimos: 'Meus empréstimos', equipamentos: 'Equipamentos' }[target]}
            </a>
          ))}
        </nav>

        <div className="profile">
          <span className="profile-initials" aria-hidden="true">{session.user.email.slice(0, 2).toUpperCase()}</span>
          <span>
            <strong title={session.user.email}>{session.user.email}</strong>
          </span>
          <button className="secondary-button" type="button" disabled={loading} onClick={signOut}>Sair</button>
        </div>
      </header>

      <main>
        {page !== 'equipamentos' ? (
          <>
            <section className="page-heading">
              <div>
                <p className="eyebrow">CATÁLOGO INTERNO</p>
                <h1>{page === 'catalogo' ? 'Catálogo' : 'Meus empréstimos'}</h1>
                <p>{page === 'catalogo' ? 'Consulte a disponibilidade e solicite os equipamentos que precisa.' : 'Consulte seus empréstimos em aberto e as datas de devolução.'}</p>
              </div>
            </section>
            <section aria-label={page === 'catalogo' ? 'Equipamentos do catálogo' : 'Empréstimos em aberto'} aria-busy={readState === 'loading'}>
              {page === 'catalogo' && loanMessage && <p className={`form-message ${loanMessageRole === 'alert' ? 'auth-error' : ''}`} role={loanMessageRole}>{loanMessage}</p>}
              {readState === 'loading' && <p role="status">Carregando…</p>}
              {readState === 'error' && <div className="info-card">
                <p role="alert">{readError}</p>
                <button className="secondary-button" type="button" onClick={() => { clearReads(); setAttempt((value) => value + 1) }}>Tentar novamente</button>
              </div>}
              {readState === 'success' && (page === 'catalogo' ? (
                equipment.length === 0 ? <p role="status">Nenhum equipamento encontrado.</p> :
                  <ul className="reading-list">{equipment.map((item) => <li key={item.id} className="info-card">
                    <h2>{item.nome}</h2>
                    <p>Categoria: {item.categoria}</p>
                    <p>Patrimônio: {item.patrimonio ?? 'Não informado'}</p>
                    <p>Status: <strong>{statusLabels[item.status]}</strong></p>
                    <button className="primary-button" type="button"
                      disabled={item.status !== 'DISPONIVEL' || loanSubmitting.current}
                      onClick={() => { void solicitarEmprestimo(item) }}>
                      {loanSubmittingId === item.id ? 'Enviando solicitação…' : 'Solicitar empréstimo'}
                    </button>
                  </li>)}</ul>
              ) : (
                loans.length === 0 ? <p role="status">Você não tem empréstimos em aberto.</p> :
                  <ul className="reading-list">{loans.map((loan) => <li key={loan.id} className="info-card">
                    <h2>{loan.equipamento.nome}</h2>
                    <p>Categoria: {loan.equipamento.categoria}</p>
                    <p>Patrimônio: {loan.equipamento.patrimonio ?? 'Não informado'}</p>
                    <p>Retirado em: <time dateTime={loan.retirado_em}>{calendarDate(loan.retirado_em.slice(0, 10))}</time></p>
                    <p>Devolução prevista: <time dateTime={loan.previsto_para}>{calendarDate(loan.previsto_para)}</time></p>
                  </li>)}</ul>
              ))}
            </section>
          </>
        ) : <>
        <section className="page-heading">
          <div>
            <p className="eyebrow">OPERações / catálogo interno</p>
            <h1>Cadastro de equipamento</h1>
            <p>Inclua um item de TI que poderá ser disponibilizado para empréstimo.</p>
          </div>
          <a className="ghost-button" href="#catalogo" onClick={(event) => { event.preventDefault(); navigate('catalogo') }}>Ver catálogo</a>
        </section>

        <div className="content-grid">
          <section className="form-card" aria-labelledby="form-title">
            <div className="card-heading">
              <div>
                <h2 id="form-title">Dados do equipamento</h2>
                <p>Campos com <b>*</b> são obrigatórios.</p>
              </div>
              <span className="operation-badge">Operações</span>
            </div>

            <form onSubmit={enviarFormulario} noValidate>
              <div className="fields-grid">
                <label className="field full-width">
                  <span>Nome do equipamento <b>*</b></span>
                  <input
                    value={nome}
                    onChange={(event) => setNome(event.target.value)}
                    placeholder="Ex.: Notebook Dell Latitude 5440"
                    aria-describedby="nome-ajuda"
                  />
                  <small id="nome-ajuda">Use uma identificação clara para facilitar a localização no catálogo.</small>
                </label>

                <label className="field">
                  <span>Número de patrimônio</span>
                  <input
                    value={patrimonio}
                    onChange={(event) => setPatrimonio(event.target.value)}
                    placeholder="Ex.: TI-00421"
                  />
                  <small>Se ficar vazio, o item será exibido como TI-—.</small>
                </label>

                <label className="field">
                  <span>Categoria <b>*</b></span>
                  <select value={categoria} onChange={(event) => setCategoria(event.target.value)}>
                    {categorias.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>

                <fieldset className="field full-width">
                  <legend>Situação operacional <b>*</b></legend>
                  <div className="status-options">
                    <label className={situacao === 'DISPONIVEL' ? 'selected' : ''}>
                      <input type="radio" name="situacao" value="DISPONIVEL" checked={situacao === 'DISPONIVEL'} onChange={(event) => setSituacao(event.target.value)} />
                      <span><strong>Disponível</strong><small>Pronto para ser emprestado.</small></span>
                    </label>
                    <label className={situacao === 'MANUTENCAO' ? 'selected' : ''}>
                      <input type="radio" name="situacao" value="MANUTENCAO" checked={situacao === 'MANUTENCAO'} onChange={(event) => setSituacao(event.target.value)} />
                      <span><strong>Em manutenção</strong><small>Indisponível até nova avaliação.</small></span>
                    </label>
                    <label className={situacao === 'INATIVO' ? 'selected' : ''}>
                      <input type="radio" name="situacao" value="INATIVO" checked={situacao === 'INATIVO'} onChange={(event) => setSituacao(event.target.value)} />
                      <span><strong>Inativo</strong><small>Não aparecerá para empréstimo.</small></span>
                    </label>
                  </div>
                </fieldset>

                <label className="field full-width">
                  <span>Observação</span>
                  <textarea value={observacao} onChange={(event) => setObservacao(event.target.value)} placeholder="Acessórios, estado de conservação ou outras informações úteis." rows={4} />
                </label>
              </div>

              {mensagem && <p className="form-message" role="status">{mensagem}</p>}

              <div className="form-actions">
                <button className="secondary-button" type="reset" onClick={() => setMensagem('')}>Limpar</button>
                <button className="primary-button" type="submit">Validar cadastro</button>
              </div>
            </form>
          </section>

          <aside className="sidebar">
            <section className="info-card">
              <p className="eyebrow">REGRAS EM VIGOR</p>
              <h2>Antes de disponibilizar</h2>
              <ul>
                <li>Um equipamento só pode ter um empréstimo ativo.</li>
                <li>O prazo padrão de empréstimo é de até 14 dias.</li>
                <li>Cada colaborador pode manter até 3 itens ativos.</li>
                <li>Itens em manutenção ou inativos não podem ser emprestados.</li>
              </ul>
            </section>
            <section className="info-card muted-card">
              <p className="eyebrow">FORA DESTA VERSÃO</p>
              <ul>
                <li>Reserva de equipamento</li>
                <li>Notificações por e-mail</li>
                <li>Importação de planilhas</li>
              </ul>
            </section>
          </aside>
        </div>
        </>}
      </main>
    </div>
  )
}

export default App
