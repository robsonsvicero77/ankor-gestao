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
import {
  amountToCents,
  DEFAULT_PROVIDER,
  formatCurrency,
  getProviderDefaults,
} from '../lib/contractUtils';

const DEFAULT_SECTION_DEFINITIONS = [
  { title: 'Apresentação' },
  { title: 'Objetivos do projeto' },
  { title: 'Escopo dos serviços' },
  { title: 'Entregáveis' },
  { title: 'Etapas de execução' },
  { title: 'Investimento e formas de pagamento', kind: 'financial' },
  { title: 'Prazo estimado' },
  { title: 'Responsabilidades do cliente' },
  { title: 'Itens não incluídos' },
  { title: 'Critérios de aprovação' },
  { title: 'Aceite' },
];

let nextSectionId = 0;
let nextPaymentId = 0;

function createSection(title = '', body = '', kind = 'text') {
  nextSectionId += 1;
  return { id: `proposal-section-${nextSectionId}`, title, body, kind };
}

function createPayment({ description = '', due_date = '', amount = '' } = {}) {
  nextPaymentId += 1;
  return {
    id: `proposal-payment-${nextPaymentId}`,
    description,
    due_date,
    amount,
  };
}

function createDefaultSections() {
  return DEFAULT_SECTION_DEFINITIONS.map(({ title, kind = 'text' }) => (
    createSection(title, '', kind)
  ));
}

