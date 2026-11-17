import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { payablesApi } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { 
  Plus, 
  Search, 
  Filter, 
  ArrowUpCircle, 
  Loader2,
  CheckCircle,
  Pencil,
  Trash2,
  AlertTriangle,
  Repeat
} from 'lucide-react';
import { 
  formatCurrency, 
  getRelativeDate,
  getStatusColor,
  getStatusLabel,
  parseCurrencyToCents,
  cn 
} from '../lib/utils';

const CATEGORIES = [
  { value: 'aluguel', label: 'Aluguel' },
  { value: 'salarios', label: 'Salários' },
  { value: 'fornecedores', label: 'Fornecedores' },
  { value: 'impostos', label: 'Impostos' },
  { value: 'servicos', label: 'Serviços' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'equipamentos', label: 'Equipamentos' },
  { value: 'outros', label: 'Outros' },
];

export function PayablesPage() {
  const [payables, setPayables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    description: '',
    category: '',
    amount: '',
    due_date: '',
    is_recurring: false,
    recurrence_type: '',
    recurrence_end_date: ''
  });

  const fetchPayables = async () => {
    setLoading(true);
    try {
      const response = await payablesApi.list();
      setPayables(response.data);
    } catch (err) {
      console.error('Erro ao carregar despesas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayables();
  }, []);

  const filteredPayables = payables.filter((item) => {
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesSearch = 
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const openCreateDialog = () => {
    setEditingItem(null);
    setFormData({
      description: '',
      category: '',
      amount: '',
      due_date: new Date().toISOString().split('T')[0],
      is_recurring: false,
      recurrence_type: '',
      recurrence_end_date: ''
    });
    setDialogOpen(true);
  };

  const openEditDialog = (item) => {
    setEditingItem(item);
    setFormData({
      description: item.description,
      category: item.category,
      amount: (item.amount_cents / 100).toFixed(2).replace('.', ','),
      due_date: item.due_date.split('T')[0],
      is_recurring: item.is_recurring || false,
      recurrence_type: item.recurrence_type || '',
      recurrence_end_date: item.recurrence_end_date ? item.recurrence_end_date.split('T')[0] : ''
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const data = {
        description: formData.description,
        category: formData.category,
        amount_cents: parseCurrencyToCents(formData.amount),
        due_date: new Date(formData.due_date).toISOString(),
        is_recurring: formData.is_recurring,
        recurrence_type: formData.is_recurring ? formData.recurrence_type : null,
        recurrence_end_date: formData.is_recurring && formData.recurrence_end_date 
          ? new Date(formData.recurrence_end_date).toISOString() 
          : null
      };

      if (editingItem) {
        await payablesApi.update(editingItem.id, data);
      } else {
        await payablesApi.create(data);
      }

      setDialogOpen(false);
      await fetchPayables();
    } catch (err) {
      console.error('Erro ao salvar despesa:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkPaid = async (id) => {
    setMarkingPaid(id);
    try {
      await payablesApi.markPaid(id);
      await fetchPayables();
    } catch (err) {
      console.error('Erro ao marcar como pago:', err);
    } finally {
      setMarkingPaid(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    setSubmitting(true);
    try {
      await payablesApi.delete(deletingItem.id);
      setDeleteDialogOpen(false);
      setDeletingItem(null);
      await fetchPayables();
    } catch (err) {
      console.error('Erro ao excluir despesa:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteDialog = (item) => {
    setDeletingItem(item);
    setDeleteDialogOpen(true);
  };

  const getCategoryLabel = (value) => {
    return CATEGORIES.find(c => c.value === value)?.label || value;
  };

  const totals = {
    pending: filteredPayables.filter(p => p.status === 'PENDENTE').reduce((sum, p) => sum + p.amount_cents, 0),
    overdue: filteredPayables.filter(p => p.status === 'ATRASADO').reduce((sum, p) => sum + p.amount_cents, 0),
    paid: filteredPayables.filter(p => p.status === 'PAGO').reduce((sum, p) => sum + p.amount_cents, 0),
  };

  return (
    <Layout>
      <div className="space-y-6" data-testid="payables-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-text-primary">Despesas a Pagar</h1>
            <p className="text-text-secondary text-sm mt-1">Gerencie suas despesas pendentes</p>
          </div>
          <Button
            onClick={openCreateDialog}
            className="bg-brand-primary hover:bg-brand-hover text-text-inverse btn-press"
            data-testid="create-payable-btn"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Despesa
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-surface border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Pendente</span>
                <span className="text-lg font-bold font-mono text-warning">
                  {formatCurrency(totals.pending)}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-surface border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Atrasado</span>
                <span className="text-lg font-bold font-mono text-error">
                  {formatCurrency(totals.overdue)}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-surface border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">Pago</span>
                <span className="text-lg font-bold font-mono text-success">
                  {formatCurrency(totals.paid)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
            <Input
              placeholder="Buscar despesas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="search-payables-input"
              className="pl-10 bg-surface border-border text-text-primary placeholder:text-text-secondary"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48 bg-surface border-border text-text-primary" data-testid="status-filter-select">
              <Filter className="h-4 w-4 mr-2 text-text-secondary" />
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent className="bg-surface border-border">
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="PENDENTE">Pendente</SelectItem>
              <SelectItem value="ATRASADO">Atrasado</SelectItem>
              <SelectItem value="PAGO">Pago</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        <Card className="bg-surface border-border">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-error" />
              </div>
            ) : filteredPayables.length === 0 ? (
              <div className="text-center py-12">
                <ArrowUpCircle className="h-12 w-12 text-text-secondary mx-auto mb-3" />
                <p className="text-text-secondary">Nenhuma despesa encontrada</p>
                <p className="text-text-secondary text-sm mt-1">
                  {payables.length === 0 
                    ? 'Comece adicionando sua primeira despesa'
                    : 'Tente ajustar os filtros'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredPayables.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 hover:bg-surface-alt/30 transition-colors"
                    data-testid={`payable-item-${item.id}`}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="p-2 rounded-lg bg-error-background">
                        <ArrowUpCircle className="h-5 w-5 text-error" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-text-primary truncate">{item.description}</p>
                        <p className="text-sm text-text-secondary truncate">
                          {getCategoryLabel(item.category)} • {getRelativeDate(item.due_date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-mono font-medium tabular-nums text-error">
                          {formatCurrency(item.amount_cents)}
                        </p>
                        <span className={cn(
                          'inline-flex px-2 py-0.5 rounded text-xs font-medium',
                          getStatusColor(item.status)
                        )}>
                          {getStatusLabel(item.status)}
                        </span>
                      </div>
                      {item.status !== 'PAGO' && (
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleMarkPaid(item.id)}
                            disabled={markingPaid === item.id}
                            className="h-8 w-8 text-text-secondary hover:text-brand-hover hover:bg-success-background"
                            title="Marcar como pago"
                            data-testid={`mark-paid-btn-${item.id}`}
                          >
                            {markingPaid === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEditDialog(item)}
                            className="h-8 w-8 text-text-secondary hover:text-text-primary hover:bg-surface-alt"
                            title="Editar"
                            data-testid={`edit-btn-${item.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openDeleteDialog(item)}
                            className="h-8 w-8 text-text-secondary hover:text-error hover:bg-error-background"
                            title="Excluir"
                            data-testid={`delete-btn-${item.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="bg-surface border-border sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-text-primary">
                {editingItem ? 'Editar Despesa' : 'Nova Despesa'}
              </DialogTitle>
              <DialogDescription className="text-text-secondary">
                {editingItem 
                  ? 'Atualize os dados da despesa' 
                  : 'Preencha os dados para criar uma nova despesa'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="description" className="text-text-secondary">Descrição</Label>
                <Input
                  id="description"
                  placeholder="Ex: Aluguel do escritório"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  data-testid="payable-description-input"
                  className="bg-surface border-border text-text-primary placeholder:text-text-secondary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category" className="text-text-secondary">Categoria</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                  required
                >
                  <SelectTrigger className="bg-surface border-border text-text-primary" data-testid="payable-category-select">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent className="bg-surface border-border">
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-text-secondary">Valor (R$)</Label>
                <Input
                  id="amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value.replace(/[^\d,]/g, '') })}
                  required
                  data-testid="payable-amount-input"
                  className="bg-surface border-border text-text-primary placeholder:text-text-secondary font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date" className="text-text-secondary">Data de Vencimento</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  required
                  data-testid="payable-date-input"
                  className="bg-surface border-border text-text-primary"
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="border-border text-text-secondary hover:bg-surface-alt"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || !formData.category}
                  className="bg-brand-primary hover:bg-brand-hover text-text-inverse"
                  data-testid="save-payable-btn"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="bg-surface border-border sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-text-primary flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-error" />
                Excluir Despesa
              </DialogTitle>
              <DialogDescription className="text-text-secondary">
                Tem certeza que deseja excluir "{deletingItem?.description}"? 
                Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
                className="border-border text-text-secondary hover:bg-surface-alt"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleDelete}
                disabled={submitting}
                className="bg-error hover:bg-error/90 active:bg-error/80 text-text-inverse"
                data-testid="confirm-delete-btn"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  'Excluir'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
