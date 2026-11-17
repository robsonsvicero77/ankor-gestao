import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Download,
  FileText,
  Loader2,
  Plus,
  Search,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { contractsApi } from '../lib/api';
import { downloadContractPdf } from '../lib/contractPdf';
import {
  CONTRACT_STATUSES,
  formatCurrency,
  formatDate,
  getContractServiceLabel,
  getNextScheduledPayment,
} from '../lib/contractUtils';

const STATUS_STYLES = {
  RASCUNHO: 'border-border bg-surface text-text-secondary',
  ENVIADO: 'border-info/30 bg-info-background text-brand-secondary',
  ASSINADO: 'border-info/30 bg-info-background text-brand-secondary',
  EM_EXECUCAO: 'border-warning/30 bg-warning-background text-text-primary',
  CONCLUIDO: 'border-success/30 bg-success-background text-success',
  CANCELADO: 'border-border bg-surface text-text-secondary',
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

function StatusSelect({ contract, busy, onChange }) {
  return (
    <select
      aria-label={`Status do contrato ${contract.title}`}
      className={`max-w-full rounded-full border px-3 py-1.5 text-xs font-medium outline-none transition focus:ring-2 focus:ring-focus ${STATUS_STYLES[contract.status] || STATUS_STYLES.RASCUNHO}`}
      disabled={busy}
      value={contract.status}
      onChange={(event) => onChange(event.target.value)}
    >
      {CONTRACT_STATUSES.map((status) => (
        <option key={status.value} value={status.value}>{status.label}</option>
      ))}
    </select>
  );
}

export function ContractsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODAS');
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState(() => {
    const count = location.state?.receivablesCreated || 0;
    return count > 0
      ? `${count} ${count === 1 ? 'recebível foi criado' : 'recebíveis foram criados'} a partir da agenda do contrato.`
      : '';
  });

  const loadContracts = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await contractsApi.list();
      setContracts(response.data);
    } catch (error) {
      setLoadError(getErrorMessage(error, 'Não foi possível carregar os contratos.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  const filteredContracts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return contracts.filter((contract) => {
      const searchableText = [
        contract.title,
        contract.client_snapshot.name,
        contract.client_snapshot.trade_name,
        getContractServiceLabel(contract),
      ].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR');
      return (statusFilter === 'TODAS' || contract.status === statusFilter)
        && (!term || searchableText.includes(term));
    });
  }, [contracts, search, statusFilter]);

  const statusCounts = useMemo(() => contracts.reduce((counts, contract) => {
    counts[contract.status] = (counts[contract.status] || 0) + 1;
    return counts;
  }, {}), [contracts]);

  const handleStatusChange = async (contract, nextStatus) => {
    if (nextStatus === contract.status) return;
    setUpdatingStatus(contract.id);
    setActionError('');
    setActionSuccess('');
    try {
      const response = await contractsApi.updateStatus(contract.id, nextStatus);
      setContracts((current) => current.map((item) => (
        item.id === contract.id ? response.data : item
      )));
      const count = response.data.receivables_created || 0;
      setActionSuccess(count > 0
        ? `${count} ${count === 1 ? 'recebível foi criado' : 'recebíveis foram criados'} a partir da agenda do contrato.`
        : 'Status do contrato atualizado.');
    } catch (error) {
      setActionError(getErrorMessage(error, 'Não foi possível atualizar o status.'));
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleDownload = async (contract) => {
    setDownloadingPdf(contract.id);
    setActionError('');
    try {
      await downloadContractPdf(contract);
    } catch (error) {
      setActionError(getErrorMessage(error, 'Não foi possível gerar o PDF.'));
    } finally {
      setDownloadingPdf(null);
    }
  };

  const openContract = (contract) => navigate(`/contracts/${contract.id}/edit`);

  return (
    <Layout>
      <div className="mx-auto max-w-7xl space-y-6 selection:bg-brand-light selection:text-brand-primary" data-testid="contracts-page">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="type-h1 text-text-primary">Contratos</h1>
            <p className="mt-1 max-w-2xl text-sm text-text-secondary">
              Organize escopo, parcelas e andamento dos serviços contratados.
            </p>
          </div>
          <Button
            onClick={() => navigate('/contracts/new')}
            className="bg-brand-primary text-text-inverse hover:bg-brand-hover"
            data-testid="create-contract-btn"
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo contrato
          </Button>
        </header>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary" aria-live="polite">
          <span className="font-medium text-text-secondary">{contracts.length} contratos</span>
          <span aria-hidden="true">·</span>
          <span>{statusCounts.ASSINADO || 0} assinados</span>
          <span aria-hidden="true">·</span>
          <span>{statusCounts.EM_EXECUCAO || 0} em execução</span>
          <span aria-hidden="true">·</span>
          <span>{statusCounts.CONCLUIDO || 0} concluídos</span>
        </div>

        <div className="flex flex-col gap-3 border-y border-border py-4 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por contrato, cliente ou serviço"
              aria-label="Buscar contratos"
              className="border-border bg-surface pl-9 text-text-primary caret-brand-primary placeholder:text-text-secondary"
            />
          </div>
          <select
            aria-label="Filtrar por status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-text-secondary outline-none focus:ring-2 focus:ring-focus sm:w-56"
          >
            <option value="TODAS">Todos os status</option>
            {CONTRACT_STATUSES.map((status) => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
        </div>

        {actionError && (
          <div role="alert" className="rounded-lg border border-error/30 bg-error-background px-4 py-3 text-sm text-error">
            {actionError}
          </div>
        )}
        {actionSuccess && (
          <div role="status" className="rounded-lg border border-success/30 bg-success-background px-4 py-3 text-sm text-success">
            {actionSuccess}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-48 items-center justify-center text-text-secondary" role="status">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-brand-primary" />
            Carregando contratos...
          </div>
        ) : loadError ? (
          <div className="rounded-lg border border-error/30 bg-error-background p-6 text-center">
            <p className="text-sm text-error" role="alert">{loadError}</p>
            <Button onClick={loadContracts} variant="outline" className="mt-4 border-border text-text-secondary hover:bg-surface-alt">
              Tentar novamente
            </Button>
          </div>
        ) : filteredContracts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center">
            <FileText className="mx-auto h-8 w-8 text-text-secondary" />
            <h2 className="type-h2 mt-4 text-text-primary">
              {contracts.length ? 'Nenhum contrato encontrado' : 'Sua lista de contratos está vazia'}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">
              {contracts.length
                ? 'Ajuste a busca ou o filtro de status para ver outros contratos.'
                : 'Crie um contrato vinculado a um cliente cadastrado e organize o escopo e as parcelas.'}
            </p>
            {!contracts.length && (
              <Button
                onClick={() => navigate('/contracts/new')}
                className="mt-5 bg-brand-primary text-text-inverse hover:bg-brand-hover"
              >
                <Plus className="mr-2 h-4 w-4" />
                Criar contrato
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1060px] text-left">
                <thead className="border-b border-border bg-surface">
                  <tr className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                    <th scope="col" className="px-4 py-3">Contrato / cliente</th>
                    <th scope="col" className="px-4 py-3">Serviço</th>
                    <th scope="col" className="px-4 py-3 text-right">Valor total</th>
                    <th scope="col" className="px-4 py-3">Próximo vencimento</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredContracts.map((contract) => {
                    const nextPayment = getNextScheduledPayment(contract);
                    return (
                      <tr key={contract.id} className="transition-colors hover:bg-surface-alt/35">
                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() => openContract(contract)}
                            className="max-w-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                          >
                            <span className="block truncate font-medium text-text-primary">{contract.title}</span>
                            <span className="mt-1 block max-w-xs truncate text-xs text-text-secondary">
                              {contract.client_snapshot.name}
                            </span>
                          </button>
                        </td>
                        <td className="max-w-[15rem] px-4 py-4 text-sm text-text-secondary">
                          <span className="block truncate">{getContractServiceLabel(contract)}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right font-medium tabular-nums text-text-secondary">
                          {formatCurrency(contract.total_amount_cents)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-text-secondary">
                          {nextPayment ? (
                            <>
                              <span className="block font-medium tabular-nums">{formatCurrency(nextPayment.amount_cents)}</span>
                              <span className="mt-1 flex items-center gap-1.5 text-xs text-text-secondary">
                                <CalendarDays className="h-3.5 w-3.5" />
                                {formatDate(nextPayment.due_date)}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-text-secondary">Sem vencimentos futuros</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <StatusSelect
                            contract={contract}
                            busy={updatingStatus === contract.id}
                            onChange={(nextStatus) => handleStatusChange(contract, nextStatus)}
                          />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownload(contract)}
                              disabled={downloadingPdf === contract.id}
                              aria-label={`Baixar PDF de ${contract.title}`}
                              className="text-text-secondary hover:bg-surface-alt hover:text-text-primary"
                            >
                              {downloadingPdf === contract.id
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <Download className="h-4 w-4" />}
                              <span className="ml-2">PDF</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openContract(contract)}
                              aria-label={`Editar ${contract.title}`}
                              className="text-text-secondary hover:bg-surface-alt hover:text-text-primary"
                            >
                              Editar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-border md:hidden">
              {filteredContracts.map((contract) => {
                const nextPayment = getNextScheduledPayment(contract);
                return (
                  <article key={contract.id} className="space-y-4 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <button type="button" onClick={() => openContract(contract)} className="min-w-0 text-left">
                        <span className="block font-medium text-text-primary">{contract.title}</span>
                        <span className="mt-1 block truncate text-sm text-text-secondary">{contract.client_snapshot.name}</span>
                      </button>
                      <span className="shrink-0 text-right font-medium tabular-nums text-text-secondary">
                        {formatCurrency(contract.total_amount_cents)}
                        <span className="mt-1 block text-[11px] font-normal text-text-secondary">valor total</span>
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary">{getContractServiceLabel(contract)}</p>
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div className="min-w-0">
                        <span className="block text-xs text-text-secondary">Próximo vencimento previsto</span>
                        {nextPayment ? (
                          <span className="mt-1 block text-sm tabular-nums text-text-secondary">
                            {formatCurrency(nextPayment.amount_cents)} · {formatDate(nextPayment.due_date)}
                          </span>
                        ) : (
                          <span className="mt-1 block text-sm text-text-secondary">Sem vencimentos futuros</span>
                        )}
                      </div>
                      <StatusSelect
                        contract={contract}
                        busy={updatingStatus === contract.id}
                        onChange={(nextStatus) => handleStatusChange(contract, nextStatus)}
                      />
                    </div>
                    <div className="flex justify-end gap-1 border-t border-border pt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(contract)}
                        disabled={downloadingPdf === contract.id}
                        className="text-text-secondary hover:bg-surface-alt hover:text-text-primary"
                      >
                        {downloadingPdf === contract.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Download className="h-4 w-4" />}
                        <span className="ml-2">Baixar PDF</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openContract(contract)}
                        className="text-text-secondary hover:bg-surface-alt hover:text-text-primary"
                      >
                        Editar
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="border-t border-border px-4 py-3 text-xs text-text-secondary">
              Exibindo {filteredContracts.length} de {contracts.length} contratos
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
