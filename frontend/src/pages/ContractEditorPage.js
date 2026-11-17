import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { clientsApi, contractsApi } from '../lib/api';
import { downloadContractPdf } from '../lib/contractPdf';
import {
  amountToCents,
  CONTRACT_SERVICE_TYPES,
  CONTRACT_STATUSES,
  DEFAULT_PROVIDER,
  dateInputValue,
  formatCurrency,
  getClientAddress,
  getClientSnapshot,
} from '../lib/contractUtils';

const DEFAULT_CLAUSES = [
  {
    title: 'CLÁUSULA 1ª – DO OBJETO',
    body: 'O presente contrato tem como objeto a prestação dos serviços descritos em Objeto e Escopo, conforme proposta comercial previamente apresentada e aceita, que poderá integrar este instrumento como Anexo I.',
  },
  {
    title: 'CLÁUSULA 2ª – DO ESCOPO DOS SERVIÇOS',
    body: 'Os serviços e entregáveis incluídos são os descritos neste contrato. Qualquer serviço não descrito expressamente neste instrumento ou no Anexo I será considerado adicional, devendo ser previamente orçado e aprovado pela CONTRATANTE.',
  },
  {
    title: 'CLÁUSULA 3ª – DO PRAZO',
    body: 'O prazo de execução será contado a partir da data de início prevista, condicionado ao envio das informações, materiais e aprovações necessárias pela CONTRATANTE. Atrasos decorrentes da falta desses itens suspendem os prazos até a regularização.',
  },
  {
    title: 'CLÁUSULA 4ª – DO INVESTIMENTO E FORMA DE PAGAMENTO',
    body: 'Pelos serviços descritos neste contrato, a CONTRATANTE pagará à CONTRATADA o valor total indicado na agenda de pagamentos. O não pagamento de qualquer parcela na data acordada poderá acarretar a suspensão dos serviços até a regularização.',
  },
  {
    title: 'CLÁUSULA 5ª – DAS OBRIGAÇÕES DA CONTRATADA',
    body: 'A CONTRATADA compromete-se a executar os serviços com zelo técnico, profissionalismo e boas práticas de mercado, mantendo comunicação clara sobre o andamento do projeto e observando o escopo acordado.',
  },
  {
    title: 'CLÁUSULA 6ª – DAS OBRIGAÇÕES DA CONTRATANTE',
    body: 'A CONTRATANTE compromete-se a fornecer as informações, textos, imagens e aprovações necessárias à execução do projeto e a realizar os pagamentos nas condições e prazos acordados.',
  },
  {
    title: 'CLÁUSULA 7ª – DA PROPRIEDADE INTELECTUAL',
    body: 'Após a quitação integral dos valores previstos neste contrato, a CONTRATANTE terá direito de uso dos entregáveis finais produzidos especificamente para o projeto. A CONTRATADA poderá exibir o projeto em seu portfólio profissional, sites e redes sociais para fins institucionais e promocionais.',
  },
  {
    title: 'CLÁUSULA 8ª – DA CONFIDENCIALIDADE',
    body: 'Ambas as partes comprometem-se a manter sigilo sobre informações comerciais, estratégicas ou técnicas obtidas em razão deste contrato.',
  },
  {
    title: 'CLÁUSULA 9ª – DA RESCISÃO',
    body: 'O presente contrato poderá ser rescindido por qualquer das partes mediante aviso prévio por escrito de 30 (trinta) dias. Em caso de rescisão antecipada, os valores já pagos não serão reembolsáveis, considerando o caráter intelectual e personalizado dos serviços.',
  },
  {
    title: 'CLÁUSULA 10ª – DAS DISPOSIÇÕES GERAIS',
    body: 'Este contrato não gera vínculo empregatício entre as partes. A tolerância quanto ao descumprimento de qualquer cláusula não implica renúncia de direito.',
  },
  {
    title: 'CLÁUSULA 11ª – DO FORO',
    body: 'Para dirimir controvérsias oriundas deste contrato, as partes elegem o foro da comarca de São Paulo/SP, renunciando a qualquer outro, por mais privilegiado que seja.',
  },
];

let nextRowId = 0;

