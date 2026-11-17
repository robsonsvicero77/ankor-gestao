import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { AlertCircle, Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

export function RegisterPage() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailConfirmationRequired, setEmailConfirmationRequired] = useState(false);

  const passwordValid = password.length >= 6;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      const result = await register(name, email, password);
      setEmailConfirmationRequired(Boolean(result.emailConfirmationRequired));
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Erro ao criar conta. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#09090b]">
      {/* Left side - Image */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1743778812446-89def1e784cf?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxOTJ8MHwxfHNlYXJjaHwzfHxhYnN0cmFjdCUyMGdlb21ldHJpYyUyMGRhcmslMjBmaW5hbmNlJTIwYmFja2dyb3VuZCUyMG1pbmltYWxpc3R8ZW58MHx8fHwxNzcyNDYwMDM1fDA&ixlib=rb-4.1.0&q=85')`
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#09090b] via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090b]/80 via-transparent to-transparent" />
        <div className="relative z-10 flex flex-col justify-end p-12">
          <h2 className="text-4xl font-bold text-white mb-4">
            Comece a organizar<br />suas finanças hoje
          </h2>
          <p className="text-zinc-400 text-lg max-w-md">
            Em poucos minutos, tenha uma visão clara do seu fluxo de caixa
            e faça projeções para os próximos 30 dias.
          </p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-4 lg:p-8">
        <Card className="w-full max-w-md bg-[#18181b] border-zinc-800">
          <CardHeader className="space-y-1">
            <div className="mb-4 lg:hidden">
              <h1 className="text-2xl font-bold text-white">
                Ankor<span className="text-emerald-500">Gestão</span>
              </h1>
            </div>
            <CardTitle className="text-2xl text-white">Criar conta</CardTitle>
            <CardDescription className="text-zinc-400">
              {emailConfirmationRequired
                ? 'Confirme seu e-mail para acessar sua conta'
                : 'Preencha os dados para começar'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {emailConfirmationRequired ? (
              <div className="space-y-4 text-center">
                <div className="flex items-center justify-center gap-2 text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Enviamos um link de confirmação para {email}.</span>
                </div>
                <p className="text-sm text-zinc-400">
                  Abra o link no e-mail para confirmar sua conta e depois entre no sistema.
                </p>
                <Link to="/login" className="inline-block text-emerald-500 hover:text-emerald-400 font-medium">
                  Ir para entrar
                </Link>
              </div>
            ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="name" className="text-zinc-300">Nome</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  data-testid="register-name-input"
                  className="bg-zinc-900/50 border-zinc-800 focus:border-emerald-500 text-white placeholder:text-zinc-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-zinc-300">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="register-email-input"
                  className="bg-zinc-900/50 border-zinc-800 focus:border-emerald-500 text-white placeholder:text-zinc-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-zinc-300">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    data-testid="register-password-input"
                    className="bg-zinc-900/50 border-zinc-800 focus:border-emerald-500 text-white placeholder:text-zinc-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className={`flex items-center gap-1 text-xs ${passwordValid ? 'text-emerald-500' : 'text-zinc-500'}`}>
                    <CheckCircle2 className="h-3 w-3" />
                    Mínimo 6 caracteres
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-zinc-300">Confirmar senha</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Repita a senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  data-testid="register-confirm-password-input"
                  className="bg-zinc-900/50 border-zinc-800 focus:border-emerald-500 text-white placeholder:text-zinc-500"
                />
                {confirmPassword.length > 0 && (
                  <div className={`flex items-center gap-1 text-xs ${passwordsMatch ? 'text-emerald-500' : 'text-red-400'}`}>
                    <CheckCircle2 className="h-3 w-3" />
                    {passwordsMatch ? 'Senhas coincidem' : 'Senhas não coincidem'}
                  </div>
                )}
              </div>

              <Button
                type="submit"
                disabled={loading || !passwordValid || !passwordsMatch}
                data-testid="register-submit-btn"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white btn-press disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando conta...
                  </>
                ) : (
                  'Criar conta'
                )}
              </Button>

              <p className="text-center text-sm text-zinc-400">
                Já tem uma conta?{' '}
                <Link to="/login" className="text-emerald-500 hover:text-emerald-400 font-medium">
                  Entrar
                </Link>
              </p>
            </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
