import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { balanceApi } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { AlertCircle, Loader2, Wallet, ArrowRight, CheckCircle } from 'lucide-react';
import { formatCurrency, parseCurrencyToCents } from '../lib/utils';

export function OnboardingPage() {
  const navigate = useNavigate();
  const { completeOnboarding } = useAuth();
  const [step, setStep] = useState(1);
  const [balanceInput, setBalanceInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleBalanceChange = (e) => {
    let value = e.target.value.replace(/[^\d,]/g, '');
    setBalanceInput(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const cents = parseCurrencyToCents(balanceInput || '0');
      await balanceApi.setInitial({ amount_cents: cents, note: 'Saldo inicial definido no onboarding' });
      completeOnboarding();
      setStep(2);
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (err) {
      if (err.response?.data?.detail === 'Saldo inicial já foi definido') {
        completeOnboarding();
        navigate('/dashboard');
      } else {
        setError(err.response?.data?.detail || 'Erro ao definir saldo inicial');
      }
    } finally {
      setLoading(false);
    }
  };

  if (step === 2) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b] p-4">
        <Card className="w-full max-w-md bg-[#18181b] border-zinc-800 text-center">
          <CardContent className="pt-8 pb-8">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Tudo pronto!</h2>
            <p className="text-zinc-400 mb-4">
              Seu saldo inicial foi configurado. Redirecionando para o dashboard...
            </p>
            <div className="flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b] p-4">
      <Card className="w-full max-w-md bg-[#18181b] border-zinc-800">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <Wallet className="h-6 w-6 text-emerald-500" />
          </div>
          <CardTitle className="text-2xl text-white">Qual é o seu saldo atual?</CardTitle>
          <CardDescription className="text-zinc-400">
            Informe o saldo que você tem disponível hoje para começarmos a monitorar suas finanças.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="balance" className="text-zinc-300">Saldo atual (R$)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-lg">R$</span>
                <Input
                  id="balance"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={balanceInput}
                  onChange={handleBalanceChange}
                  data-testid="onboarding-balance-input"
                  className="bg-zinc-900/50 border-zinc-800 focus:border-emerald-500 text-white placeholder:text-zinc-500 pl-12 text-xl font-mono h-14"
                />
              </div>
              <p className="text-xs text-zinc-500">
                Pode ser zero ou negativo se você estiver no vermelho
              </p>
            </div>

            {balanceInput && (
              <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
                <p className="text-sm text-zinc-400 mb-1">Saldo a ser registrado:</p>
                <p className="text-2xl font-bold text-emerald-500 font-mono">
                  {formatCurrency(parseCurrencyToCents(balanceInput || '0'))}
                </p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              data-testid="onboarding-submit-btn"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white btn-press h-12"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  Continuar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
