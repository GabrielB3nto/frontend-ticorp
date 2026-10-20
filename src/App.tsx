import { useState } from 'react'
import './App.css'

type IconName = 'home' | 'users' | 'receipt' | 'gift' | 'chart' | 'settings' | 'search' | 'bell' | 'arrow' | 'plus' | 'more' | 'up' | 'calendar'

const paths: Record<IconName, string> = {
  home: 'M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5v-9ZM9 21v-6h6v6',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  receipt: 'M6 2h12a2 2 0 0 1 2 2v17l-3-2-2.5 2-2.5-2-2.5 2L6 19l-2 2V4a2 2 0 0 1 2-2Zm3 6h6m-6 4h6',
  gift: 'M20 12v9H4v-9m18-5H2v5h20V7ZM12 21V7M12 7H7.5A2.5 2.5 0 1 1 10 4.5L12 7Zm0 0h4.5A2.5 2.5 0 1 0 14 4.5L12 7Z',
  chart: 'M4 20V10m6 10V4m6 16v-7m6 7V8',
  settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0-12v2m0 13v2m8.5-8.5h-2m-13 0h-2m14.51-6.51-1.42 1.42M6.91 17.09l-1.42 1.42m12.52 0-1.42-1.42M6.91 6.91 5.49 5.49',
  search: 'm21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Zm-8 13h4',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  plus: 'M12 5v14M5 12h14',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  up: 'm18 15-6-6-6 6',
  calendar: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1 2-2Z',
}

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}

const nav = [['Visão geral', 'home'], ['Clientes', 'users'], ['Lançamentos', 'receipt'], ['Resgates', 'gift'], ['Relatórios', 'chart'], ['Configurações', 'settings']] as const
const activities = [
  { initials: 'MS', name: 'Mariana Silva', detail: 'Compra aprovada · Pedido #18459', points: '+ 248 pts', time: 'Há 4 min', color: 'violet' },
  { initials: 'RC', name: 'Rafael Costa', detail: 'Resgate realizado · Cafeteira Compacta', points: '− 1.200 pts', time: 'Há 18 min', color: 'orange' },
  { initials: 'LA', name: 'Luiza Almeida', detail: 'Compra aprovada · Pedido #18458', points: '+ 89 pts', time: 'Há 32 min', color: 'blue' },
  { initials: 'GP', name: 'Gustavo Pereira', detail: 'Pontos expirados', points: '− 320 pts', time: 'Há 1 h', color: 'green' },
]

