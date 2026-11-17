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
    <div className="min-h-screen flex bg-surface-background">
      {/* Left side - Image */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1743778812446-89def1e784cf?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxOTJ8MHwxfHNlYXJjaHwzfHxhYnN0cmFjdCUyMGdlb21ldHJpYyUyMGRhcmslMjBmaW5hbmNlJTIwYmFja2dyb3VuZCUyMG1pbmltYWxpc3R8ZW58MHx8fHwxNzcyNDYwMDM1fDA&ixlib=rb-4.1.0&q=85')`
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-overlay via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-overlay/80 via-transparent to-transparent" />
        <div className="relative z-10 flex flex-col justify-end p-12">
          <h2 className="type-display text-text-inverse mb-4">
            Comece a organizar<br />suas finanças hoje
          </h2>
          <p className="text-text-inverse/85 text-lg max-w-md">
            Em poucos minutos, tenha uma visão clara do seu fluxo de caixa
            e faça projeções para os próximos 30 dias.
          </p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-4 lg:p-8">
        <Card className="w-full max-w-md bg-surface border-border">
          <CardHeader className="space-y-1">
            <div className="mb-4 lg:hidden">
              <h1 className="text-2xl font-bold text-text-primary">
                <span className="text-brand-accent">Ankor</span><span className="text-brand-primary">Gestão</span>
              </h1>
            </div>
            <CardTitle className="text-h3 text-text-primary">Criar conta</CardTitle>
            <CardDescription className="text-text-secondary">
              {emailConfirmationRequired
                ? 'Confirme seu e-mail para acessar sua conta'
                : 'Preencha os dados para começar'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {emailConfirmationRequired ? (
              <div className="space-y-4 text-center">
                <div className="flex items-center justify-center gap-2 text-success">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Enviamos um link de confirmação para {email}.</span>
                </div>
                <p className="text-sm text-text-secondary">
                  Abra o link no e-mail para confirmar sua conta e depois entre no sistema.
                </p>
                <Link to="/login" className="inline-block text-brand-primary hover:text-brand-hover font-medium">
                  Ir para entrar
                </Link>
              </div>
            ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-error-background border border-error/30 text-error text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="name" className="text-text-secondary">Nome</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  data-testid="register-name-input"
                  className="bg-surface border-border focus:border-focus text-text-primary placeholder:text-text-secondary"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-text-secondary">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="register-email-input"
                  className="bg-surface border-border focus:border-focus text-text-primary placeholder:text-text-secondary"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-text-secondary">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    data-testid="register-password-input"
                    className="bg-surface border-border focus:border-focus text-text-primary placeholder:text-text-secondary pr-10"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-secondary"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className={`flex items-center gap-1 text-xs ${passwordValid ? 'text-success' : 'text-text-secondary'}`}>
                    <CheckCircle2 className="h-3 w-3" />
                    Mínimo 6 caracteres
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-text-secondary">Confirmar senha</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Repita a senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  data-testid="register-confirm-password-input"
                  className="bg-surface border-border focus:border-focus text-text-primary placeholder:text-text-secondary"
                />
                {confirmPassword.length > 0 && (
                  <div className={`flex items-center gap-1 text-xs ${passwordsMatch ? 'text-success' : 'text-error'}`}>
                    <CheckCircle2 className="h-3 w-3" />
                    {passwordsMatch ? 'Senhas coincidem' : 'Senhas não coincidem'}
                  </div>
                )}
              </div>

              <Button
                type="submit"
                disabled={loading || !passwordValid || !passwordsMatch}
                data-testid="register-submit-btn"
                className="w-full bg-brand-primary hover:bg-brand-hover active:bg-brand-active text-text-inverse btn-press disabled:opacity-50"
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

              <p className="text-center text-sm text-text-secondary">
                Já tem uma conta?{' '}
                <Link to="/login" className="text-brand-primary hover:text-brand-hover font-medium">
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
