import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { login, register, getMe } from './api'
import Dashboard from './Dashboard'

function App() {
  const [count, setCount] = useState(0)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [token, setToken] = useState('')
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('login')

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await login(email, password);
      setToken(res.access_token);
      setUser(res.user);
    } catch (err) {
      setError(err.detail || 'Erro ao logar');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await register(name, email, password);
      setToken(res.access_token);
      setUser(res.user);
    } catch (err) {
      setError(err.detail || 'Erro ao registrar');
    }
  };

  const handleGetMe = async () => {
    setError('');
    try {
      const res = await getMe(token);
      setUser(res);
    } catch (err) {
      setError(err.detail || 'Erro ao buscar usuário');
    }
  };

  if (user) {
    return <Dashboard />;
  }
  return (
    <div style={{ maxWidth: 400, margin: '40px auto', padding: 20, background: '#222', borderRadius: 8, color: '#fff' }}>
      <h2>{mode === 'login' ? 'Login' : 'Registro'}</h2>
      <form onSubmit={mode === 'login' ? handleLogin : handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {mode === 'register' && (
          <input placeholder="Nome" value={name} onChange={e => setName(e.target.value)} required />
        )}
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
        <input placeholder="Senha" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        <button type="submit">{mode === 'login' ? 'Entrar' : 'Registrar'}</button>
      </form>
      <button style={{ marginTop: 8 }} onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'Criar conta' : 'Já tenho conta'}
      </button>
      {token && (
        <div style={{ marginTop: 16 }}>
          <button onClick={handleGetMe}>Buscar dados do usuário</button>
        </div>
      )}
      {user && (
        <div style={{ marginTop: 16 }}>
          <strong>Usuário logado:</strong>
          <pre>{JSON.stringify(user, null, 2)}</pre>
        </div>
      )}
      {error && (
        <div style={{ color: 'red', marginTop: 8 }}>{error}</div>
      )}
    </div>
  );
}

export default App
