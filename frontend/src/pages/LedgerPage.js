import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from '../components/Layout';
import { ledgerApi } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { 
  BookOpen, 
  Loader2, 
  ArrowDownCircle, 
  ArrowUpCircle,
  Wallet,
  RefreshCw,
  Filter,
  X
} from 'lucide-react';
import { formatCurrency, formatDate, cn } from '../lib/utils';

const ENTRY_TYPE_CONFIG = {
  SALDO_INICIAL: {
    label: 'Saldo Inicial',
    icon: Wallet,
    color: 'text-brand-secondary',
    bgColor: 'bg-brand-light'
  },
  RECEITA_PAGA: {
    label: 'Receita Recebida',
    icon: ArrowDownCircle,
    color: 'text-success',
    bgColor: 'bg-success-background'
  },
  DESPESA_PAGA: {
    label: 'Despesa Paga',
    icon: ArrowUpCircle,
    color: 'text-error',
    bgColor: 'bg-error-background'
  },
  AJUSTE: {
    label: 'Ajuste',
    icon: RefreshCw,
    color: 'text-brand-secondary',
    bgColor: 'bg-info-background'
  }
};

export function LedgerPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState({
    entry_type: 'all',
    direction: 'all',
    start_date: '',
    end_date: ''
  });

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      // Build filter params (remove empty values and 'all')
      const params = Object.fromEntries(
        Object.entries(filters).filter(([_, v]) => v !== '' && v !== 'all')
      );
      const response = await ledgerApi.list(params);
      setEntries(response.data);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const applyFilters = () => {
    fetchEntries();
  };

  const clearFilters = () => {
    setFilters({
      entry_type: 'all',
      direction: 'all',
      start_date: '',
      end_date: ''
    });
    // Fetch without filters
    setTimeout(() => fetchEntries(), 0);
  };

  const hasActiveFilters = filters.entry_type !== 'all' || 
                           filters.direction !== 'all' || 
                           filters.start_date !== '' || 
                           filters.end_date !== '';

  // Calculate running balance
  const entriesWithBalance = [...entries].reverse().reduce((acc, entry, index) => {
    const prevBalance = index === 0 ? 0 : acc[index - 1].runningBalance;
    const amount = entry.direction === 'CREDIT' ? entry.amount_cents : -entry.amount_cents;
    const runningBalance = prevBalance + amount;
    acc.push({ ...entry, runningBalance });
    return acc;
  }, []).reverse();

  const totalCredits = entries
    .filter(e => e.direction === 'CREDIT')
    .reduce((sum, e) => sum + e.amount_cents, 0);

  const totalDebits = entries
    .filter(e => e.direction === 'DEBIT')
    .reduce((sum, e) => sum + e.amount_cents, 0);

  const currentBalance = totalCredits - totalDebits;

  return (
    <Layout>
      <div className="space-y-6" data-testid="ledger-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-text-primary">Histórico (Ledger)</h1>
            <p className="text-text-secondary text-sm mt-1">
              Registro completo de todas as movimentações financeiras
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "border-border",
              hasActiveFilters ? "border-success/50 text-success" : "text-text-secondary"
            )}
            data-testid="toggle-filters-btn"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
            {hasActiveFilters && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-success-background rounded">
                Ativos
              </span>
            )}
          </Button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <Card className="bg-surface border-border">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-text-secondary text-sm">Tipo</Label>
                  <Select 
                    value={filters.entry_type} 
                    onValueChange={(v) => setFilters({...filters, entry_type: v})}
                  >
                    <SelectTrigger className="bg-surface border-border text-text-primary" data-testid="filter-type-select">
                      <SelectValue placeholder="Todos os tipos" />
                    </SelectTrigger>
                    <SelectContent className="bg-surface border-border">
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="SALDO_INICIAL">Saldo Inicial</SelectItem>
                      <SelectItem value="RECEITA_PAGA">Receita Recebida</SelectItem>
                      <SelectItem value="DESPESA_PAGA">Despesa Paga</SelectItem>
                      <SelectItem value="AJUSTE">Ajuste</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-text-secondary text-sm">Direção</Label>
                  <Select 
                    value={filters.direction} 
                    onValueChange={(v) => setFilters({...filters, direction: v})}
                  >
                    <SelectTrigger className="bg-surface border-border text-text-primary" data-testid="filter-direction-select">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent className="bg-surface border-border">
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="CREDIT">Entradas (Crédito)</SelectItem>
                      <SelectItem value="DEBIT">Saídas (Débito)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-text-secondary text-sm">Data Início</Label>
                  <Input
                    type="date"
                    value={filters.start_date}
                    onChange={(e) => setFilters({...filters, start_date: e.target.value})}
                    data-testid="filter-start-date"
                    className="bg-surface border-border text-text-primary"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-text-secondary text-sm">Data Fim</Label>
                  <Input
                    type="date"
                    value={filters.end_date}
                    onChange={(e) => setFilters({...filters, end_date: e.target.value})}
                    data-testid="filter-end-date"
                    className="bg-surface border-border text-text-primary"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border">
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="text-text-secondary hover:text-text-primary"
                    data-testid="clear-filters-btn"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Limpar
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={applyFilters}
                  className="bg-brand-primary hover:bg-brand-hover text-text-inverse"
                  data-testid="apply-filters-btn"
                >
                  Aplicar Filtros
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-surface border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Total Entradas</span>
                <span className="text-lg font-bold font-mono text-success">
                  {formatCurrency(totalCredits)}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-surface border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Total Saídas</span>
                <span className="text-lg font-bold font-mono text-error">
                  {formatCurrency(totalDebits)}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-surface border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Saldo Atual</span>
                <span className={cn(
                  'text-lg font-bold font-mono',
                  currentBalance >= 0 ? 'text-success' : 'text-error'
                )}>
                  {formatCurrency(currentBalance)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ledger List */}
        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-lg text-text-primary flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-text-secondary" />
              Movimentações
              {entries.length > 0 && (
                <span className="text-sm font-normal text-text-secondary">
                  ({entries.length} registros)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="h-12 w-12 text-text-secondary mx-auto mb-3" />
                <p className="text-text-secondary">
                  {hasActiveFilters 
                    ? 'Nenhuma movimentação encontrada com os filtros aplicados'
                    : 'Nenhuma movimentação registrada'}
                </p>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="mt-2 text-success"
                  >
                    Limpar filtros
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {entriesWithBalance.map((entry) => {
                  const config = ENTRY_TYPE_CONFIG[entry.entry_type] || {
                    label: entry.entry_type,
                    icon: BookOpen,
                    color: 'text-text-secondary',
                    bgColor: 'bg-surface-alt'
                  };
                  const Icon = config.icon;

                  return (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-4 hover:bg-surface-alt/30 transition-colors"
                      data-testid={`ledger-entry-${entry.id}`}
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={cn('p-2 rounded-lg', config.bgColor)}>
                          <Icon className={cn('h-5 w-5', config.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-text-primary">{config.label}</p>
                          <p className="text-sm text-text-secondary truncate">
                            {entry.note || '-'} • {formatDate(entry.occurred_at)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          'font-mono font-medium tabular-nums',
                          entry.direction === 'CREDIT' ? 'text-success' : 'text-error'
                        )}>
                          {entry.direction === 'CREDIT' ? '+' : '-'}{formatCurrency(entry.amount_cents)}
                        </p>
                        <p className="text-xs text-text-secondary font-mono tabular-nums">
                          Saldo: {formatCurrency(entry.runningBalance)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
