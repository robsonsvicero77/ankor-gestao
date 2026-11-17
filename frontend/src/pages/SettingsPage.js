import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BellRing,
  Building2,
  Check,
  CircleAlert,
  Clock3,
  ImagePlus,
  Loader2,
  LockKeyhole,
  Mail,
  Save,
  Trash2,
  UserRound,
  UsersRound,
  Wallet,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { useAuth } from '../context/AuthContext';
import { adminAccountsApi, settingsApi } from '../lib/api';
import { getProviderDefaults } from '../lib/contractUtils';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';

const SECTIONS = [
  { id: 'profile', label: 'Perfil', icon: UserRound },
  { id: 'professional', label: 'Dados profissionais', icon: Building2 },
  { id: 'financial', label: 'Preferências financeiras', icon: Wallet },
  { id: 'alerts', label: 'Alertas', icon: BellRing },
  { id: 'security', label: 'Segurança', icon: LockKeyhole },
  { id: 'accounts', label: 'Contas cadastradas', icon: UsersRound, adminOnly: true },
];

const DEFAULT_ALERTS = {
  client_email_reminders: false,
  in_app_alerts: true,
  owner_email_alerts: true,
};

const TIMEZONES = [
  ['America/Sao_Paulo', 'Brasília, São Paulo (UTC−03:00)'],
  ['America/Manaus', 'Manaus (UTC−04:00)'],
  ['America/Rio_Branco', 'Rio Branco (UTC−05:00)'],
  ['America/Belem', 'Belém (UTC−03:00)'],
  ['America/Noronha', 'Fernando de Noronha (UTC−02:00)'],
  ['Europe/Lisbon', 'Lisboa'],
  ['UTC', 'UTC'],
];

function createFormState(data) {
  return {
    name: data.name || '',
    timezone: data.timezone || 'America/Sao_Paulo',
    provider: getProviderDefaults(data.provider, data.provider_configured),
    alerts: { ...DEFAULT_ALERTS, ...(data.alerts || {}) },
  };
}

function getErrorMessage(error, fallback) {
  const detail = error.response?.data?.detail;
  return (typeof detail === 'string' && detail) || error.message || fallback;
}

function centsToInput(cents) {
  if (cents === null || cents === undefined) return '0,00';
  return `${cents < 0 ? '-' : ''}${(Math.abs(cents) / 100).toFixed(2).replace('.', ',')}`;
}

function amountInputToCents(value) {
  const cleaned = value.trim().replace(/\s|R\$/g, '');
  const negative = cleaned.startsWith('-');
  const digits = cleaned.replace(/[^\d,.]/g, '');
  if (!digits) return NaN;
  const decimal = digits.includes(',')
    ? digits.replace(/\./g, '').replace(',', '.')
    : digits;
  const amount = Number(decimal);
  return Number.isFinite(amount) ? Math.round(amount * 100) * (negative ? -1 : 1) : NaN;
}

function formatRegistrationDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function Field({ id, label, children, hint }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm text-text-secondary">{label}</Label>
      {children}
      {hint && <p className="text-xs leading-relaxed text-text-secondary">{hint}</p>}
    </div>
  );
}

function ToggleRow({ id, title, description, checked, onCheckedChange }) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="min-w-0">
        <Label htmlFor={id} className="cursor-pointer text-sm font-medium text-text-primary">{title}</Label>
        <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-text-secondary">{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={title}
        className="mt-0.5 data-[state=checked]:bg-brand-primary"
      />
    </div>
  );
}