function App() {
  const [active, setActive] = useState('Visão geral')
  const [query, setQuery] = useState('')
  const [period, setPeriod] = useState('Este mês')
  const [notice, setNotice] = useState(false)
  const greeting = active === 'Visão geral' ? 'Visão geral' : active

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#inicio" aria-label="TiCorp início"><span className="brand-mark"><span /></span><span>Ti<span>Corp</span></span></a>
      <div className="workspace"><span className="workspace-dot" /> Programa de pontos <Icon name="arrow" size={15} /></div>
      <nav aria-label="Navegação principal"><p className="nav-label">MENU</p>
        {nav.map(([label, icon]) => <button key={label} className={`nav-item ${active === label ? 'active' : ''}`} onClick={() => setActive(label)}><Icon name={icon} />{label}</button>)}
      </nav>
      <div className="sidebar-footer"><div className="help-card"><div className="help-icon">?</div><div><strong>Precisa de ajuda?</strong><span>Acesse nossa central</span></div><Icon name="arrow" size={15} /></div>
        <div className="profile"><div className="avatar">GB</div><div><strong>Gabriel Bento</strong><span>Administrador</span></div><button aria-label="Mais opções"><Icon name="more" size={19} /></button></div></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div className="mobile-brand"><span className="brand-mark"><span /></span> Ti<span>Corp</span></div>
        <label className="search"><Icon name="search" size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar cliente, pedido ou lançamento..." /><kbd>⌘ K</kbd></label>
        <div className="top-actions"><button className="icon-button notification" aria-label="Notificações"><Icon name="bell" /><i /></button><span className="top-avatar">GB</span></div>
      </header>
      <section className="content">
        <div className="heading-row"><div><p className="eyebrow">PAINEL ADMINISTRATIVO</p><h1>{greeting}</h1><p className="subtitle">Acompanhe o desempenho do seu programa de fidelidade.</p></div>
          <div className="heading-actions"><label className="period-button"><Icon name="calendar" size={17} /><select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Período"><option>Este mês</option><option>Últimos 30 dias</option><option>Este ano</option></select></label><button className="primary-button" onClick={() => setNotice(true)}><Icon name="plus" size={18} />Novo lançamento</button></div></div>
        {notice && <div className="toast">Lançamentos estarão disponíveis assim que a API for conectada.<button onClick={() => setNotice(false)}>×</button></div>}
        <div className="stat-grid">
          <article className="stat-card"><div className="stat-icon purple"><Icon name="users" /></div><p>Clientes ativos</p><strong>18.426</strong><span className="positive"><Icon name="up" size={14} /> 12,5% <em>vs. mês anterior</em></span><svg className="sparkline" viewBox="0 0 130 36" preserveAspectRatio="none"><path d="M0 30 C8 28 11 29 18 23 S29 24 37 18 S48 22 56 14 S70 19 79 11 S92 18 101 8 S118 11 130 2" /></svg></article>
          <article className="stat-card"><div className="stat-icon pink"><Icon name="chart" /></div><p>Pontos emitidos</p><strong>2.847.392</strong><span className="positive"><Icon name="up" size={14} /> 8,2% <em>vs. mês anterior</em></span><svg className="sparkline pink-line" viewBox="0 0 130 36" preserveAspectRatio="none"><path d="M0 28 C9 30 14 19 23 22 S35 25 43 14 S58 18 67 12 S79 16 87 7 S102 15 110 6 S122 7 130 2" /></svg></article>
          <article className="stat-card"><div className="stat-icon amber"><Icon name="gift" /></div><p>Pontos resgatados</p><strong>1.294.840</strong><span className="positive"><Icon name="up" size={14} /> 4,6% <em>vs. mês anterior</em></span><svg className="sparkline amber-line" viewBox="0 0 130 36" preserveAspectRatio="none"><path d="M0 30 C9 25 16 31 25 23 S36 18 45 20 S59 14 67 17 S81 7 90 12 S105 10 114 5 S124 7 130 2" /></svg></article>
          <article className="stat-card"><div className="stat-icon teal"><Icon name="receipt" /></div><p>Saldo em circulação</p><strong>8.642.109</strong><span className="neutral-stat">R$ 86.421,09 <em>em pontos ativos</em></span><svg className="sparkline teal-line" viewBox="0 0 130 36" preserveAspectRatio="none"><path d="M0 31 C9 29 15 23 24 25 S35 17 44 20 S57 16 67 13 S78 15 88 8 S101 14 110 6 S121 7 130 2" /></svg></article>
        </div>
        <div className="dashboard-grid">
          <article className="panel chart-panel"><div className="panel-head"><div><h2>Evolução de pontos</h2><p>Emitidos e resgatados ao longo do período</p></div><button className="dots" aria-label="Opções"><Icon name="more" /></button></div><div className="legend"><span><i className="legend-issued" /> Emitidos</span><span><i className="legend-redeemed" /> Resgatados</span></div><div className="chart"><div className="y-axis"><span>500k</span><span>375k</span><span>250k</span><span>125k</span><span>0</span></div><div className="chart-area"><div className="grid-lines" /><svg viewBox="0 0 650 210" preserveAspectRatio="none" aria-label="Gráfico de evolução de pontos"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#7656e8" stopOpacity=".24"/><stop offset="1" stopColor="#7656e8" stopOpacity="0"/></linearGradient></defs><path className="area" d="M0 177 C28 162 43 176 70 150 S108 132 132 141 S168 96 197 111 S231 130 258 95 S294 89 322 103 S353 68 385 80 S418 55 450 66 S478 43 510 55 S540 22 574 42 S616 24 650 14 L650 210 L0 210Z"/><path className="issued-line" d="M0 177 C28 162 43 176 70 150 S108 132 132 141 S168 96 197 111 S231 130 258 95 S294 89 322 103 S353 68 385 80 S418 55 450 66 S478 43 510 55 S540 22 574 42 S616 24 650 14"/><path className="redeemed-line" d="M0 188 C30 183 47 190 70 174 S104 164 132 170 S168 148 197 154 S230 164 258 142 S292 142 322 150 S355 127 385 137 S418 115 450 124 S481 105 510 112 S545 96 574 106 S614 86 650 91"/></svg><div className="x-axis"><span>01 Out</span><span>06 Out</span><span>11 Out</span><span>16 Out</span><span>21 Out</span><span>26 Out</span><span>31 Out</span></div></div></div></article>
          <article className="panel ranking-panel"><div className="panel-head"><div><h2>Mais engajados</h2><p>Clientes com maior saldo de pontos</p></div><button className="dots" aria-label="Opções"><Icon name="more" /></button></div>{[['1','CS','Camila Santos','12.480'],['2','MP','Marcos Paulo','11.920'],['3','JF','Juliana Freitas','10.745'],['4','RD','Ricardo Dias','9.860']].map(([rank, initials, name, pts]) => <div className="rank" key={rank}><span className={`rank-number r${rank}`}>{rank}</span><span className="rank-avatar">{initials}</span><span className="rank-name">{name}</span><strong>{pts} <em>pts</em></strong></div>)}<button className="text-button">Ver todos os clientes <Icon name="arrow" size={16} /></button></article>
        </div>
        <article className="panel activity-panel"><div className="panel-head"><div><h2>Atividade recente</h2><p>Últimas movimentações no programa</p></div><button className="text-button">Ver histórico <Icon name="arrow" size={16} /></button></div><div className="activity-list">{activities.filter((activity) => activity.name.toLowerCase().includes(query.toLowerCase()) || !query).map((activity) => <div className="activity" key={activity.name}><span className={`activity-avatar ${activity.color}`}>{activity.initials}</span><div><strong>{activity.name}</strong><span>{activity.detail}</span></div><b className={activity.points.startsWith('+') ? 'earned' : 'spent'}>{activity.points}</b><time>{activity.time}</time></div>)}{query && activities.every((activity) => !activity.name.toLowerCase().includes(query.toLowerCase())) && <p className="empty-state">Nenhum lançamento encontrado para “{query}”.</p>}</div></article>
      </section>
    </main>
  </div>
}

export default App
