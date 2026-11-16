import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { clientsApi } from '../lib/api';
import { formatClientDocument, formatPostalCode } from '../lib/clientUtils';

const EMPTY_FORM = {
  person_type: 'PF',
  name: '',
  trade_name: '',
  document: '',
  email: '',
  phone: '',
  contact_name: '',
  postal_code: '',
  street: '',
  number: '',
  complement: '',
  district: '',
  city: '',
  state: '',
  notes: '',
};

function getErrorMessage(error, fallback) {
  const detail = error.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const firstMessage = detail.find((issue) => issue.msg)?.msg;
    if (firstMessage) return firstMessage.replace(/^Value error,\s*/, '');
  }
  return error.message || fallback;
}

function optionalValue(value) {
  const trimmed = value.trim();
  return trimmed || null;
}

export function ClientEditorPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(clientId);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(isEditing);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadClient = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setLoadError('');
    try {
      const response = await clientsApi.get(clientId);
      const client = response.data;
      setForm({
        ...EMPTY_FORM,
        ...client,
        document: formatClientDocument(client.document, client.person_type),
        postal_code: formatPostalCode(client.postal_code),
        trade_name: client.trade_name || '',
        email: client.email || '',
        phone: client.phone || '',
        contact_name: client.contact_name || '',
        street: client.street || '',
        number: client.number || '',
        complement: client.complement || '',
        district: client.district || '',
        city: client.city || '',
        state: client.state || '',
        notes: client.notes || '',
      });
    } catch (loadErrorValue) {
      setLoadError(getErrorMessage(loadErrorValue, 'Não foi possível carregar este cliente.'));
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadClient();
  }, [loadClient]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handlePersonTypeChange = (personType) => {
    setForm((current) => ({
      ...current,
      person_type: personType,
      document: '',
      trade_name: personType === 'PJ' ? current.trade_name : '',
      contact_name: personType === 'PJ' ? current.contact_name : '',
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    const payload = {
      ...form,
      name: form.name.trim(),
      trade_name: form.person_type === 'PJ' ? optionalValue(form.trade_name) : null,
      document: form.document,
      email: optionalValue(form.email),
      phone: optionalValue(form.phone),
      contact_name: form.person_type === 'PJ' ? optionalValue(form.contact_name) : null,
      postal_code: optionalValue(form.postal_code),
      street: optionalValue(form.street),
      number: optionalValue(form.number),
      complement: optionalValue(form.complement),
      district: optionalValue(form.district),
      city: optionalValue(form.city),
      state: optionalValue(form.state),
      notes: optionalValue(form.notes),
    };

    try {
      if (isEditing) {
        await clientsApi.update(clientId, payload);
      } else {
        await clientsApi.create(payload);
      }
      navigate('/clients');
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Não foi possível salvar o cliente.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex min-h-64 items-center justify-center text-zinc-400" role="status">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-500" />
          Carregando cliente...
        </div>
      </Layout>
    );
  }

  if (loadError) {
    return (
      <Layout>
        <div className="mx-auto max-w-4xl rounded-xl border border-rose-500/30 bg-rose-500/5 p-6 text-center">
          <p className="text-sm text-rose-200" role="alert">{loadError}</p>
          <div className="mt-4 flex justify-center gap-3">
            <Button onClick={() => navigate('/clients')} variant="outline" className="border-zinc-700 text-zinc-200 hover:bg-zinc-800">
              Voltar aos clientes
            </Button>
            <Button onClick={loadClient} variant="outline" className="border-zinc-700 text-zinc-200 hover:bg-zinc-800">
              Tentar novamente
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-6 selection:bg-emerald-500/30 selection:text-emerald-100" data-testid="client-editor-page">
        <header>
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate('/clients')}
            className="-ml-3 mb-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar aos clientes
          </Button>
          <h1 className="text-2xl font-bold text-white lg:text-3xl">
            {isEditing ? 'Editar cliente' : 'Novo cliente'}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Cadastre os dados de identificação, contato e endereço para reutilizar depois.
          </p>
        </header>

        {error && (
          <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <section className="space-y-5 rounded-xl border border-zinc-800 bg-[#18181b] p-5 sm:p-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Identificação</h2>
              <p className="mt-1 text-sm text-zinc-400">
                CPF ou CNPJ é obrigatório e será validado antes de salvar.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="client-person-type" className="text-zinc-300">Tipo de cliente *</Label>
                <select
                  id="client-person-type"
                  value={form.person_type}
                  onChange={(event) => handlePersonTypeChange(event.target.value)}
                  className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/40"
                >
                  <option value="PF">Pessoa física (PF)</option>
                  <option value="PJ">Pessoa jurídica (PJ)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-document" className="text-zinc-300">
                  {form.person_type === 'PF' ? 'CPF *' : 'CNPJ *'}
                </Label>
                <Input
                  id="client-document"
                  value={form.document}
                  onChange={(event) => updateField(
                    'document',
                    formatClientDocument(event.target.value, form.person_type),
                  )}
                  required
                  autoComplete="off"
                  inputMode={form.person_type === 'PF' ? 'numeric' : 'text'}
                  maxLength={form.person_type === 'PF' ? 14 : 18}
                  placeholder={form.person_type === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
                  className="border-zinc-700 bg-zinc-900 text-white caret-emerald-400 placeholder:text-zinc-500"
                />
              </div>
              <div className={`space-y-2 ${form.person_type === 'PJ' ? '' : 'sm:col-span-2'}`}>
                <Label htmlFor="client-name" className="text-zinc-300">
                  {form.person_type === 'PF' ? 'Nome completo *' : 'Razão social *'}
                </Label>
                <Input
                  id="client-name"
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  required
                  maxLength={200}
                  autoComplete={form.person_type === 'PF' ? 'name' : 'organization'}
                  className="border-zinc-700 bg-zinc-900 text-white caret-emerald-400"
                />
              </div>
              {form.person_type === 'PJ' && (
                <div className="space-y-2">
                  <Label htmlFor="client-trade-name" className="text-zinc-300">Nome fantasia</Label>
                  <Input
                    id="client-trade-name"
                    value={form.trade_name}
                    onChange={(event) => updateField('trade_name', event.target.value)}
                    maxLength={200}
                    autoComplete="organization-title"
                    className="border-zinc-700 bg-zinc-900 text-white caret-emerald-400"
                  />
                </div>
              )}
            </div>
          </section>

          <section className="space-y-5 border-t border-zinc-800 pt-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Contato</h2>
              <p className="mt-1 text-sm text-zinc-400">Use os canais principais para falar com este cliente.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {form.person_type === 'PJ' && (
                <div className="space-y-2">
                  <Label htmlFor="client-contact-name" className="text-zinc-300">Pessoa de contato</Label>
                  <Input
                    id="client-contact-name"
                    value={form.contact_name}
                    onChange={(event) => updateField('contact_name', event.target.value)}
                    maxLength={200}
                    autoComplete="name"
                    className="border-zinc-700 bg-zinc-900 text-white caret-emerald-400"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="client-email" className="text-zinc-300">E-mail</Label>
                <Input
                  id="client-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  maxLength={254}
                  autoComplete="email"
                  className="border-zinc-700 bg-zinc-900 text-white caret-emerald-400"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-phone" className="text-zinc-300">Telefone</Label>
                <Input
                  id="client-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(event) => updateField('phone', event.target.value)}
                  maxLength={30}
                  autoComplete="tel"
                  placeholder="(00) 00000-0000"
                  className="border-zinc-700 bg-zinc-900 text-white caret-emerald-400 placeholder:text-zinc-500"
                />
              </div>
            </div>
          </section>

          <section className="space-y-5 border-t border-zinc-800 pt-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Endereço</h2>
              <p className="mt-1 text-sm text-zinc-400">Todos os campos de endereço são opcionais.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-6">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="client-postal-code" className="text-zinc-300">CEP</Label>
                <Input
                  id="client-postal-code"
                  value={form.postal_code}
                  onChange={(event) => updateField('postal_code', formatPostalCode(event.target.value))}
                  inputMode="numeric"
                  maxLength={9}
                  autoComplete="postal-code"
                  placeholder="00000-000"
                  className="border-zinc-700 bg-zinc-900 text-white caret-emerald-400 placeholder:text-zinc-500"
                />
              </div>
              <div className="space-y-2 sm:col-span-4">
                <Label htmlFor="client-street" className="text-zinc-300">Logradouro</Label>
                <Input
                  id="client-street"
                  value={form.street}
                  onChange={(event) => updateField('street', event.target.value)}
                  maxLength={200}
                  autoComplete="address-line1"
                  className="border-zinc-700 bg-zinc-900 text-white caret-emerald-400"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="client-number" className="text-zinc-300">Número</Label>
                <Input
                  id="client-number"
                  value={form.number}
                  onChange={(event) => updateField('number', event.target.value)}
                  maxLength={30}
                  autoComplete="address-line2"
                  className="border-zinc-700 bg-zinc-900 text-white caret-emerald-400"
                />
              </div>
              <div className="space-y-2 sm:col-span-4">
                <Label htmlFor="client-complement" className="text-zinc-300">Complemento</Label>
                <Input
                  id="client-complement"
                  value={form.complement}
                  onChange={(event) => updateField('complement', event.target.value)}
                  maxLength={120}
                  className="border-zinc-700 bg-zinc-900 text-white caret-emerald-400"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="client-district" className="text-zinc-300">Bairro</Label>
                <Input
                  id="client-district"
                  value={form.district}
                  onChange={(event) => updateField('district', event.target.value)}
                  maxLength={120}
                  autoComplete="address-level3"
                  className="border-zinc-700 bg-zinc-900 text-white caret-emerald-400"
                />
              </div>
              <div className="space-y-2 sm:col-span-3">
                <Label htmlFor="client-city" className="text-zinc-300">Cidade</Label>
                <Input
                  id="client-city"
                  value={form.city}
                  onChange={(event) => updateField('city', event.target.value)}
                  maxLength={120}
                  autoComplete="address-level2"
                  className="border-zinc-700 bg-zinc-900 text-white caret-emerald-400"
                />
              </div>
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="client-state" className="text-zinc-300">UF</Label>
                <Input
                  id="client-state"
                  value={form.state}
                  onChange={(event) => updateField('state', event.target.value.toUpperCase().slice(0, 2))}
                  maxLength={2}
                  autoComplete="address-level1"
                  className="border-zinc-700 bg-zinc-900 text-white caret-emerald-400"
                />
              </div>
            </div>
          </section>

          <section className="space-y-4 border-t border-zinc-800 pt-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Observações</h2>
              <p className="mt-1 text-sm text-zinc-400">Anotações internas sobre o relacionamento com o cliente.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-notes" className="text-zinc-300">Anotações</Label>
              <Textarea
                id="client-notes"
                value={form.notes}
                onChange={(event) => updateField('notes', event.target.value)}
                maxLength={3000}
                rows={4}
                className="resize-y border-zinc-700 bg-zinc-900 text-white caret-emerald-400 placeholder:text-zinc-400"
              />
            </div>
          </section>

          <div className="flex flex-col-reverse gap-3 border-t border-zinc-800 pt-5 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/clients')}
              className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitting ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Salvar cliente'}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