function normalizeSectionTitle(title) {
  return String(title || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function loadProposalSections(sections) {
  if (!sections?.length) return createDefaultSections();

  const loadedSections = [];
  const financialBodies = [];
  let financialIndex = -1;
  let financialTitle = 'Investimento e formas de pagamento';

  sections.forEach((section) => {
    const normalizedTitle = normalizeSectionTitle(section.title);
    const legacyInvestment = normalizedTitle === 'investimento';
    const legacyPaymentTerms = normalizedTitle === 'condicoes de pagamento';
    const isFinancial = section.kind === 'financial' || legacyInvestment || legacyPaymentTerms;

    if (!isFinancial) {
      loadedSections.push(createSection(section.title, section.body || ''));
      return;
    }

    if (financialIndex === -1) financialIndex = loadedSections.length;
    if (section.kind === 'financial') {
      financialTitle = section.title || financialTitle;
      if (section.body?.trim()) financialBodies.push(section.body.trim());
    } else if (section.body?.trim()) {
      const label = legacyInvestment
        ? 'Observações sobre o investimento'
        : 'Condições de pagamento';
      financialBodies.push(`${label}:\n${section.body.trim()}`);
    }
  });

  if (financialIndex === -1) financialIndex = Math.min(5, loadedSections.length);
  loadedSections.splice(
    financialIndex,
    0,
    createSection(financialTitle, financialBodies.join('\n\n'), 'financial'),
  );
  return loadedSections;
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
    sections: createDefaultSections(),
    payment_schedule: [],
  };
}

function getErrorMessage(error, fallback) {
  const detail = error.response?.data?.detail;
  if (typeof detail === 'string' && detail) return detail;
  if (Array.isArray(detail)) {
    const firstMessage = detail.find((issue) => issue.msg)?.msg;
    if (firstMessage) return firstMessage.replace(/^Value error,\s*/, '');
  }
  return error.message || fallback;
}

function Field({ id, label, children, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor={id} className="text-text-secondary">{label}</Label>
      {children}
    </div>
  );
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
        setForm({
          title: proposal.title,
          client_name: proposal.client_name,
          contact_name: proposal.contact_name || '',
          issue_date: proposal.issue_date.slice(0, 10),
          valid_until: proposal.valid_until.slice(0, 10),
          amount: (proposal.amount_cents / 100).toFixed(2),
          status: proposal.status,
          city: proposal.content?.city || '',
          sections: loadProposalSections(proposal.content?.sections),
          payment_schedule: (proposal.content?.payment_schedule || []).map((payment) => (
            createPayment({
              description: payment.description,
              due_date: payment.due_date.slice(0, 10),
              amount: (payment.amount_cents / 100).toFixed(2),
            })
          )),
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

  const investmentCents = amountToCents(form.amount);
  const paymentAmounts = form.payment_schedule.map((payment) => amountToCents(payment.amount));
  const paymentAmountsValid = paymentAmounts.every((amount) => (
    Number.isSafeInteger(amount) && amount >= 0
  ));
  const scheduledAmountCents = paymentAmounts.reduce(
    (total, amount) => total + (Number.isSafeInteger(amount) && amount >= 0 ? amount : 0),
    0,
  );
  const paymentTotalIsSafe = Number.isSafeInteger(scheduledAmountCents);
  const paymentScheduleMatches = Number.isSafeInteger(investmentCents)
    && paymentAmountsValid
    && paymentTotalIsSafe
    && scheduledAmountCents === investmentCents;
  const paymentScheduleStatus = !Number.isSafeInteger(investmentCents)
    ? 'Informe o investimento para conferir a soma.'
    : !paymentAmountsValid || !paymentTotalIsSafe
      ? 'Confira os valores das parcelas para calcular a soma.'
      : paymentScheduleMatches
        ? 'A soma das parcelas corresponde ao investimento.'
        : scheduledAmountCents < investmentCents
          ? `Faltam ${formatCurrency(investmentCents - scheduledAmountCents)} para atingir o investimento.`
          : `As parcelas excedem o investimento em ${formatCurrency(scheduledAmountCents - investmentCents)}.`;

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

  const addPayment = () => {
    setForm((current) => ({
      ...current,
      payment_schedule: [
        ...current.payment_schedule,
        createPayment({ description: `Parcela ${current.payment_schedule.length + 1}` }),
      ],
    }));
  };

  const removePayment = (index) => {
    setForm((current) => ({
      ...current,
      payment_schedule: current.payment_schedule.filter((_, paymentIndex) => (
        paymentIndex !== index
      )),
    }));
  };

  const updatePayment = (index, field, value) => {
    setForm((current) => ({
      ...current,
      payment_schedule: current.payment_schedule.map((payment, paymentIndex) => (
        paymentIndex === index ? { ...payment, [field]: value } : payment
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

  const prepareProposal = () => {
    setError('');
    const amountCents = amountToCents(form.amount);
    if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
      setError('Informe um investimento válido, igual ou maior que zero.');
      return null;
    }
    if (!form.title.trim() || !form.client_name.trim()) {
      setError('Preencha o título e o cliente antes de continuar.');
      return null;
    }
    if (!form.issue_date || !form.valid_until) {
      setError('Informe as datas de emissão e validade.');
      return null;
    }
    if (form.valid_until < form.issue_date) {
      setError('A validade não pode ser anterior à data de emissão.');
      return null;
    }
    if (form.sections.some((section) => !section.title.trim())) {
      setError('Preencha o título de cada seção ou remova a seção vazia.');
      return null;
    }

    const payments = form.payment_schedule.map((payment) => ({
      description: payment.description.trim(),
      due_date: payment.due_date,
      amount_cents: amountToCents(payment.amount),
    }));
    if (payments.some((payment) => (
      !payment.description
      || !payment.due_date
      || !Number.isSafeInteger(payment.amount_cents)
      || payment.amount_cents < 0
    ))) {
      setError('Preencha a descrição, o vencimento e um valor válido em cada parcela.');
      return null;
    }
    if (payments.length) {
      const paymentTotalCents = payments.reduce((total, payment) => (
        total + payment.amount_cents
      ), 0);
      if (!Number.isSafeInteger(paymentTotalCents) || paymentTotalCents !== amountCents) {
        setError('A soma das parcelas deve corresponder ao investimento total.');
        return null;
      }
    }

    return {
      title: form.title.trim(),
      client_name: form.client_name.trim(),
      contact_name: form.contact_name.trim() || null,
      issue_date: form.issue_date,
      valid_until: form.valid_until,
      amount_cents: amountCents,
      status: form.status,
      content: {
        city: form.city.trim() || null,
        provider,
        payment_schedule: payments,
        sections: form.sections.map((section) => ({
          title: section.title.trim(),
          body: section.body,
          kind: section.kind,
        })),
      },
    };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = prepareProposal();
    if (!payload) return;

    setSubmitting(true);
    try {
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
    const proposal = prepareProposal();
    if (!proposal) return;

    setDownloading(true);
    try {
      await downloadProposalPdf(proposal);
    } catch (pdfError) {
      setError(getErrorMessage(pdfError, 'Não foi possível gerar o PDF.'));
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex min-h-64 items-center justify-center text-text-secondary" role="status">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-brand-primary" />
          Carregando proposta...
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-6 selection:bg-brand-light selection:text-brand-primary" data-testid="proposal-editor-page">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate('/proposals')}
              className="-ml-3 mb-2 text-text-secondary hover:bg-surface-alt hover:text-text-primary"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar às propostas
            </Button>
            <h1 className="text-2xl font-bold text-text-primary lg:text-3xl">
              {isEditing ? 'Editar proposta' : 'Nova proposta'}
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Preencha os dados e organize o conteúdo na ordem do documento final.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleDownload}
            disabled={downloading}
            className="border-border text-text-secondary hover:bg-surface-alt"
          >
            {downloading
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <Download className="mr-2 h-4 w-4" />}
            Baixar PDF
          </Button>
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-error/30 bg-error-background px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}
        {settingsWarning && (
          <div className="rounded-lg border border-warning/30 bg-warning-background px-4 py-3 text-sm text-text-primary" role="status">
            {settingsWarning} O PDF usará os dados padrão atuais; revise-os em Configurações.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <section className="space-y-5 rounded-xl border border-border bg-surface p-5 sm:p-6">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Identificação e condições</h2>
              <p className="mt-1 text-sm text-text-secondary">Esses dados aparecem no cabeçalho da proposta.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="proposal-title" className="text-text-secondary">Título da proposta *</Label>
                <Input
                  id="proposal-title"
                  value={form.title}
                  onChange={(event) => updateField('title', event.target.value)}
                  required
                  maxLength={200}
                  placeholder="Ex.: Desenvolvimento do projeto"
                  className="border-border bg-surface text-text-primary caret-brand-primary placeholder:text-text-secondary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proposal-client" className="text-text-secondary">Cliente *</Label>
                <Input
                  id="proposal-client"
                  value={form.client_name}
                  onChange={(event) => updateField('client_name', event.target.value)}
                  required
                  maxLength={200}
                  autoComplete="organization"
                  className="border-border bg-surface text-text-primary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proposal-contact" className="text-text-secondary">Pessoa de contato</Label>
                <Input
                  id="proposal-contact"
                  value={form.contact_name}
                  onChange={(event) => updateField('contact_name', event.target.value)}
                  maxLength={200}
                  autoComplete="name"
                  className="border-border bg-surface text-text-primary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proposal-issued" className="text-text-secondary">Data de emissão *</Label>
                <Input
                  id="proposal-issued"
                  type="date"
                  value={form.issue_date}
                  onChange={(event) => updateField('issue_date', event.target.value)}
                  required
                  className="border-border bg-surface text-text-primary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proposal-valid-until" className="text-text-secondary">Válida até *</Label>
                <Input
                  id="proposal-valid-until"
                  type="date"
                  value={form.valid_until}
                  onChange={(event) => updateField('valid_until', event.target.value)}
                  min={form.issue_date}
                  required
                  className="border-border bg-surface text-text-primary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proposal-status" className="text-text-secondary">Status *</Label>
                <select
                  id="proposal-status"
                  value={form.status}
                  onChange={(event) => updateField('status', event.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-focus"
                >
                  {PROPOSAL_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="proposal-city" className="text-text-secondary">Cidade para o fechamento (opcional)</Label>
                <Input
                  id="proposal-city"
                  value={form.city}
                  onChange={(event) => updateField('city', event.target.value)}
                  maxLength={120}
                  placeholder="Cidade"
                  className="border-border bg-surface text-text-primary caret-brand-primary placeholder:text-text-secondary"
                />
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Conteúdo da proposta</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  As seções seguem o modelo e podem ser reordenadas; a seção financeira é fixa.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setForm((current) => ({
                  ...current,
                  sections: [...current.sections, createSection()],
                }))}
                disabled={form.sections.length >= 31}
                className="border-border text-text-secondary hover:bg-surface-alt"
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar seção
              </Button>
            </div>

            {form.sections.map((section, index) => (
              <section key={section.id} className="space-y-3 border-t border-border pt-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Label htmlFor={`proposal-section-title-${index}`} className="text-base font-semibold text-text-primary">
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
                      className="h-8 w-8 text-text-secondary hover:bg-surface-alt hover:text-text-primary"
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
                      className="h-8 w-8 text-text-secondary hover:bg-surface-alt hover:text-text-primary"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    {section.kind !== 'financial' && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remover seção ${index + 1}`}
                        onClick={() => removeSection(index)}
                        className="h-8 w-8 text-text-secondary hover:bg-error-background hover:text-error"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
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
                  className="border-border bg-surface text-text-primary caret-brand-primary placeholder:text-text-secondary"
                />
                {section.kind === 'financial' ? (
                  <div className="space-y-5 rounded-xl border border-success/30 bg-surface p-5 sm:p-6">
                    <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
                      <Field id="proposal-amount" label="Investimento total (R$) *">
                        <Input
                          id="proposal-amount"
                          value={form.amount}
                          onChange={(event) => updateField('amount', event.target.value)}
                          required
                          placeholder="0,00"
                          inputMode="decimal"
                          type="text"
                          autoComplete="off"
                          className="border-border bg-surface text-right tabular-nums text-text-primary caret-brand-primary placeholder:text-text-secondary"
                        />
                      </Field>
                      <p className="pb-2 text-sm leading-6 text-text-secondary">
                        A agenda é opcional e, quando preenchida, deve somar o investimento.
                        Ela não cria recebíveis; isso acontece somente nos contratos assinados.
                      </p>
                    </div>

                    <div className="space-y-4 border-t border-border pt-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-base font-semibold text-text-primary">Formas de pagamento</h3>
                          <p className="mt-1 text-sm text-text-secondary">
                            Descreva cada parcela e informe seu vencimento previsto.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={addPayment}
                          disabled={form.payment_schedule.length >= 24}
                          className="shrink-0 border-border text-text-secondary hover:bg-surface-alt"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Adicionar parcela
                        </Button>
                      </div>

                      {form.payment_schedule.length ? (
                        <div className="space-y-3">
                          {form.payment_schedule.map((payment, paymentIndex) => (
                            <div
                              key={payment.id}
                              className="grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(10rem,1fr)_minmax(9rem,0.8fr)_auto] sm:items-end"
                            >
                              <Field
                                id={`proposal-payment-description-${paymentIndex}`}
                                label={`Parcela ${paymentIndex + 1}`}
                              >
                                <Input
                                  id={`proposal-payment-description-${paymentIndex}`}
                                  value={payment.description}
                                  onChange={(event) => updatePayment(paymentIndex, 'description', event.target.value)}
                                  maxLength={200}
                                  required
                                  placeholder="Ex.: Entrada"
                                  className="border-border bg-surface text-text-primary caret-brand-primary"
                                />
                              </Field>
                              <Field
                                id={`proposal-payment-date-${paymentIndex}`}
                                label="Vencimento"
                              >
                                <Input
                                  id={`proposal-payment-date-${paymentIndex}`}
                                  type="date"
                                  value={payment.due_date}
                                  onChange={(event) => updatePayment(paymentIndex, 'due_date', event.target.value)}
                                  required
                                  className="border-border bg-surface text-text-primary"
                                />
                              </Field>
                              <Field
                                id={`proposal-payment-amount-${paymentIndex}`}
                                label="Valor (R$)"
                              >
                                <Input
                                  id={`proposal-payment-amount-${paymentIndex}`}
                                  value={payment.amount}
                                  onChange={(event) => updatePayment(paymentIndex, 'amount', event.target.value)}
                                  placeholder="0,00"
                                  required
                                  inputMode="decimal"
                                  autoComplete="off"
                                  className="border-border bg-surface text-right tabular-nums text-text-primary caret-brand-primary placeholder:text-text-secondary"
                                />
                              </Field>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Remover parcela ${paymentIndex + 1}`}
                                onClick={() => removePayment(paymentIndex)}
                                className="h-10 w-10 text-text-secondary hover:bg-error-background hover:text-error"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
                          <p className="text-sm text-text-secondary">Nenhuma parcela adicionada.</p>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={addPayment}
                            className="mt-3 border-border text-text-secondary hover:bg-surface-alt"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Adicionar primeira parcela
                          </Button>
                        </div>
                      )}

                      <div className="space-y-3 border-t border-border pt-4" aria-live="polite">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                          <p className="text-sm text-text-secondary">
                            {form.payment_schedule.length}{' '}
                            {form.payment_schedule.length === 1 ? 'parcela' : 'parcelas'}
                          </p>
                          <div className="grid grid-cols-2 gap-6 text-right">
                            <div>
                              <span className="block text-xs text-text-secondary">Investimento</span>
                              <span className="mt-1 block font-medium tabular-nums text-text-secondary">
                                {Number.isSafeInteger(investmentCents) ? formatCurrency(investmentCents) : '—'}
                              </span>
                            </div>
                            <div>
                              <span className="block text-xs text-text-secondary">Soma das parcelas</span>
                              <span className="mt-1 block text-xl font-semibold tabular-nums text-text-primary">
                                {paymentAmountsValid && paymentTotalIsSafe
                                  ? formatCurrency(scheduledAmountCents)
                                  : '—'}
                              </span>
                            </div>
                          </div>
                        </div>
                        {form.payment_schedule.length > 0 && (
                          <p className={`text-right text-sm ${paymentScheduleMatches ? 'text-success' : 'text-text-primary'}`} role="status">
                            {paymentScheduleStatus}
                          </p>
                        )}
                      </div>
                    </div>

                    <Field
                      id={`proposal-financial-notes-${index}`}
                      label="Observações sobre investimento e pagamento"
                      className="border-t border-border pt-4"
                    >
                      <Textarea
                        id={`proposal-financial-notes-${index}`}
                        value={section.body}
                        onChange={(event) => updateSection(index, 'body', event.target.value)}
                        placeholder="Condições adicionais não representadas pelas parcelas."
                        rows={3}
                        maxLength={20000}
                        className="resize-y border-border bg-surface text-text-primary caret-brand-primary placeholder:text-text-secondary"
                      />
                    </Field>
                  </div>
                ) : (
                  <Textarea
                    value={section.body}
                    onChange={(event) => updateSection(index, 'body', event.target.value)}
                    aria-label={`Conteúdo da seção ${index + 1}: ${section.title || 'sem título'}`}
                    placeholder="Escreva o conteúdo desta seção. Para listas, inicie cada item com -."
                    rows={4}
                    maxLength={20000}
                    className="resize-y border-border bg-surface text-text-primary caret-brand-primary placeholder:text-text-secondary"
                  />
                )}
              </section>
            ))}
          </section>

          <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/proposals')}
              className="border-border text-text-secondary hover:bg-surface-alt"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-brand-primary text-text-inverse hover:bg-brand-hover"
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
