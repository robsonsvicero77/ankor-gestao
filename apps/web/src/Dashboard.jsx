import { useEffect, useState } from 'react';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/dashboard')
      .then(res => res.json())
      .then(setData)
      .catch(() => setError('Erro ao carregar dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{color:'#fff'}}>Carregando...</div>;
  if (error) return <div style={{color:'red'}}>{error}</div>;
  if (!data) return null;

  return (
    <div style={{maxWidth:500,margin:'40px auto',background:'#222',padding:24,borderRadius:8,color:'#fff'}}>
      <h2>Dashboard</h2>
      <div>Saldo: <strong>R$ {data.saldo.toLocaleString('pt-br', {minimumFractionDigits:2})}</strong></div>
      <div>Receitas: R$ {data.receitas.toLocaleString('pt-br', {minimumFractionDigits:2})}</div>
      <div>Despesas: R$ {data.despesas.toLocaleString('pt-br', {minimumFractionDigits:2})}</div>
      <div>Previsão: R$ {data.previsao.toLocaleString('pt-br', {minimumFractionDigits:2})}</div>
      <div style={{marginTop:16}}>
        <strong>Alertas:</strong>
        <ul>
          {data.alertas.map((a,i) => (
            <li key={i} style={{color:a.tipo==='ATENCAO'?'orange':a.tipo==='OK'?'green':'red'}}>{a.mensagem}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
