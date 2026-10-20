import { FormEvent, useState } from 'react'
import './App.css'

const categorias = ['Notebook', 'Monitor', 'Cabo', 'Câmera', 'Acessório']

function App() {
  const [nome, setNome] = useState('')
  const [patrimonio, setPatrimonio] = useState('')
  const [categoria, setCategoria] = useState(categorias[0])
  const [situacao, setSituacao] = useState('DISPONIVEL')
  const [observacao, setObservacao] = useState('')
  const [mensagem, setMensagem] = useState('')

  function enviarFormulario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

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
          <a href="#catalogo">Catálogo</a>
          <a href="#emprestimos">Meus empréstimos</a>
          <a href="#operacoes">Operações</a>
          <a className="active" href="#equipamentos">Equipamentos</a>
        </nav>

        <div className="profile">
          <span className="profile-initials">GB</span>
          <span>
            <strong>Gabriel Bento</strong>
            <small>Operações</small>
          </span>
        </div>
      </header>

      <main>
        <section className="page-heading">
          <div>
            <p className="eyebrow">OPERações / catálogo interno</p>
            <h1>Cadastro de equipamento</h1>
            <p>Inclua um item de TI que poderá ser disponibilizado para empréstimo.</p>
          </div>
          <a className="ghost-button" href="#catalogo">Ver catálogo</a>
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
      </main>
    </div>
  )
}

export default App
