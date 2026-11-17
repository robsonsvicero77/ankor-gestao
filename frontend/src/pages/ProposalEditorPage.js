import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, Download, Loader2, Plus, Trash2 } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { proposalsApi, settingsApi } from '../lib/api';
import { downloadProposalPdf } from '../lib/proposalPdf';
import { PROPOSAL_STATUSES } from './ProposalsPage';
import { DEFAULT_PROVIDER, getProviderDefaults } from '../lib/contractUtils';

const DEFAULT_SECTION_TITLES = [
  'Apresentação',
  'Objetivos do projeto',
  'Escopo dos serviços',
  'Entregáveis',
  'Etapas de execução',
  'Investimento',
  'Condições de pagamento',
  'Prazo estimado',
  'Responsabilidades do cliente',
  'Itens não incluídos',
  'Critérios de aprovação',
  'Aceite',
];

let nextSectionId = 0;

function createSection(title = '', body = '') {
  nextSectionId += 1;
  return { id: `proposal-section-${nextSectionId}`, title, body };
}

function parseAmount(value) {
  const normalized = String(value).trim().replace(/\s/g, '');
  const decimalValue = normalized.includes(',')
    ? normalized.replace(/\./g, '').replace(',', '.')
    : normalized;
  return decimalValue === '' ? NaN : Number(decimalValue);
}