export function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const fileInputRef = useRef(null);
  const [activeSectionId, setActiveSectionId] = useState('profile');
  const [form, setForm] = useState(null);
  const [savedForm, setSavedForm] = useState(null);
  const [email, setEmail] = useState('');
  const [avatarPath, setAvatarPath] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [initialBalance, setInitialBalance] = useState('0,00');
  const [initialBalanceCents, setInitialBalanceCents] = useState(null);
  const [balanceEditable, setBalanceEditable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [balanceBusy, setBalanceBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [message, setMessage] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState('');
  const [accountToDelete, setAccountToDelete] = useState(null);
  const [deletingAccountId, setDeletingAccountId] = useState('');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const { data } = await settingsApi.get();
      const nextForm = createFormState(data);
      setForm(nextForm);
      setSavedForm(nextForm);
      setEmail(data.email || '');
      setEmailInput(data.email || '');
      setAvatarPath(data.avatar_path || null);
      setInitialBalanceCents(data.initial_balance_cents);
      setInitialBalance(centsToInput(data.initial_balance_cents));
      setBalanceEditable(Boolean(data.initial_balance_editable));

      if (data.avatar_path) {
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('avatars')
          .createSignedUrl(data.avatar_path, 3600);
        if (signedUrlError) {
          setMessage({
            type: 'error',
            text: getErrorMessage(signedUrlError, 'Não foi possível carregar a foto de perfil.'),
          });
        } else {
          setAvatarUrl(signedUrlData.signedUrl);
        }
      } else {
        setAvatarUrl('');
      }
    } catch (error) {
      setLoadError(getErrorMessage(error, 'Não foi possível carregar as configurações.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    setAccountsError('');
    try {
      const { data } = await adminAccountsApi.list();
      setAccounts(data.accounts);
    } catch (error) {
      setAccountsError(getErrorMessage(error, 'Não foi possível carregar as contas cadastradas.'));
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSectionId === 'accounts' && user?.role === 'admin') {
      loadAccounts();
    }
  }, [activeSectionId, loadAccounts, user?.role]);

  const dirty = useMemo(
    () => Boolean(form && savedForm && JSON.stringify(form) !== JSON.stringify(savedForm)),
    [form, savedForm],
  );

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateProvider = (field, value) => {
    setForm((current) => ({
      ...current,
      provider: { ...current.provider, [field]: value },
    }));
  };

  const updateAlert = (field, value) => {
    setForm((current) => ({
      ...current,
      alerts: { ...current.alerts, [field]: value },
    }));
  };

  const saveSettings = async () => {
    if (!form || !dirty) return;
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        provider: Object.fromEntries(
          Object.entries(form.provider).map(([key, value]) => [key, value.trim()]),
        ),
      };
      await settingsApi.update(payload);
      setForm(payload);
      setSavedForm(payload);
      try {
        await refreshUser();
        setMessage({ type: 'success', text: 'Configurações salvas.' });
      } catch (refreshError) {
        console.error('Configurações salvas, mas o perfil não foi atualizado:', refreshError);
        setMessage({
          type: 'error',
          text: 'Configurações salvas, mas não foi possível atualizar o perfil exibido. Recarregue a página.',
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: getErrorMessage(error, 'Não foi possível salvar as configurações.'),
      });
    } finally {
      setSaving(false);
    }
  };

  const refreshAvatarUrl = async (path) => {
    const { data, error } = await supabase.storage
      .from('avatars')
      .createSignedUrl(path, 3600);
    if (error) throw error;
    setAvatarUrl(data.signedUrl);
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage({ type: 'error', text: 'Use uma imagem JPG, PNG ou WebP.' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'A imagem deve ter no máximo 2 MB.' });
      return;
    }

    const path = `${user.id}/avatar`;
    setAvatarBusy(true);
    setMessage(null);
    try {
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      await settingsApi.updateAvatar(path);
      setAvatarPath(path);
      await refreshAvatarUrl(path);
      await refreshUser();
      setMessage({ type: 'success', text: 'Foto de perfil atualizada.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: getErrorMessage(error, 'Não foi possível atualizar a foto.'),
      });
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    if (!avatarPath) return;
    setAvatarBusy(true);
    setMessage(null);
    try {
      await settingsApi.updateAvatar(null);
      setAvatarPath(null);
      setAvatarUrl('');
      await refreshUser();
      const { error } = await supabase.storage.from('avatars').remove([avatarPath]);
      if (error) throw error;
      setMessage({ type: 'success', text: 'Foto de perfil removida.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: getErrorMessage(error, 'Não foi possível remover a foto.'),
      });
    } finally {
      setAvatarBusy(false);
    }
  };

  const saveOpeningBalance = async () => {
    const amountCents = amountInputToCents(initialBalance);
    if (!Number.isFinite(amountCents)) {
      setMessage({ type: 'error', text: 'Informe um saldo inicial válido.' });
      return;
    }
    setBalanceBusy(true);
    setMessage(null);
    try {
      const { data } = await settingsApi.updateOpeningBalance({ amount_cents: amountCents });
      setInitialBalanceCents(data.amount_cents);
      setInitialBalance(centsToInput(data.amount_cents));
      setBalanceEditable(data.editable);
      setMessage({ type: 'success', text: 'Saldo inicial atualizado.' });
    } catch (error) {
      if (error.response?.status === 409) setBalanceEditable(false);
      setMessage({
        type: 'error',
        text: getErrorMessage(error, 'Não foi possível atualizar o saldo inicial.'),
      });
    } finally {
      setBalanceBusy(false);
    }
  };

  const changeEmail = async (event) => {
    event.preventDefault();
    const nextEmail = emailInput.trim().toLowerCase();
    if (!nextEmail || nextEmail === email) {
      setMessage({ type: 'error', text: 'Informe um e-mail diferente do atual.' });
      return;
    }
    setEmailBusy(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.updateUser({ email: nextEmail });
      if (error) throw error;
      setMessage({
        type: 'success',
        text: 'Solicitação enviada. Confirme a alteração pelos links enviados pelo Supabase.',
      });
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, 'Não foi possível alterar o e-mail.') });
    } finally {
      setEmailBusy(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    if (password.length < 8) {
      setMessage({ type: 'error', text: 'A nova senha deve ter pelo menos 8 caracteres.' });
      return;
    }
    if (password !== passwordConfirmation) {
      setMessage({ type: 'error', text: 'A confirmação da senha não corresponde.' });
      return;
    }
    setPasswordBusy(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword('');
      setPasswordConfirmation('');
      setMessage({ type: 'success', text: 'Senha atualizada.' });
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, 'Não foi possível alterar a senha.') });
    } finally {
      setPasswordBusy(false);
    }
  };

  const deleteAccount = async () => {
    if (!accountToDelete) return;
    setDeletingAccountId(accountToDelete.id);
    setAccountsError('');
    setMessage(null);
    try {
      await adminAccountsApi.delete(accountToDelete.id);
      setAccounts((current) => current.filter((account) => account.id !== accountToDelete.id));
      setAccountToDelete(null);
      setMessage({
        type: 'success',
        text: `A conta de ${accountToDelete.name} e os dados associados foram excluídos permanentemente.`,
      });
    } catch (error) {
      setAccountsError(getErrorMessage(error, 'Não foi possível excluir esta conta.'));
    } finally {
      setDeletingAccountId('');
    }
  };

  const visibleSections = SECTIONS.filter(
    (section) => !section.adminOnly || user?.role === 'admin',
  );
  const activeSection = visibleSections.find((section) => section.id === activeSectionId)
    || visibleSections[0];
  const ActiveSectionIcon = activeSection.icon;

  if (loading) {
    return (
      <Layout>
        <div className="flex min-h-[50vh] items-center justify-center text-text-secondary" role="status">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-brand-primary" />
          Carregando configurações...
        </div>
      </Layout>
    );
  }

  if (loadError || !form) {
    return (
      <Layout>
        <div className="mx-auto max-w-2xl rounded-lg border border-error/30 bg-error-background p-6 text-center">
          <CircleAlert className="mx-auto h-6 w-6 text-error" />
          <p className="mt-3 text-sm text-error" role="alert">{loadError || 'Configurações indisponíveis.'}</p>
          <Button
            type="button"
            onClick={loadSettings}
            variant="outline"
            className="mt-5 border-border-strong text-text-primary hover:bg-surface-alt"
          >
            Tentar novamente
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-[1440px] space-y-6" data-testid="settings-page">
        <header className="flex flex-col gap-2">
          <h1 className="type-h1 text-text-primary">Configurações</h1>
          <p className="max-w-[65ch] text-sm leading-relaxed text-text-secondary">
            Gerencie seu perfil, os dados usados nos documentos e as preferências da sua conta.
          </p>
        </header>

        {message && (
          <div
            className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
              message.type === 'success'
                ? 'border-success/30 bg-success-background text-success'
                : 'border-error/30 bg-error-background text-error'
            }`}
            role={message.type === 'error' ? 'alert' : 'status'}
            aria-live="polite"
          >
            {message.type === 'success'
              ? <Check className="mt-0.5 h-4 w-4 shrink-0" />
              : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        <div className="grid items-start gap-4 lg:grid-cols-[210px_minmax(0,1fr)_270px]">
          <aside className="order-1 rounded-lg border border-border bg-surface p-4 lg:order-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-light text-base font-semibold text-brand-primary">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  form.name.trim().charAt(0).toUpperCase() || 'U'
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-primary">{form.name || 'Seu perfil'}</p>
                <p className="truncate text-xs text-text-secondary">{email}</p>
              </div>
            </div>
            <div className="my-4 h-px bg-border" />
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-text-secondary">Moeda</dt>
                <dd className="font-medium text-text-primary">BRL · R$</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-text-secondary">Dados profissionais</dt>
                <dd className="font-medium text-text-primary">
                  {form.provider.display_name.trim() ? 'Configurados' : 'Pendentes'}
                </dd>
              </div>
            </dl>
            <div className="mt-4 rounded-lg bg-surface-alt px-3 py-2.5">
              <p className="text-xs text-text-secondary">Saldo inicial</p>
              <p className="mt-1 tabular-nums text-sm font-semibold text-text-primary">
                {initialBalanceCents === null ? 'Não definido' : formatCurrency(initialBalanceCents)}
              </p>
            </div>
            <p className="mt-3 text-xs text-text-secondary">
              {dirty ? 'Há alterações ainda não salvas.' : 'Tudo salvo nesta sessão.'}
            </p>
            <Button
              type="button"
              onClick={saveSettings}
              disabled={!dirty || saving}
              className="mt-4 w-full bg-brand-primary text-text-inverse hover:bg-brand-hover"
            >
              {saving
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Save className="h-4 w-4" />}
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </aside>

          <nav
            aria-label="Seções de configurações"
            className="order-2 -mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0"
          >
            {visibleSections.map((section) => {
              const Icon = section.icon;
              const selected = section.id === activeSectionId;
              return (
                <button
                  key={section.id}
                  type="button"
                  aria-current={selected ? 'page' : undefined}
                  onClick={() => setActiveSectionId(section.id)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                    selected
                      ? 'bg-brand-light font-medium text-brand-primary'
                      : 'text-text-secondary hover:bg-surface-alt hover:text-text-primary'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {section.label}
                </button>
              );
            })}
          </nav>

          <section key={activeSectionId} className="settings-panel-enter order-3 min-w-0 rounded-lg border border-border bg-surface p-4 sm:p-6 lg:order-2">
            <div className="mb-6 flex items-start justify-between gap-4 border-b border-border pb-5">
              <div className="flex items-start gap-3">
                <ActiveSectionIcon className="mt-0.5 h-5 w-5 text-brand-secondary" />
                <div>
                  <h2 className="type-h2 text-text-primary">{activeSection.label}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                    {activeSection.id === 'profile' && 'Atualize sua identificação e foto de perfil.'}
                    {activeSection.id === 'professional' && 'Esses dados são reutilizados em novas propostas e contratos.'}
                    {activeSection.id === 'financial' && 'Defina o fuso dos vencimentos. Os valores permanecem em reais.'}
                    {activeSection.id === 'alerts' && 'Escolha quais avisos o sistema deve enviar e exibir.'}
                    {activeSection.id === 'security' && 'Altere seu e-mail de acesso ou crie uma nova senha.'}
                    {activeSection.id === 'accounts' && 'Consulte as contas cadastradas e remova contas de usuário quando necessário.'}
                  </p>
                </div>
              </div>
              {dirty && (
                <span className="shrink-0 rounded-full bg-warning-background px-2.5 py-1 text-xs font-medium text-text-primary">
                  Não salvo
                </span>
              )}
            </div>

            {activeSection.id === 'profile' && (
              <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-light text-2xl font-semibold text-brand-primary">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={`Foto de ${form.name}`} className="h-full w-full object-cover" />
                    ) : (
                      form.name.trim().charAt(0).toUpperCase() || 'U'
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">Foto de perfil</p>
                    <p className="mt-1 text-sm text-text-secondary">JPG, PNG ou WebP, até 2 MB.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleAvatarChange}
                        className="sr-only"
                        aria-label="Selecionar foto de perfil"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={avatarBusy}
                        className="bg-brand-light text-brand-primary hover:bg-surface-accent active:bg-brand-light"
                      >
                        {avatarBusy
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <ImagePlus className="h-4 w-4" />}
                        {avatarPath ? 'Trocar foto' : 'Enviar foto'}
                      </Button>
                      {avatarPath && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={removeAvatar}
                          disabled={avatarBusy}
                          className="border-border-strong text-text-secondary hover:bg-surface-alt"
                        >
                          Remover
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <Field id="profile-name" label="Nome completo">
                  <Input
                    id="profile-name"
                    value={form.name}
                    onChange={(event) => updateForm('name', event.target.value)}
                    maxLength={120}
                    autoComplete="name"
                    className="border-border bg-surface text-text-primary placeholder:text-text-secondary"
                  />
                </Field>
                <Field id="profile-email" label="E-mail de acesso" hint="Para alterar este endereço, use a seção Segurança.">
                  <Input
                    id="profile-email"
                    value={email}
                    readOnly
                    className="border-border bg-surface text-text-secondary"
                  />
                </Field>
              </div>
            )}

            {activeSection.id === 'professional' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="provider-display-name" label="Nome profissional">
                  <Input id="provider-display-name" value={form.provider.display_name} onChange={(event) => updateProvider('display_name', event.target.value)} maxLength={200} className="border-border bg-surface text-text-primary" />
                </Field>
                <Field id="provider-legal-name" label="Razão social / nome legal">
                  <Input id="provider-legal-name" value={form.provider.legal_name} onChange={(event) => updateProvider('legal_name', event.target.value)} maxLength={200} className="border-border bg-surface text-text-primary" />
                </Field>
                <Field id="provider-document" label="CPF ou CNPJ">
                  <Input id="provider-document" value={form.provider.document} onChange={(event) => updateProvider('document', event.target.value)} maxLength={30} className="border-border bg-surface text-text-primary" />
                </Field>
                <Field id="provider-representative" label="Representante legal">
                  <Input id="provider-representative" value={form.provider.representative_name} onChange={(event) => updateProvider('representative_name', event.target.value)} maxLength={200} className="border-border bg-surface text-text-primary" />
                </Field>
                <Field id="provider-email" label="E-mail profissional">
                  <Input id="provider-email" type="email" value={form.provider.email} onChange={(event) => updateProvider('email', event.target.value)} maxLength={254} className="border-border bg-surface text-text-primary" />
                </Field>
                <Field id="provider-phone" label="Telefone profissional">
                  <Input id="provider-phone" type="tel" value={form.provider.phone} onChange={(event) => updateProvider('phone', event.target.value)} maxLength={40} className="border-border bg-surface text-text-primary" />
                </Field>
                <div className="sm:col-span-2">
                  <Field id="provider-address" label="Endereço completo">
                    <textarea
                      id="provider-address"
                      value={form.provider.address}
                      onChange={(event) => updateProvider('address', event.target.value)}
                      maxLength={500}
                      rows={3}
                      className="flex w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    />
                  </Field>
                </div>
              </div>
            )}

            {activeSection.id === 'financial' && (
              <div className="space-y-8">
                <Field id="settings-timezone" label="Fuso horário" hint="Usado para exibir datas e calcular vencimentos nos alertas.">
                  <select
                    id="settings-timezone"
                    value={form.timezone}
                    onChange={(event) => updateForm('timezone', event.target.value)}
                    className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    {TIMEZONES.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                    {!TIMEZONES.some(([value]) => value === form.timezone) && (
                      <option value={form.timezone}>{form.timezone}</option>
                    )}
                  </select>
                </Field>
                <div className="rounded-lg border border-border bg-surface p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                    <Wallet className="h-4 w-4 text-brand-secondary" />
                    Moeda padrão
                  </div>
                  <p className="mt-2 text-sm text-text-secondary">Real brasileiro (BRL · R$)</p>
                  <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                    A moeda permanece fixa para preservar os valores já registrados.
                  </p>
                </div>
                <div className="border-t border-border pt-6">
                  <div className="mb-4 flex items-start gap-3">
                    <Clock3 className="mt-0.5 h-4 w-4 text-text-secondary" />
                    <div>
                      <h3 className="type-h3 text-text-primary">Saldo inicial</h3>
                      <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                        {balanceEditable
                          ? 'Pode ser alterado enquanto não houver outros lançamentos financeiros.'
                          : 'Bloqueado porque já existem outros lançamentos no histórico.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <Field id="opening-balance" label="Valor inicial (R$)">
                      <Input
                        id="opening-balance"
                        inputMode="decimal"
                        value={initialBalance}
                        onChange={(event) => setInitialBalance(event.target.value)}
                        disabled={!balanceEditable || balanceBusy}
                        aria-describedby="opening-balance-hint"
                        className="border-border bg-surface text-text-primary disabled:text-text-secondary"
                      />
                    </Field>
                    <Button
                      type="button"
                      onClick={saveOpeningBalance}
                      disabled={!balanceEditable || balanceBusy}
                      className="bg-brand-light text-brand-primary hover:bg-surface-accent active:bg-brand-light"
                    >
                      {balanceBusy
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Save className="h-4 w-4" />}
                      Atualizar saldo
                    </Button>
                  </div>
                  <p id="opening-balance-hint" className="mt-2 text-xs text-text-secondary">
                    Saldo atual registrado: {initialBalanceCents === null ? 'não definido' : formatCurrency(initialBalanceCents)}.
                  </p>
                </div>
              </div>
            )}

            {activeSection.id === 'alerts' && (
              <div className="divide-y divide-border">
                <ToggleRow
                  id="client-email-reminders"
                  title="Enviar lembretes aos clientes"
                  description="E-mail automático para receitas com vencimento nos próximos 3 dias. A receita precisa estar vinculada a um cliente cadastrado com e-mail."
                  checked={form.alerts.client_email_reminders}
                  onCheckedChange={(checked) => updateAlert('client_email_reminders', checked)}
                />
                <ToggleRow
                  id="in-app-alerts"
                  title="Alertas dentro do sistema"
                  description="Exibe no Dashboard receitas e despesas vencidas ou com vencimento nos próximos 7 dias."
                  checked={form.alerts.in_app_alerts}
                  onCheckedChange={(checked) => updateAlert('in_app_alerts', checked)}
                />
                <ToggleRow
                  id="owner-email-alerts"
                  title="Resumo por e-mail para mim"
                  description="Envia diariamente um resumo de receitas e despesas vencidas ou próximas do vencimento para o e-mail da conta."
                  checked={form.alerts.owner_email_alerts}
                  onCheckedChange={(checked) => updateAlert('owner_email_alerts', checked)}
                />
                <div className="flex items-start gap-3 pt-5 text-sm text-text-secondary">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" />
                  <p className="max-w-[65ch] leading-relaxed">
                    Lembretes por e-mail são enviados somente a clientes vinculados que tenham endereço de e-mail cadastrado.
                  </p>
                </div>
              </div>
            )}

            {activeSection.id === 'security' && (
              <div className="space-y-8">
                <form onSubmit={changeEmail} className="space-y-4">
                  <div>
                    <h3 className="type-h3 text-text-primary">Alterar e-mail de acesso</h3>
                    <p className="mt-1 text-sm text-text-secondary">E-mail atual: {email}</p>
                  </div>
                  <Field id="new-email" label="Novo e-mail">
                    <Input
                      id="new-email"
                      type="email"
                      value={emailInput}
                      onChange={(event) => setEmailInput(event.target.value)}
                      autoComplete="email"
                      required
                      className="border-border bg-surface text-text-primary"
                    />
                  </Field>
                  <Button type="submit" disabled={emailBusy} className="bg-brand-light text-brand-primary hover:bg-surface-accent active:bg-brand-light">
                    {emailBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                    Solicitar alteração
                  </Button>
                </form>

                <form onSubmit={changePassword} className="space-y-4 border-t border-border pt-6">
                  <div>
                    <h3 className="type-h3 text-text-primary">Alterar senha</h3>
                    <p className="mt-1 text-sm text-text-secondary">Use pelo menos 8 caracteres.</p>
                  </div>
                  <Field id="new-password" label="Nova senha">
                    <Input
                      id="new-password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      required
                      className="border-border bg-surface text-text-primary"
                    />
                  </Field>
                  <Field id="confirm-password" label="Confirmar nova senha">
                    <Input
                      id="confirm-password"
                      type="password"
                      value={passwordConfirmation}
                      onChange={(event) => setPasswordConfirmation(event.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      required
                      className="border-border bg-surface text-text-primary"
                    />
                  </Field>
                  <Button type="submit" disabled={passwordBusy} className="bg-brand-light text-brand-primary hover:bg-surface-accent active:bg-brand-light">
                    {passwordBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                    Atualizar senha
                  </Button>
                </form>
              </div>
            )}

            {activeSection.id === 'accounts' && (
              <div className="space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="type-h3 text-text-primary">Contas do sistema</h3>
                    <p className="mt-1 text-sm text-text-secondary">
                      {accounts.length} {accounts.length === 1 ? 'conta cadastrada' : 'contas cadastradas'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={loadAccounts}
                    disabled={accountsLoading}
                    className="border-border-strong text-text-secondary hover:bg-surface-alt"
                  >
                    {accountsLoading
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <UsersRound className="h-4 w-4" />}
                    Atualizar lista
                  </Button>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-background p-4 text-sm text-text-primary">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" />
                  <p className="leading-relaxed">
                    Excluir uma conta também apaga permanentemente a empresa e todos os dados associados. Contas de administrador são protegidas.
                  </p>
                </div>

                {accountsError && (
                  <div role="alert" className="rounded-lg border border-error/30 bg-error-background px-4 py-3 text-sm text-error">
                    {accountsError}
                  </div>
                )}

                {accountsLoading ? (
                  <div className="flex min-h-32 items-center justify-center text-sm text-text-secondary" role="status">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin text-brand-primary" />
                    Carregando contas...
                  </div>
                ) : accountsError && accounts.length === 0 ? null : accounts.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-text-secondary">
                    Nenhuma conta cadastrada.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                      <thead className="bg-surface-alt text-xs uppercase tracking-wide text-text-secondary">
                        <tr>
                          <th scope="col" className="px-4 py-3 font-medium">Nome</th>
                          <th scope="col" className="px-4 py-3 font-medium">E-mail</th>
                          <th scope="col" className="px-4 py-3 font-medium">Data de cadastro</th>
                          <th scope="col" className="px-4 py-3 text-right font-medium">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {accounts.map((account) => (
                          <tr key={account.id} className="bg-surface">
                            <td className="px-4 py-3 font-medium text-text-primary">{account.name || '—'}</td>
                            <td className="px-4 py-3 text-text-secondary">{account.email || '—'}</td>
                            <td className="whitespace-nowrap px-4 py-3 tabular-nums text-text-secondary">
                              {formatRegistrationDate(account.created_at)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {account.role === 'admin' ? (
                                <span className="text-xs text-text-secondary">Administrador protegido</span>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  aria-label={`Excluir conta de ${account.name || account.email}`}
                                  onClick={() => {
                                    setAccountsError('');
                                    setAccountToDelete(account);
                                  }}
                                  className="border-error/30 text-error hover:bg-error-background"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Excluir
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
      <AlertDialog
        open={Boolean(accountToDelete)}
        onOpenChange={(open) => {
          if (!open && !deletingAccountId) setAccountToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              {accountToDelete && (
                <>
                  A conta de <strong>{accountToDelete.name}</strong> ({accountToDelete.email}) será removida.
                  Esta ação também apagará a empresa e todos os dados associados, e não poderá ser desfeita.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {accountsError && (
            <p role="alert" className="text-sm text-error">{accountsError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingAccountId)}>
              Cancelar
            </AlertDialogCancel>
            <Button
              type="button"
              onClick={deleteAccount}
              disabled={Boolean(deletingAccountId)}
              className="bg-error text-white hover:bg-error/90"
            >
              {deletingAccountId
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Trash2 className="h-4 w-4" />}
              {deletingAccountId ? 'Excluindo...' : 'Excluir conta e dados'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
