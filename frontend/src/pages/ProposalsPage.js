import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Download, FileText, Loader2, Plus, Search, UserRound } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { proposalsApi } from '../lib/api';
import { downloadProposalPdf } from '../lib/proposalPdf';
import { formatCurrency } from '../lib/utils';

export const PROPOSAL_STATUSES = [
  { value: 'RASCUNHO', label: 'Rascunho' },
  { value: 'ENVIADA', label: 'Enviada' },
  { value: 'EM_NEGOCIACAO', label: 'Em negociação' },
  { value: 'APROVADA', label: 'Aprovada' },
  { value: 'RECUSADA', label: 'Recusada' },
  { value: 'EXPIRADA', label: 'Expirada' },
  { value: 'CANCELADA', label: 'Cancelada' },
];

const STATUS_STYLES = {
  RASCUNHO: 'border-zinc-700 bg-zinc-800/60 text-zinc-300',
  ENVIADA: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  EM_NEGOCIACAO: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  APROVADA: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  RECUSADA: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  EXPIRADA: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  CANCELADA: 'border-zinc-700 bg-zinc-900 text-zinc-400',
};

function formatDate(value) {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

function getErrorMessage(error, fallback) {
  const detail = error.response?.data?.detail;
  return (typeof detail === 'string' && detail) || error.message || fallback;
}

function StatusSelect({ value, proposalTitle, busy, onChange }) {
  return (
    <select
      aria-label={`Status da proposta ${proposalTitle}`}
      className={`max-w-full rounded-full border px-3 py-1.5 text-xs font-medium outline-none transition focus:ring-2 focus:ring-emerald-500/40 ${STATUS_STYLES[value] || STATUS_STYLES.RASCUNHO}`}
      disabled={busy}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {PROPOSAL_STATUSES.map((status) => (
        <option key={status.value} value={status.value}>
          {status.label}
        </option>
      ))}
    </select>
  );
}

export function ProposalsPage() {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODAS');
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(null);
  const [actionError, setActionError] = useState('');

  const loadProposals = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await proposalsApi.list();
      setProposals(response.data);
    } catch (error) {
      setLoadError(getErrorMessage(error, 'Não foi possível carregar as propostas.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  const filteredProposals = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return proposals.filter((proposal) => {
      const matchesStatus = statusFilter === 'TODAS' || proposal.status === statusFilter;
      const matchesSearch = !term
        || proposal.title.toLocaleLowerCase('pt-BR').includes(term)
        || proposal.client_name.toLocaleLowerCase('pt-BR').includes(term)
        || (proposal.contact_name || '').toLocaleLowerCase('pt-BR').includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [proposals, search, statusFilter]);

  const statusCounts = useMemo(() => proposals.reduce((counts, proposal) => {
    counts[proposal.status] = (counts[proposal.status] || 0) + 1;
    return counts;
  }, {}), [proposals]);

  const handleStatusChange = async (proposal, nextStatus) => {
    if (nextStatus === proposal.status) return;
    setUpdatingStatus(proposal.id);
    setActionError('');
    try {
      const response = await proposalsApi.updateStatus(proposal.id, nextStatus);
      setProposals((current) => current.map((item) => (
        item.id === proposal.id ? response.data : item
      )));
    } catch (error) {
      setActionError(getErrorMessage(error, 'Não foi possível atualizar o status.'));
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleDownload = async (proposal) => {
    setDownloadingPdf(proposal.id);
    setActionError('');
    try {
      await downloadProposalPdf(proposal);
    } catch (error) {
      setActionError(getErrorMessage(error, 'Não foi possível gerar o PDF.'));
    } finally {
      setDownloadingPdf(null);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-7xl space-y-6 selection:bg-emerald-500/30 selection:text-emerald-100" data-testid="proposals-page">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white lg:text-3xl">Propostas</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Crie, acompanhe e mantenha suas propostas comerciais em um só lugar.
            </p>
          </div>
          <Button
            onClick={() => navigate('/proposals/new')}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            data-testid="create-proposal-btn"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova proposta
          </Button>
        </header>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-400" aria-live="polite">
          <span className="font-medium text-zinc-200">{proposals.length} propostas</span>
          <span aria-hidden="true">·</span>
          <span>{statusCounts.EM_NEGOCIACAO || 0} em negociação</span>
          <span aria-hidden="true">·</span>
          <span>{statusCounts.APROVADA || 0} aprovadas</span>
        </div>

        <div className="flex flex-col gap-3 border-y border-zinc-800 py-4 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por proposta, cliente ou contato"
              aria-label="Buscar propostas"
              className="border-zinc-700 bg-zinc-900 pl-9 text-white caret-emerald-400 placeholder:text-zinc-400"
            />
          </div>
          <select
            aria-label="Filtrar por status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-200 outline-none focus:ring-2 focus:ring-emerald-500/40 sm:w-56"
          >
            <option value="TODAS">Todos os status</option>
            {PROPOSAL_STATUSES.map((status) => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
        </div>

        {actionError && (
          <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {actionError}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-48 items-center justify-center text-zinc-400" role="status">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-500" />
            Carregando propostas...
          </div>
        ) : loadError ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-6 text-center">
            <p className="text-sm text-rose-200" role="alert">{loadError}</p>
            <Button onClick={loadProposals} variant="outline" className="mt-4 border-zinc-700 text-zinc-200 hover:bg-zinc-800">
              Tentar novamente
            </Button>
          </div>
        ) : filteredProposals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-700 px-5 py-14 text-center">
            <FileText className="mx-auto h-8 w-8 text-zinc-500" />
            <h2 className="mt-4 text-base font-semibold text-white">
              {proposals.length ? 'Nenhuma proposta encontrada' : 'Sua lista de propostas está vazia'}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
              {proposals.length
                ? 'Ajuste a busca ou o filtro de status para ver outras propostas.'
                : 'Cadastre uma proposta para organizar o escopo, o investimento e o acompanhamento do cliente.'}
            </p>
            {!proposals.length && (
              <Button
                onClick={() => navigate('/proposals/new')}
                className="mt-5 bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                Criar proposta
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-[#18181b]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left">
                <thead className="border-b border-zinc-800 bg-zinc-900/70">
                  <tr className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    <th scope="col" className="px-5 py-3 text-zinc-400">Proposta / cliente</th>
                    <th scope="col" className="px-4 py-3 text-zinc-400">Investimento</th>
                    <th scope="col" className="px-4 py-3 text-zinc-400">Validade</th>
                    <th scope="col" className="px-4 py-3 text-zinc-400">Status</th>
                    <th scope="col" className="px-5 py-3 text-right text-zinc-400">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {filteredProposals.map((proposal) => (
                    <tr key={proposal.id} className="transition-colors hover:bg-zinc-800/35">
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => navigate(`/proposals/${proposal.id}/edit`)}
                          className="max-w-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                        >
                          <span className="block truncate font-medium text-white">{proposal.title}</span>
                          <span className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400">
                            <UserRound className="h-3.5 w-3.5" />
                            {proposal.client_name}
                            {proposal.contact_name ? ` · ${proposal.contact_name}` : ''}
                          </span>
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 font-medium tabular-nums text-zinc-200">
                        {formatCurrency(proposal.amount_cents)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-zinc-400">
                        <span className="inline-flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-zinc-500" />
                          {formatDate(proposal.valid_until)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <StatusSelect
                          value={proposal.status}
                          proposalTitle={proposal.title}
                          busy={updatingStatus === proposal.id}
                          onChange={(nextStatus) => handleStatusChange(proposal, nextStatus)}
                        />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(proposal)}
                            disabled={downloadingPdf === proposal.id}
                            aria-label={`Baixar PDF de ${proposal.title}`}
                            className="text-zinc-300 hover:bg-zinc-800 hover:text-white"
                          >
                            {downloadingPdf === proposal.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <Download className="h-4 w-4" />}
                            <span className="ml-2">PDF</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/proposals/${proposal.id}/edit`)}
                            aria-label={`Editar ${proposal.title}`}
                            className="text-zinc-300 hover:bg-zinc-800 hover:text-white"
                          >
                            Editar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-zinc-800 px-5 py-3 text-xs text-zinc-400">
              Exibindo {filteredProposals.length} de {proposals.length} propostas
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