function createRow(values = {}) {
  nextRowId += 1;
  return { id: `contract-row-${nextRowId}`, ...values };
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonth(dateValue) {
  const date = new Date(`${dateValue}T12:00:00`);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return dateInputValue(date);
}

function initialForm() {
  const today = new Date();
  return {
    title: '',
    client_id: '',
    issue_date: dateInputValue(today),
    start_date: dateInputValue(today),
    end_date: '',
    status: 'RASCUNHO',
    service_types: [],
    custom_service: '',
    object_description: '',
    scope: '',
    deliverables: '',
    timeline_notes: '',
    client_representative: '',
    contract_city: 'São Paulo/SP',
    provider: { ...DEFAULT_PROVIDER },
    payment_schedule: [
      createRow({
        description: 'Entrada',
        due_date: dateInputValue(addDays(today, 7)),
        amount: '',
      }),
    ],
    clauses: DEFAULT_CLAUSES.map((clause) => createRow(clause)),
  };
}

function getErrorMessage(error, fallback) {
  const detail = error.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const firstMessage = detail.find((issue) => issue.msg)?.msg;
    if (firstMessage) return firstMessage.replace(/^Value error,\s*/, '');
  }
  return error.message || fallback;
}

function clientRepresentative(client) {
  if (!client) return '';
  return client.person_type === 'PJ' ? client.contact_name || '' : client.name;
}

function toFormValues(contract) {
  const content = contract.content || {};
  return {
    title: contract.title,
    client_id: contract.client_id,
    issue_date: contract.issue_date.slice(0, 10),
    start_date: contract.start_date.slice(0, 10),
    end_date: contract.end_date?.slice(0, 10) || '',
    status: contract.status,
    service_types: content.service_types || [],
    custom_service: content.custom_service || '',
    object_description: content.object_description || '',
    scope: content.scope || '',
    deliverables: content.deliverables || '',
    timeline_notes: content.timeline_notes || '',
    client_representative: content.client_representative || '',
    contract_city: content.contract_city || '',
    provider: { ...DEFAULT_PROVIDER, ...(content.provider || {}) },
    payment_schedule: (content.payment_schedule || []).map((payment) => createRow({
      ...payment,
      amount: (payment.amount_cents / 100).toFixed(2),
    })),
    clauses: (content.clauses || []).map((clause) => createRow(clause)),
  };
}

