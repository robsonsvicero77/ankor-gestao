import { useEffect, useState } from 'react';

// SVG Outline Icons
const icons = {
  wallet: (
    <svg width="24" height="24" fill="none" stroke="#20B2AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="4"/>
      <path d="M2 11h20"/>
      <circle cx="18" cy="14" r="2"/>
    </svg>
  ),
  upCircle: (
    <svg width="24" height="24" fill="none" stroke="#20B2AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 16V8"/>
      <path d="M8 12l4-4 4 4"/>
    </svg>
  ),
  downCircle: (
    <svg width="24" height="24" fill="none" stroke="#FF8C00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 8v8"/>
      <path d="M16 12l-4 4-4-4"/>
    </svg>
  ),
  book: (
    <svg width="24" height="24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 7H20"/>
      <path d="M6.5 7v10"/>
      <path d="M20 7v10"/>
      <path d="M6.5 17V7"/>
    </svg>
  ),
  gear: (
    <svg width="24" height="24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.09a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  target: (
    <svg width="24" height="24" fill="none" stroke="#a13bbb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2"/>
    </svg>
  ),
  calendario: (
    <svg width="24" height="24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2"/>
      <path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>
    </svg>
  ),
  clock: (
    <svg width="32" height="32" fill="none" stroke="#bbb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="16" cy="16" r="14"/>
      <path d="M16 8v8l6 4"/>
    </svg>
  )
};

const sidebarItems = [
  { icon: icons.wallet, label: 'Dashboard', active: true },
  { icon: icons.upCircle, label: 'Receitas' },
  { icon: icons.downCircle, label: 'Despesas' },
  { icon: icons.book, label: 'Histórico' },
  { icon: icons.gear, label: 'Configurações' },
];

export default function Dashboard() {
  const [data, setData] = useState({
    saldo: 1000,
    receitas: 1000,
    despesas: 0,
    previsao: 1000,
    alertas: [
      { tipo: 'OK', mensagem: 'Situação OK' }
    ]
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 500);
  }, []);

  return (
    <div className="dashboard-bg">
      <aside className="dashboard-sidebar">
        <div>
          <div className="dashboard-logo">ANKOR<span style={{ color: '#20B2AA', fontWeight: 400 }}>GESTÃO</span></div>
          <nav>
            {sidebarItems.map((item, i) => (
              <div key={i} className={item.active ? 'active' : ''}>
                <span className="icon">{item.icon}</span> <span className="sidebar-label">{item.label}</span>
              </div>
            ))}
          </nav>
        </div>
        <div className="dashboard-user">
          <div className="avatar">R</div>
          <div className="dashboard-user-info">
            <span>Roberto Robson Svicero</span>
            <span className="user-email">robsonsvicero@outlook.com</span>
          </div>
          <button className="dashboard-logout">Sair</button>
        </div>
      </aside>
      <main className="dashboard-main">
        <div className="dashboard-header">
          <h1>Dashboard</h1>
        </div>
        <div className="dashboard-subtitle">Visão geral das suas finanças</div>
        <div className="dashboard-cards">
          <Card cor="#20B2AA" titulo="Saldo Atual" valor={data.saldo} descricao="R$" subtitulo="0 pendentes" icon={icons.wallet} />
          <Card cor="#20B2AA" titulo="Receitas (30 dias)" valor={data.receitas} descricao="R$" subtitulo="0 pendentes" icon={icons.upCircle} />
          <Card cor="#FF8C00" titulo="Despesas (30 dias)" valor={data.despesas} descricao="R$" subtitulo="0 pendentes" icon={icons.downCircle} />
          <Card cor="#a13bbb" titulo="Saldo Projetado" valor={data.previsao} descricao="R$" subtitulo="em 30 dias" icon={icons.target} />
        </div>
        <div className="dashboard-actions">
          <button className="dashboard-btn receita"><span>{icons.upCircle}</span> Nova Receita</button>
          <button className="dashboard-btn despesa"><span>{icons.downCircle}</span> Nova Despesa</button>
        </div>
        <div className="dashboard-timeline">
          <div className="dashboard-timeline-header">
            <span>{icons.calendario}</span> Próximos 7 dias
          </div>
          <div className="dashboard-timeline-empty">
            <div className="dashboard-timeline-title">Nenhum compromisso nos próximos 7 dias</div>
            <div className="dashboard-timeline-desc">Adicione receitas ou despesas para ver a timeline</div>
            <div className="dashboard-timeline-icon">{icons.clock}</div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Card({ cor, titulo, valor, descricao, subtitulo, icon }) {
  return (
    <div className="dashboard-card" style={{ color: cor }}>
      <div className="dashboard-card-header">
        <span className="icon">{icon}</span>
        <span className="dashboard-card-title">{titulo}</span>
      </div>
      <div className="dashboard-card-value">{descricao} {valor.toLocaleString('pt-br', {minimumFractionDigits:2})}</div>
      <div className="dashboard-card-subtitle">{subtitulo}</div>
    </div>
  );
}