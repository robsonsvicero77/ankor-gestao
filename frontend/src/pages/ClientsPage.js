import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Loader2, Pencil, Plus, Search, UserRound, Users } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { clientsApi } from '../lib/api';
import { formatClientDocument } from '../lib/clientUtils';

function getErrorMessage(error, fallback) {
  const detail = error.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const firstMessage = detail.find((issue) => issue.msg)?.msg;
    if (firstMessage) return firstMessage.replace(/^Value error,\s*/, '');
  }
  return error.message || fallback;
}

export function ClientsPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [personTypeFilter, setPersonTypeFilter] = useState('TODOS');

  const loadClients = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await clientsApi.list();
      setClients(response.data);
    } catch (error) {
      setLoadError(getErrorMessage(error, 'Não foi possível carregar os clientes.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const filteredClients = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return clients.filter((client) => {
      const matchesType = personTypeFilter === 'TODOS' || client.person_type === personTypeFilter;
      const searchableText = [
        client.name,
        client.trade_name,
        client.document,
        client.email,
        client.phone,
        client.contact_name,
        client.city,
      ].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR');
      return matchesType && (!term || searchableText.includes(term));
    });
  }, [clients, personTypeFilter, search]);

  const individualCount = clients.filter((client) => client.person_type === 'PF').length;
  const companyCount = clients.length - individualCount;

  return (
    <Layout>
      <div className="mx-auto max-w-7xl space-y-6 selection:bg-emerald-500/30 selection:text-emerald-100" data-testid="clients-page">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white lg:text-3xl">Clientes</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Mantenha os dados de pessoas e empresas organizados para reutilizar no sistema.
            </p>
          </div>
          <Button
            onClick={() => navigate('/clients/new')}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            data-testid="create-client-btn"
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo cliente
          </Button>
        </header>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-400" aria-live="polite">
          <span className="font-medium text-zinc-200">{clients.length} clientes</span>
          <span aria-hidden="true">·</span>
          <span>{individualCount} pessoas</span>
          <span aria-hidden="true">·</span>
          <span>{companyCount} empresas</span>
        </div>

        <div className="flex flex-col gap-3 border-y border-zinc-800 py-4 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, documento, e-mail ou contato"
              aria-label="Buscar clientes"
              className="border-zinc-700 bg-zinc-900 pl-9 text-white caret-emerald-400 placeholder:text-zinc-400"
            />
          </div>
          <select
            aria-label="Filtrar por tipo de cliente"
            value={personTypeFilter}
            onChange={(event) => setPersonTypeFilter(event.target.value)}
            className="h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-200 outline-none focus:ring-2 focus:ring-emerald-500/40 sm:w-48"
          >
            <option value="TODOS">Pessoas e empresas</option>
            <option value="PF">Pessoas físicas</option>
            <option value="PJ">Pessoas jurídicas</option>
          </select>
        </div>

        {loading ? (
          <div className="flex min-h-48 items-center justify-center text-zinc-400" role="status">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-500" />
            Carregando clientes...
          </div>
        ) : loadError ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-6 text-center">
            <p className="text-sm text-rose-200" role="alert">{loadError}</p>
            <Button onClick={loadClients} variant="outline" className="mt-4 border-zinc-700 text-zinc-200 hover:bg-zinc-800">
              Tentar novamente
            </Button>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-700 px-5 py-14 text-center">
            <Users className="mx-auto h-8 w-8 text-zinc-500" />
            <h2 className="mt-4 text-base font-semibold text-white">
              {clients.length ? 'Nenhum cliente encontrado' : 'Sua lista de clientes está vazia'}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
              {clients.length
                ? 'Ajuste a busca ou o filtro para encontrar outro cliente.'
                : 'Cadastre uma pessoa ou empresa para manter os dados de contato e endereço em um só lugar.'}
            </p>
            {!clients.length && (
              <Button
                onClick={() => navigate('/clients/new')}
                className="mt-5 bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                Cadastrar cliente
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-[#18181b]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left">
                <thead className="border-b border-zinc-800 bg-zinc-900/70">
                  <tr className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                    <th scope="col" className="px-5 py-3">Cliente</th>
                    <th scope="col" className="px-4 py-3">Tipo</th>
                    <th scope="col" className="px-4 py-3">CPF/CNPJ</th>
                    <th scope="col" className="px-4 py-3">Contato</th>
                    <th scope="col" className="px-4 py-3">Localidade</th>
                    <th scope="col" className="px-5 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {filteredClients.map((client) => {
                    const PersonIcon = client.person_type === 'PJ' ? Building2 : UserRound;
                    return (
                      <tr key={client.id} className="transition-colors hover:bg-zinc-800/35">
                        <td className="px-5 py-4">
                          <span className="block max-w-xs truncate font-medium text-white">{client.name}</span>
                          {client.trade_name && (
                            <span className="mt-1 block max-w-xs truncate text-xs text-zinc-400">{client.trade_name}</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300">
                            <PersonIcon className="h-3.5 w-3.5" />
                            {client.person_type}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm tabular-nums text-zinc-300">
                          {formatClientDocument(client.document, client.person_type)}
                        </td>
                        <td className="px-4 py-4 text-sm text-zinc-400">
                          <span className="block max-w-[16rem] truncate text-zinc-300">
                            {client.contact_name || client.email || '—'}
                          </span>
                          {client.email && client.contact_name && (
                            <span className="mt-1 block max-w-[16rem] truncate text-xs">{client.email}</span>
                          )}
                          {client.phone && (
                            <span className="mt-1 block text-xs">{client.phone}</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-zinc-400">
                          {[client.city, client.state].filter(Boolean).join(' / ') || '—'}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/clients/${client.id}/edit`)}
                              aria-label={`Editar ${client.name}`}
                              className="text-zinc-300 hover:bg-zinc-800 hover:text-white"
                            >
                              <Pencil className="mr-2 h-4 w-4" />
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
            <div className="border-t border-zinc-800 px-5 py-3 text-xs text-zinc-400">
              Exibindo {filteredClients.length} de {clients.length} clientes
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