function formatDocument(document, personType) {
  if (!document) return 'Documento não informado';
  const digits = document.replace(/\D/g, '');
  if (personType === 'PF' && digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (personType === 'PJ' && digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return document;
}

function Field({ id, label, children, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor={id} className="text-zinc-300">{label}</Label>
      {children}
    </div>
  );
}

export function ContractEditorPage() {
  const { contractId } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(contractId);
  const [form, setForm] = useState(initialForm);
  const [clients, setClients] = useState([]);
  const [clientSnapshot, setClientSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setError('');
    try {
      const [clientsResponse, contractResponse] = await Promise.all([
        clientsApi.list(),
        contractId ? contractsApi.get(contractId) : Promise.resolve(null),
      ]);
      setClients(clientsResponse.data);
      if (contractResponse) {
        const contract = contractResponse.data;
        setForm(toFormValues(contract));
        setClientSnapshot(contract.client_snapshot);
      }
    } catch (loadError) {
      setLoadError(getErrorMessage(loadError, 'Não foi possível carregar os dados do contrato.'));
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateProvider = (field, value) => {
    setForm((current) => ({
      ...current,
      provider: { ...current.provider, [field]: value },
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

  const updateClause = (index, field, value) => {
    setForm((current) => ({
      ...current,
      clauses: current.clauses.map((clause, clauseIndex) => (
        clauseIndex === index ? { ...clause, [field]: value } : clause
      )),
    }));
  };

  const selectClient = (clientId) => {
    const client = clients.find((item) => item.id === clientId);
    updateField('client_id', clientId);
    setClientSnapshot(getClientSnapshot(client));
    if (client) updateField('client_representative', clientRepresentative(client));
  };

  const scheduleAmounts = useMemo(
    () => form.payment_schedule.map((payment) => amountToCents(payment.amount)),
    [form.payment_schedule],
  );
  const totalAmountCents = scheduleAmounts.reduce(
    (total, amount) => total + (Number.isFinite(amount) ? amount : 0),
    0,
  );

  const prepareContract = () => {
    setError('');
    if (!form.title.trim()) {
      setError('Informe o título do contrato.');
      return null;
    }
    if (!form.client_id || !clientSnapshot) {
      setError('Selecione um cliente cadastrado para continuar.');
      return null;
    }
    if (!form.issue_date || !form.start_date) {
      setError('Informe as datas de emissão e início.');
      return null;
    }
    if (form.end_date && form.end_date < form.start_date) {
      setError('A data final não pode ser anterior ao início.');
      return null;
    }
    if (!form.service_types.length) {
      setError('Selecione ao menos um tipo de serviço.');
      return null;
    }
    if (form.service_types.includes('Outro') && !form.custom_service.trim()) {
      setError('Descreva o serviço personalizado.');
      return null;
    }
    if (!form.object_description.trim() || !form.scope.trim()) {
      setError('Preencha o objeto e o escopo dos serviços.');
      return null;
    }
    if (form.payment_schedule.some((payment, index) => (
      !payment.description.trim()
      || !payment.due_date
      || !Number.isFinite(scheduleAmounts[index])
      || scheduleAmounts[index] < 0
    ))) {
      setError('Preencha a descrição, o vencimento e um valor válido em cada parcela, ou remova a linha vazia.');
      return null;
    }
    if (!form.clauses.length) {
      setError('Inclua ao menos uma cláusula no contrato.');
      return null;
    }
    if (form.clauses.some((clause) => !clause.title.trim())) {
      setError('Preencha o título de cada cláusula ou remova a cláusula vazia.');
      return null;
    }
    if (!form.provider.display_name.trim()) {
      setError('Informe o nome da contratada.');
      return null;
    }

    const payments = form.payment_schedule.map((payment, index) => ({
      description: payment.description.trim(),
      due_date: payment.due_date,
      amount_cents: scheduleAmounts[index],
    }));
    return {
      client_id: form.client_id,
      title: form.title.trim(),
      issue_date: form.issue_date,
      start_date: form.start_date,
      end_date: form.end_date || null,
      total_amount_cents: totalAmountCents,
      status: form.status,
      content: {
        service_types: form.service_types,
        custom_service: form.custom_service.trim() || null,
        object_description: form.object_description.trim(),
        scope: form.scope.trim(),
        deliverables: form.deliverables.trim() || null,
        timeline_notes: form.timeline_notes.trim() || null,
        client_representative: form.client_representative.trim() || null,
        contract_city: form.contract_city.trim() || null,
        provider: Object.fromEntries(
          Object.entries(form.provider).map(([key, value]) => [key, value.trim() || null]),
        ),
        payment_schedule: payments,
        clauses: form.clauses.map((clause) => ({
          title: clause.title.trim(),
          body: clause.body,
        })),
      },
    };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = prepareContract();
    if (!payload) return;

    setSubmitting(true);
    try {
      if (isEditing) {
        await contractsApi.update(contractId, payload);
      } else {
        await contractsApi.create(payload);
      }
      navigate('/contracts');
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Não foi possível salvar o contrato.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async () => {
    const payload = prepareContract();
    if (!payload) return;
    setDownloading(true);
    try {
      await downloadContractPdf({
        ...payload,
        client_snapshot: clientSnapshot,
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
          Carregando contrato...
        </div>
      </Layout>
    );
  }

  const selectedClient = clients.find((client) => client.id === form.client_id);

  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-6 selection:bg-emerald-500/30 selection:text-emerald-100" data-testid="contract-editor-page">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate('/contracts')}
              className="-ml-3 mb-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar aos contratos
            </Button>
            <h1 className="text-2xl font-bold text-white lg:text-3xl">
              {isEditing ? 'Editar contrato' : 'Novo contrato'}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-zinc-400">
              Vincule um cliente e defina escopo, parcelas e cláusulas para o serviço.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleDownload}
            disabled={downloading || loading}
            className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
          >
            {downloading
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <Download className="mr-2 h-4 w-4" />}
            Baixar PDF
          </Button>
        </header>

        {loadError && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-6 text-center">
            <p className="text-sm text-rose-200" role="alert">{loadError}</p>
            <Button
              type="button"
              onClick={loadData}
              variant="outline"
              className="mt-4 border-zinc-700 text-zinc-200 hover:bg-zinc-800"
            >
              Tentar novamente
            </Button>
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        {!loadError && !clients.length ? (
          <section className="rounded-xl border border-dashed border-zinc-700 px-5 py-12 text-center">
            <h2 className="text-lg font-semibold text-white">Cadastre um cliente primeiro</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
              Os dados da parte contratante são preenchidos a partir do cadastro de clientes.
            </p>
            <Button
              type="button"
              onClick={() => navigate('/clients/new')}
              className="mt-5 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Cadastrar cliente
            </Button>
          </section>
        ) : null}

        {!loadError && clients.length > 0 && (
          <form onSubmit={handleSubmit} className="space-y-7">
            <section className="space-y-5 rounded-xl border border-zinc-800 bg-[#18181b] p-5 sm:p-6">
              <div>
                <h2 className="text-lg font-semibold text-white">Identificação e cliente</h2>
                <p className="mt-1 text-sm text-zinc-400">Os dados do cliente são copiados do cadastro para este contrato.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="contract-title" label="Título do contrato *" className="sm:col-span-2">
                  <Input
                    id="contract-title"
                    value={form.title}
                    onChange={(event) => updateField('title', event.target.value)}
                    required
                    maxLength={200}
                    placeholder="Ex.: Desenvolvimento do site institucional"
                    className="border-zinc-700 bg-zinc-900 text-white caret-emerald-400 placeholder:text-zinc-400"
                  />
                </Field>
                <Field id="contract-client" label="Cliente *" className="sm:col-span-2">
                  <select
                    id="contract-client"
                    value={form.client_id}
                    onChange={(event) => selectClient(event.target.value)}
                    required
                    className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/40"
                  >
                    <option value="">Selecione um cliente cadastrado</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name} · {client.person_type} · {formatDocument(client.document, client.person_type)}
                      </option>
                    ))}
                  </select>
                </Field>

                {clientSnapshot && (
                  <div className="space-y-2 rounded-lg border border-zinc-700 bg-zinc-900/70 p-4 sm:col-span-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium text-white">{clientSnapshot.name}</p>
                      <span className="text-xs text-zinc-400">
                        {clientSnapshot.person_type} · {formatDocument(clientSnapshot.document, clientSnapshot.person_type)}
                      </span>
                    </div>
                    {clientSnapshot.trade_name && (
                      <p className="text-sm text-zinc-300">{clientSnapshot.trade_name}</p>
                    )}
                    <p className="text-sm text-zinc-400">
                      {[clientSnapshot.email, clientSnapshot.phone, getClientAddress(clientSnapshot)]
                        .filter(Boolean)
                        .join(' · ') || 'Sem dados de contato ou endereço cadastrados'}
                    </p>
                  </div>
                )}

                <Field id="contract-representative" label="Representante do cliente">
                  <Input
                    id="contract-representative"
                    value={form.client_representative}
                    onChange={(event) => updateField('client_representative', event.target.value)}
                    maxLength={200}
                    placeholder="Nome da pessoa que assina pela empresa"
                    className="border-zinc-700 bg-zinc-900 text-white caret-emerald-400 placeholder:text-zinc-400"
                  />
                </Field>
                <Field id="contract-status" label="Status *">
                  <select
                    id="contract-status"
                    value={form.status}
                    onChange={(event) => updateField('status', event.target.value)}
                    className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/40"
                  >
                    {CONTRACT_STATUSES.map((status) => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                </Field>
                <Field id="contract-issue-date" label="Data de emissão *">
                  <Input
                    id="contract-issue-date"
                    type="date"
                    value={form.issue_date}
                    onChange={(event) => updateField('issue_date', event.target.value)}
                    required
                    className="border-zinc-700 bg-zinc-900 text-white"
                  />
                </Field>
                <Field id="contract-start-date" label="Data de início *">
                  <Input
                    id="contract-start-date"
                    type="date"
                    value={form.start_date}
                    onChange={(event) => updateField('start_date', event.target.value)}
                    required
                    className="border-zinc-700 bg-zinc-900 text-white"
                  />
                </Field>
                <Field id="contract-end-date" label="Previsão de término">
                  <Input
                    id="contract-end-date"
                    type="date"
                    value={form.end_date}
                    onChange={(event) => updateField('end_date', event.target.value)}
                    min={form.start_date}
                    className="border-zinc-700 bg-zinc-900 text-white"
                  />
                </Field>
              </div>
            </section>

            <section className="space-y-5 rounded-xl border border-zinc-800 bg-[#18181b] p-5 sm:p-6">
              <div>
                <h2 className="text-lg font-semibold text-white">Serviços e escopo</h2>
                <p className="mt-1 text-sm text-zinc-400">Selecione uma ou mais categorias e descreva o trabalho contratado.</p>
              </div>
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-zinc-300">Tipos de serviço *</legend>
                <div className="flex flex-wrap gap-2">
                  {CONTRACT_SERVICE_TYPES.map((service) => {
                    const checked = form.service_types.includes(service);
                    return (
                      <label
                        key={service}
                        className={`inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition focus-within:ring-2 focus-within:ring-emerald-500/50 ${
                          checked
                            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-100'
                            : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            const nextServices = event.target.checked
                              ? [...form.service_types, service]
                              : form.service_types.filter((item) => item !== service);
                            updateField('service_types', nextServices);
                          }}
                          className="h-4 w-4 accent-emerald-500"
                        />
                        {service}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {form.service_types.includes('Outro') && (
                <Field id="contract-custom-service" label="Descreva o serviço personalizado *">
                  <Input
                    id="contract-custom-service"
                    value={form.custom_service}
                    onChange={(event) => updateField('custom_service', event.target.value)}
                    maxLength={500}
                    required
                    className="border-zinc-700 bg-zinc-900 text-white caret-emerald-400"
                  />
                </Field>
              )}

              <Field id="contract-object" label="Objeto do contrato *">
                <Textarea
                  id="contract-object"
                  value={form.object_description}
                  onChange={(event) => updateField('object_description', event.target.value)}
                  rows={3}
                  maxLength={5000}
                  required
                  placeholder="Descreva o objetivo principal do serviço contratado."
                  className="resize-y border-zinc-700 bg-zinc-900 text-white caret-emerald-400 placeholder:text-zinc-400"
                />
              </Field>
              <Field id="contract-scope" label="Escopo dos serviços *">
                <Textarea
                  id="contract-scope"
                  value={form.scope}
                  onChange={(event) => updateField('scope', event.target.value)}
                  rows={5}
                  maxLength={20000}
                  required
                  placeholder="Detalhe as atividades incluídas. Para listas, inicie cada item com -."
                  className="resize-y border-zinc-700 bg-zinc-900 text-white caret-emerald-400 placeholder:text-zinc-400"
                />
              </Field>
              <Field id="contract-deliverables" label="Entregáveis">
                <Textarea
                  id="contract-deliverables"
                  value={form.deliverables}
                  onChange={(event) => updateField('deliverables', event.target.value)}
                  rows={3}
                  maxLength={10000}
                  placeholder="Arquivos, telas, páginas, protótipos ou outros resultados incluídos."
                  className="resize-y border-zinc-700 bg-zinc-900 text-white caret-emerald-400 placeholder:text-zinc-400"
                />
              </Field>
              <Field id="contract-timeline-notes" label="Observações sobre o cronograma">
                <Textarea
                  id="contract-timeline-notes"
                  value={form.timeline_notes}
                  onChange={(event) => updateField('timeline_notes', event.target.value)}
                  rows={3}
                  maxLength={5000}
                  placeholder="Marcos, dependências ou etapas relevantes."
                  className="resize-y border-zinc-700 bg-zinc-900 text-white caret-emerald-400 placeholder:text-zinc-400"
                />
              </Field>
            </section>

            <section className="space-y-5 rounded-xl border border-emerald-500/30 bg-[#18181b] p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Agenda de pagamentos</h2>
                  <p className="mt-1 text-sm text-zinc-400">Os valores das parcelas precisam somar o total do contrato.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const lastPayment = form.payment_schedule[form.payment_schedule.length - 1];
                    const lastDate = lastPayment?.due_date || form.start_date;
                    setForm((current) => ({
                      ...current,
                      payment_schedule: [
                        ...current.payment_schedule,
                        createRow({
                          description: `Parcela ${current.payment_schedule.length + 1}`,
                          due_date: addMonth(lastDate),
                          amount: '',
                        }),
                      ],
                    }));
                  }}
                  disabled={form.payment_schedule.length >= 24}
                  className="shrink-0 border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar parcela
                </Button>
              </div>

              {form.payment_schedule.length ? (
                <div className="space-y-3">
                  {form.payment_schedule.map((payment, index) => (
                    <div
                      key={payment.id}
                      className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-900/70 p-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(10rem,1fr)_minmax(9rem,0.8fr)_auto] sm:items-end"
                    >
                      <Field id={`payment-description-${index}`} label={`Parcela ${index + 1}`}>
                        <Input
                          id={`payment-description-${index}`}
                          value={payment.description}
                          onChange={(event) => updatePayment(index, 'description', event.target.value)}
                          maxLength={200}
                          required
                          className="border-zinc-700 bg-zinc-950 text-white caret-emerald-400"
                        />
                      </Field>
                      <Field id={`payment-date-${index}`} label="Vencimento">
                        <Input
                          id={`payment-date-${index}`}
                          type="date"
                          value={payment.due_date}
                          onChange={(event) => updatePayment(index, 'due_date', event.target.value)}
                          required
                          className="border-zinc-700 bg-zinc-950 text-white"
                        />
                      </Field>
                      <Field id={`payment-amount-${index}`} label="Valor (R$)">
                        <Input
                          id={`payment-amount-${index}`}
                          type="text"
                          inputMode="decimal"
                          value={payment.amount}
                          onChange={(event) => updatePayment(index, 'amount', event.target.value)}
                          placeholder="0,00"
                          autoComplete="off"
                          required
                          className="border-zinc-700 bg-zinc-950 text-right tabular-nums text-white caret-emerald-400 placeholder:text-zinc-400"
                        />
                      </Field>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remover parcela ${index + 1}`}
                        onClick={() => setForm((current) => ({
                          ...current,
                          payment_schedule: current.payment_schedule.filter((_, itemIndex) => itemIndex !== index),
                        }))}
                        className="h-10 w-10 text-zinc-400 hover:bg-rose-500/10 hover:text-rose-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-zinc-700 px-4 py-8 text-center">
                  <p className="text-sm text-zinc-400">Nenhuma parcela adicionada.</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setForm((current) => ({
                      ...current,
                      payment_schedule: [createRow({
                        description: 'Parcela 1',
                        due_date: current.start_date,
                        amount: '',
                      })],
                    }))}
                    className="mt-3 border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar primeira parcela
                  </Button>
                </div>
              )}

              <div className="flex flex-wrap items-end justify-between gap-3 border-t border-zinc-800 pt-4">
                <p className="text-sm text-zinc-400">
                  {form.payment_schedule.length} {form.payment_schedule.length === 1 ? 'parcela' : 'parcelas'}
                </p>
                <div className="text-right">
                  <span className="block text-xs text-zinc-400">Valor total do contrato</span>
                  <span className="mt-1 block text-2xl font-semibold tabular-nums text-white">
                    {formatCurrency(totalAmountCents)}
                  </span>
                </div>
              </div>
            </section>

            <section className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Cláusulas e condições</h2>
                  <p className="mt-1 max-w-2xl text-sm text-zinc-400">
                    Os textos do modelo são sugestões editáveis. Revise as condições antes de enviar o contrato.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForm((current) => ({
                    ...current,
                    clauses: [...current.clauses, createRow({ title: '', body: '' })],
                  }))}
                  disabled={form.clauses.length >= 20}
                  className="border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar cláusula
                </Button>
              </div>

              {form.clauses.map((clause, index) => (
                <section key={clause.id} className="space-y-3 border-t border-zinc-800 pt-5">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor={`clause-title-${index}`} className="text-sm font-semibold text-white">
                      Cláusula {index + 1}
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remover cláusula ${index + 1}`}
                      onClick={() => setForm((current) => ({
                        ...current,
                        clauses: current.clauses.filter((_, itemIndex) => itemIndex !== index),
                      }))}
                      disabled={form.clauses.length <= 1}
                      className="h-8 w-8 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    id={`clause-title-${index}`}
                    value={clause.title}
                    onChange={(event) => updateClause(index, 'title', event.target.value)}
                    maxLength={160}
                    required
                    placeholder="Título da cláusula"
                    className="border-zinc-700 bg-zinc-900 text-white caret-emerald-400 placeholder:text-zinc-400"
                  />
                  <Textarea
                    value={clause.body}
                    onChange={(event) => updateClause(index, 'body', event.target.value)}
                    aria-label={`Texto da cláusula ${index + 1}: ${clause.title || 'sem título'}`}
                    rows={3}
                    maxLength={20000}
                    placeholder="Edite o texto desta cláusula."
                    className="resize-y border-zinc-700 bg-zinc-900 text-white caret-emerald-400 placeholder:text-zinc-400"
                  />
                </section>
              ))}
            </section>

            <section className="space-y-5 rounded-xl border border-zinc-800 bg-[#18181b] p-5 sm:p-6">
              <div>
                <h2 className="text-lg font-semibold text-white">Dados da contratada</h2>
                <p className="mt-1 text-sm text-zinc-400">Valores iniciais copiados do modelo e editáveis para este contrato.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="provider-display-name" label="Nome de apresentação *">
                  <Input
                    id="provider-display-name"
                    value={form.provider.display_name}
                    onChange={(event) => updateProvider('display_name', event.target.value)}
                    required
                    maxLength={200}
                    className="border-zinc-700 bg-zinc-900 text-white caret-emerald-400"
                  />
                </Field>
                <Field id="provider-legal-name" label="Razão social">
                  <Input
                    id="provider-legal-name"
                    value={form.provider.legal_name || ''}
                    onChange={(event) => updateProvider('legal_name', event.target.value)}
                    maxLength={200}
                    className="border-zinc-700 bg-zinc-900 text-white caret-emerald-400"
                  />
                </Field>
                <Field id="provider-document" label="CPF/CNPJ">
                  <Input
                    id="provider-document"
                    value={form.provider.document || ''}
                    onChange={(event) => updateProvider('document', event.target.value)}
                    maxLength={32}
                    className="border-zinc-700 bg-zinc-900 text-white caret-emerald-400"
                  />
                </Field>
                <Field id="provider-representative" label="Representante da contratada">
                  <Input
                    id="provider-representative"
                    value={form.provider.representative_name || ''}
                    onChange={(event) => updateProvider('representative_name', event.target.value)}
                    maxLength={200}
                    className="border-zinc-700 bg-zinc-900 text-white caret-emerald-400"
                  />
                </Field>
                <Field id="provider-address" label="Endereço" className="sm:col-span-2">
                  <Input
                    id="provider-address"
                    value={form.provider.address || ''}
                    onChange={(event) => updateProvider('address', event.target.value)}
                    maxLength={500}
                    className="border-zinc-700 bg-zinc-900 text-white caret-emerald-400"
                  />
                </Field>
                <Field id="provider-phone" label="Telefone">
                  <Input
                    id="provider-phone"
                    value={form.provider.phone || ''}
                    onChange={(event) => updateProvider('phone', event.target.value)}
                    maxLength={40}
                    className="border-zinc-700 bg-zinc-900 text-white caret-emerald-400"
                  />
                </Field>
                <Field id="provider-email" label="E-mail">
                  <Input
                    id="provider-email"
                    type="email"
                    value={form.provider.email || ''}
                    onChange={(event) => updateProvider('email', event.target.value)}
                    maxLength={200}
                    className="border-zinc-700 bg-zinc-900 text-white caret-emerald-400"
                  />
                </Field>
                <Field id="contract-city" label="Cidade e foro" className="sm:col-span-2">
                  <Input
                    id="contract-city"
                    value={form.contract_city}
                    onChange={(event) => updateField('contract_city', event.target.value)}
                    maxLength={120}
                    className="border-zinc-700 bg-zinc-900 text-white caret-emerald-400"
                  />
                </Field>
              </div>
            </section>

            {selectedClient && (
              <p className="text-xs leading-relaxed text-zinc-400">
                Cliente selecionado: {clientSnapshot?.name}. Os dados de identificação ficam salvos como cópia no contrato; atualizações futuras no cadastro não alteram este documento.
              </p>
            )}

            <div className="flex flex-col-reverse gap-3 border-t border-zinc-800 pt-5 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/contracts')}
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
                {submitting ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Salvar contrato'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Layout>
  );
}