function dateInputValue(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function initialForm() {
  const today = new Date();
  const validUntil = new Date(today);
  validUntil.setDate(validUntil.getDate() + 15);
  return {
    title: '',
    client_name: '',
    contact_name: '',
    issue_date: dateInputValue(today),
    valid_until: dateInputValue(validUntil),
    amount: '',
    status: 'RASCUNHO',
    city: '',
    sections: DEFAULT_SECTION_TITLES.map((title) => createSection(title)),
  };
}

function getErrorMessage(error, fallback) {
  const detail = error.response?.data?.detail;
  return (typeof detail === 'string' && detail) || error.message || fallback;
}

export function ProposalEditorPage() {
  const { proposalId } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(proposalId);
  const [form, setForm] = useState(initialForm);
  const [provider, setProvider] = useState({ ...DEFAULT_PROVIDER });
  const [settingsWarning, setSettingsWarning] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const loadProposal = useCallback(async () => {
    setLoading(true);
    setError('');
    setSettingsWarning('');
    try {
      let proposal = null;
      if (proposalId) {
        const response = await proposalsApi.get(proposalId);
        proposal = response.data;
      }

      let providerDefaults = { ...DEFAULT_PROVIDER };
      try {
        const settingsResponse = await settingsApi.get();
        providerDefaults = getProviderDefaults(
          settingsResponse.data.provider,
          settingsResponse.data.provider_configured,
        );
      } catch (settingsError) {
        setSettingsWarning(
          getErrorMessage(settingsError, 'Não foi possível carregar os dados profissionais salvos.'),
        );
      }

      if (proposal) {
        const sections = proposal.content?.sections?.length
          ? proposal.content.sections
          : DEFAULT_SECTION_TITLES.map((title) => ({ title, body: '' }));
        setForm({
          title: proposal.title,
          client_name: proposal.client_name,
          contact_name: proposal.contact_name || '',
          issue_date: proposal.issue_date.slice(0, 10),
          valid_until: proposal.valid_until.slice(0, 10),
          amount: (proposal.amount_cents / 100).toFixed(2),
          status: proposal.status,
          city: proposal.content?.city || '',
          sections: sections.map((section) => createSection(section.title, section.body || '')),
        });
      }
      setProvider(proposal?.content?.provider || providerDefaults);
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Não foi possível carregar esta proposta.'));
    } finally {
      setLoading(false);
    }
  }, [proposalId]);

  useEffect(() => {
    loadProposal();
  }, [loadProposal]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateSection = (index, field, value) => {
    setForm((current) => ({
      ...current,
      sections: current.sections.map((section, sectionIndex) => (
        sectionIndex === index ? { ...section, [field]: value } : section
      )),
    }));
  };

  const moveSection = (index, offset) => {
    setForm((current) => {
      const destination = index + offset;
      if (destination < 0 || destination >= current.sections.length) return current;
      const sections = [...current.sections];
      [sections[index], sections[destination]] = [sections[destination], sections[index]];
      return { ...current, sections };
    });
  };

  const removeSection = (index) => {
    setForm((current) => ({
      ...current,
      sections: current.sections.filter((_, sectionIndex) => sectionIndex !== index),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    const amount = parseAmount(form.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Informe um investimento válido, igual ou maior que zero.');
      return;
    }
    if (form.valid_until < form.issue_date) {
      setError('A validade não pode ser anterior à data de emissão.');
      return;
    }
    if (form.sections.some((section) => !section.title.trim())) {
      setError('Preencha o título de cada seção ou remova a seção vazia.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        client_name: form.client_name.trim(),
        contact_name: form.contact_name.trim() || null,
        issue_date: form.issue_date,
        valid_until: form.valid_until,
        amount_cents: Math.round(amount * 100),
        status: form.status,
        content: {
          city: form.city.trim() || null,
          provider,
          sections: form.sections.map((section) => ({
            title: section.title.trim(),
            body: section.body,
          })),
        },
      };

      if (isEditing) {
        await proposalsApi.update(proposalId, payload);
      } else {
        await proposalsApi.create(payload);
      }
      navigate('/proposals');
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Não foi possível salvar a proposta.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async () => {
    setError('');
    const amount = parseAmount(form.amount);
    if (!form.title.trim() || !form.client_name.trim() || !Number.isFinite(amount) || amount < 0) {
      setError('Preencha o título, o cliente e um investimento válido antes de gerar o PDF.');
      return;
    }
    if (form.valid_until < form.issue_date) {
      setError('A validade não pode ser anterior à data de emissão.');
      return;
    }
    setDownloading(true);
    try {
      await downloadProposalPdf({
        ...form,
        amount_cents: Math.round(amount * 100),
        content: {
          city: form.city.trim() || null,
          provider,
          sections: form.sections.map((section) => ({
            title: section.title.trim(),
            body: section.body,
          })),
        },
      });
    } catch (pdfError) {
      setError(getErrorMessage(pdfError, 'Não foi possível gerar o PDF.'));
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex min-h-64 items-center justify-center text-zinc-400" role="status">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-500" />
          Carregando proposta...
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-6 selection:bg-emerald-500/30 selection:text-emerald-100" data-testid="proposal-editor-page">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate('/proposals')}
              className="-ml-3 mb-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar às propostas
            </Button>
            <h1 className="text-2xl font-bold text-white lg:text-3xl">
              {isEditing ? 'Editar proposta' : 'Nova proposta'}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Preencha os dados e organize o conteúdo na ordem do documento final.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleDownload}
            disabled={downloading}
            className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
          >
            {downloading
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <Download className="mr-2 h-4 w-4" />}
            Baixar PDF
          </Button>
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}
        {settingsWarning && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" role="status">
            {settingsWarning} O PDF usará os dados padrão atuais; revise-os em Configurações.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <section className="space-y-5 rounded-xl border border-zinc-800 bg-[#18181b] p-5 sm:p-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Identificação e condições</h2>
              <p className="mt-1 text-sm text-zinc-400">Esses dados aparecem no cabeçalho da proposta.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="proposal-title" className="text-zinc-300">Título da proposta *</Label>
                <Input
                  id="proposal-title"
                  value={form.title}
                  onChange={(event) => updateField('title', event.target.value)}
                  required
                  maxLength={200}
                  placeholder="Ex.: Desenvolvimento do projeto"
                  className="border-zinc-700 bg-zinc-900 text-white caret-emerald-400 placeholder:text-zinc-400"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proposal-client" className="text-zinc-300">Cliente *</Label>
                <Input
                  id="proposal-client"
                  value={form.client_name}
                  onChange={(event) => updateField('client_name', event.target.value)}
                  required
                  maxLength={200}
                  autoComplete="organization"
                  className="border-zinc-700 bg-zinc-900 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proposal-contact" className="text-zinc-300">Pessoa de contato</Label>
                <Input
                  id="proposal-contact"
                  value={form.contact_name}
                  onChange={(event) => updateField('contact_name', event.target.value)}
                  maxLength={200}
                  autoComplete="name"
                  className="border-zinc-700 bg-zinc-900 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proposal-issued" className="text-zinc-300">Data de emissão *</Label>
                <Input
                  id="proposal-issued"
                  type="date"
                  value={form.issue_date}
                  onChange={(event) => updateField('issue_date', event.target.value)}
                  required
                  className="border-zinc-700 bg-zinc-900 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proposal-valid-until" className="text-zinc-300">Válida até *</Label>
                <Input
                  id="proposal-valid-until"
                  type="date"
                  value={form.valid_until}
                  onChange={(event) => updateField('valid_until', event.target.value)}
                  min={form.issue_date}
                  required
                  className="border-zinc-700 bg-zinc-900 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proposal-amount" className="text-zinc-300">Investimento total (R$) *</Label>
                <Input
                  id="proposal-amount"
                  value={form.amount}
                  onChange={(event) => updateField('amount', event.target.value)}
                  required
                  placeholder="0,00"
                  inputMode="decimal"
                  type="text"
                  autoComplete="off"
                  className="border-zinc-700 bg-zinc-900 text-white caret-emerald-400 placeholder:text-zinc-400"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proposal-status" className="text-zinc-300">Status *</Label>
                <select
                  id="proposal-status"
                  value={form.status}
                  onChange={(event) => updateField('status', event.target.value)}
                  className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/40"
                >
                  {PROPOSAL_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="proposal-city" className="text-zinc-300">Cidade para o fechamento (opcional)</Label>
                <Input
                  id="proposal-city"
                  value={form.city}
                  onChange={(event) => updateField('city', event.target.value)}
                  maxLength={120}
                  placeholder="Cidade"
                  className="border-zinc-700 bg-zinc-900 text-white caret-emerald-400 placeholder:text-zinc-400"
                />
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Conteúdo da proposta</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  As seções seguem a estrutura do modelo e podem ser reordenadas ou removidas.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setForm((current) => ({
                  ...current,
                  sections: [...current.sections, createSection()],
                }))}
                disabled={form.sections.length >= 30}
                className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar seção
              </Button>
            </div>

            {form.sections.map((section, index) => (
              <section key={section.id} className="space-y-3 border-t border-zinc-800 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Label htmlFor={`proposal-section-title-${index}`} className="text-base font-semibold text-white">
                    {section.title || 'Nova seção'}
                  </Label>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Mover seção ${index + 1} para cima`}
                      onClick={() => moveSection(index, -1)}
                      disabled={index === 0}
                      className="h-8 w-8 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Mover seção ${index + 1} para baixo`}
                      onClick={() => moveSection(index, 1)}
                      disabled={index === form.sections.length - 1}
                      className="h-8 w-8 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remover seção ${index + 1}`}
                      onClick={() => removeSection(index)}
                      className="h-8 w-8 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Input
                  id={`proposal-section-title-${index}`}
                  value={section.title}
                  onChange={(event) => updateSection(index, 'title', event.target.value)}
                  required
                  maxLength={160}
                  aria-label={`Título da seção ${index + 1}`}
                  placeholder="Título da seção"
                  className="border-zinc-700 bg-zinc-900 text-white caret-emerald-400 placeholder:text-zinc-400"
                />
                <Textarea
                  value={section.body}
                  onChange={(event) => updateSection(index, 'body', event.target.value)}
                  aria-label={`Conteúdo da seção ${index + 1}: ${section.title || 'sem título'}`}
                  placeholder="Escreva o conteúdo desta seção. Para listas, inicie cada item com -."
                  rows={4}
                  maxLength={20000}
                  className="resize-y border-zinc-700 bg-zinc-900 text-white caret-emerald-400 placeholder:text-zinc-400"
                />
              </section>
            ))}
          </section>

          <div className="flex flex-col-reverse gap-3 border-t border-zinc-800 pt-5 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/proposals')}
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
              {submitting ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Salvar proposta'}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
