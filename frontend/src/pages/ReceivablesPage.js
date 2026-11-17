import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { clientsApi, receivablesApi, remindersApi } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
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
  ArrowDownCircle, 
  Loader2,
  CheckCircle,
  Pencil,
  Trash2,
  AlertTriangle,
  Calendar,
  Mail,
  Send,
  Repeat
} from 'lucide-react';
import { 
  formatCurrency, 
  formatDate, 
  getRelativeDate,
  getStatusColor,
  getStatusLabel,
  parseCurrencyToCents,
  cn 
} from '../lib/utils';

export function ReceivablesPage() {
  const [receivables, setReceivables] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [reminderItem, setReminderItem] = useState(null);
  const [reminderMessage, setReminderMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(null);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderResult, setReminderResult] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    description: '',
    client_name: '',
    client_id: '',
    amount: '',
    due_date: '',
    is_recurring: false,
    recurrence_type: '',
    recurrence_end_date: ''
  });

  const fetchReceivables = async () => {
    setLoading(true);
    try {
      const [receivablesResponse, clientsResponse] = await Promise.all([
        receivablesApi.list(),
        clientsApi.list(),
      ]);
      setReceivables(receivablesResponse.data);
      setClients(clientsResponse.data);
    } catch (err) {
      console.error('Erro ao carregar receitas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceivables();
  }, []);

  const filteredReceivables = receivables.filter((item) => {
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesSearch = 
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.client_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const openCreateDialog = () => {
    setEditingItem(null);
    setFormData({
      description: '',
      client_name: '',
      client_id: '',
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
      client_name: item.client_name,
      client_id: item.client_id || '',
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
        client_name: formData.client_name,
        client_id: formData.client_id || null,
        amount_cents: parseCurrencyToCents(formData.amount),
        due_date: new Date(formData.due_date).toISOString(),
        is_recurring: formData.is_recurring,
        recurrence_type: formData.is_recurring ? formData.recurrence_type : null,
        recurrence_end_date: formData.is_recurring && formData.recurrence_end_date 
          ? new Date(formData.recurrence_end_date).toISOString() 
          : null
      };

      if (editingItem) {
        await receivablesApi.update(editingItem.id, data);
      } else {
        await receivablesApi.create(data);
      }

      setDialogOpen(false);
      await fetchReceivables();
    } catch (err) {
      console.error('Erro ao salvar receita:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkPaid = async (id) => {
    setMarkingPaid(id);
    try {
      await receivablesApi.markPaid(id);
      await fetchReceivables();
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
      await receivablesApi.delete(deletingItem.id);
      setDeleteDialogOpen(false);
      setDeletingItem(null);
      await fetchReceivables();
    } catch (err) {
      console.error('Erro ao excluir receita:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteDialog = (item) => {
    setDeletingItem(item);
    setDeleteDialogOpen(true);
  };

  const openReminderDialog = (item) => {
    setReminderItem(item);
    setReminderMessage('');
    setReminderResult(null);
    setReminderDialogOpen(true);
  };

  const handleSendReminder = async () => {
    if (!reminderItem) return;
    setSendingReminder(true);
    setReminderResult(null);
    
    try {
      const response = await remindersApi.send(reminderItem.id, reminderMessage);
      setReminderResult({ success: true, message: response.data.message });
    } catch (err) {
      setReminderResult({ 
        success: false, 
        message: err.response?.data?.detail || 'Erro ao enviar lembrete' 
      });
    } finally {
      setSendingReminder(false);
    }
  };

  const totals = {
    pending: filteredReceivables.filter(r => r.status === 'PENDENTE').reduce((sum, r) => sum + r.amount_cents, 0),
    overdue: filteredReceivables.filter(r => r.status === 'ATRASADO').reduce((sum, r) => sum + r.amount_cents, 0),
    paid: filteredReceivables.filter(r => r.status === 'PAGO').reduce((sum, r) => sum + r.amount_cents, 0),
  };

  return (
    <Layout>
      <div className="space-y-6" data-testid="receivables-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white">Receitas a Receber</h1>
            <p className="text-zinc-400 text-sm mt-1">Gerencie suas receitas pendentes</p>
          </div>
          <Button
            onClick={openCreateDialog}
            className="bg-emerald-600 hover:bg-emerald-700 text-white btn-press"
            data-testid="create-receivable-btn"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Receita
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-[#18181b] border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Pendente</span>
                <span className="text-lg font-bold font-mono text-amber-500">
                  {formatCurrency(totals.pending)}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-[#18181b] border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Atrasado</span>
                <span className="text-lg font-bold font-mono text-red-500">
                  {formatCurrency(totals.overdue)}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-[#18181b] border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Recebido</span>
                <span className="text-lg font-bold font-mono text-emerald-500">
                  {formatCurrency(totals.paid)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Buscar receitas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="search-receivables-input"
              className="pl-10 bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-500"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48 bg-zinc-900/50 border-zinc-800 text-white" data-testid="status-filter-select">
              <Filter className="h-4 w-4 mr-2 text-zinc-500" />
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800">
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="PENDENTE">Pendente</SelectItem>
              <SelectItem value="ATRASADO">Atrasado</SelectItem>
              <SelectItem value="PAGO">Pago</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        <Card className="bg-[#18181b] border-zinc-800">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              </div>
            ) : filteredReceivables.length === 0 ? (
              <div className="text-center py-12">
                <ArrowDownCircle className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-400">Nenhuma receita encontrada</p>
                <p className="text-zinc-500 text-sm mt-1">
                  {receivables.length === 0 
                    ? 'Comece adicionando sua primeira receita'
                    : 'Tente ajustar os filtros'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {filteredReceivables.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 hover:bg-zinc-800/30 transition-colors"
                    data-testid={`receivable-item-${item.id}`}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="p-2 rounded-lg bg-emerald-500/10">
                        <ArrowDownCircle className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{item.description}</p>
                        <p className="text-sm text-zinc-500 truncate">
                          {item.client_name} • {getRelativeDate(item.due_date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-mono font-medium tabular-nums text-emerald-500">
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
                            onClick={() => openReminderDialog(item)}
                            disabled={!clients.find((client) => client.id === item.client_id)?.email}
                            className="h-8 w-8 text-zinc-400 hover:text-blue-500 hover:bg-blue-500/10"
                            title={clients.find((client) => client.id === item.client_id)?.email
                              ? 'Enviar lembrete ao cliente'
                              : 'Vincule um cliente cadastrado com e-mail'}
                            data-testid={`reminder-btn-${item.id}`}
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleMarkPaid(item.id)}
                            disabled={markingPaid === item.id}
                            className="h-8 w-8 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-500/10"
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
                            className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800"
                            title="Editar"
                            data-testid={`edit-btn-${item.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openDeleteDialog(item)}
                            className="h-8 w-8 text-zinc-400 hover:text-red-500 hover:bg-red-500/10"
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
          <DialogContent className="bg-[#18181b] border-zinc-800 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white">
                {editingItem ? 'Editar Receita' : 'Nova Receita'}
              </DialogTitle>
              <DialogDescription className="text-zinc-400">
                {editingItem 
                  ? 'Atualize os dados da receita' 
                  : 'Preencha os dados para criar uma nova receita'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="description" className="text-zinc-300">Descrição</Label>
                <Input
                  id="description"
                  placeholder="Ex: Serviço de consultoria"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  data-testid="receivable-description-input"
                  className="bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="receivable-client-select" className="text-zinc-300">Cliente</Label>
                <select
                  id="receivable-client-select"
                  value={formData.client_id}
                  onChange={(event) => {
                    const selected = clients.find((client) => client.id === event.target.value);
                    setFormData({
                      ...formData,
                      client_id: selected?.id || '',
                      client_name: selected ? (selected.trade_name || selected.name) : '',
                    });
                  }}
                  className="h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                  data-testid="receivable-client-select"
                >
                  <option value="">Informar nome manualmente (sem vínculo)</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.trade_name || client.name}{client.email ? ` · ${client.email}` : ' · sem e-mail'}
                    </option>
                  ))}
                </select>
                {formData.client_id ? (
                  <p className="text-xs text-zinc-400">
                    {clients.find((client) => client.id === formData.client_id)?.email
                      ? `Lembretes serão enviados para ${clients.find((client) => client.id === formData.client_id).email}.`
                      : 'Este cliente não tem e-mail cadastrado; lembretes por e-mail ficarão indisponíveis.'}
                  </p>
                ) : (
                  <Input
                    id="client_name"
                    placeholder="Nome do cliente"
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                    required
                    data-testid="receivable-client-input"
                    className="bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-500"
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-zinc-300">Valor (R$)</Label>
                <Input
                  id="amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value.replace(/[^\d,]/g, '') })}
                  required
                  data-testid="receivable-amount-input"
                  className="bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-500 font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date" className="text-zinc-300">Data de Vencimento</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  required
                  data-testid="receivable-date-input"
                  className="bg-zinc-900/50 border-zinc-800 text-white"
                />
              </div>
              
              {/* Recurrence Section */}
              {!editingItem && (
                <div className="space-y-4 pt-4 border-t border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Repeat className="h-4 w-4 text-zinc-400" />
                      <Label htmlFor="is_recurring" className="text-zinc-300">Receita Recorrente</Label>
                    </div>
                    <Switch
                      id="is_recurring"
                      checked={formData.is_recurring}
                      onCheckedChange={(checked) => setFormData({ 
                        ...formData, 
                        is_recurring: checked,
                        recurrence_type: checked ? 'monthly' : ''
                      })}
                      data-testid="receivable-recurring-switch"
                    />
                  </div>
                  
                  {formData.is_recurring && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-zinc-300 text-sm">Frequência</Label>
                        <Select 
                          value={formData.recurrence_type} 
                          onValueChange={(v) => setFormData({...formData, recurrence_type: v})}
                        >
                          <SelectTrigger className="bg-zinc-900/50 border-zinc-800 text-white" data-testid="recurrence-type-select">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-900 border-zinc-800">
                            <SelectItem value="weekly">Semanal</SelectItem>
                            <SelectItem value="monthly">Mensal</SelectItem>
                            <SelectItem value="yearly">Anual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-zinc-300 text-sm">Até (opcional)</Label>
                        <Input
                          type="date"
                          value={formData.recurrence_end_date}
                          onChange={(e) => setFormData({ ...formData, recurrence_end_date: e.target.value })}
                          data-testid="recurrence-end-date"
                          className="bg-zinc-900/50 border-zinc-800 text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  data-testid="save-receivable-btn"
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
          <DialogContent className="bg-[#18181b] border-zinc-800 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Excluir Receita
              </DialogTitle>
              <DialogDescription className="text-zinc-400">
                Tem certeza que deseja excluir "{deletingItem?.description}"? 
                Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleDelete}
                disabled={submitting}
                className="bg-red-600 hover:bg-red-700 text-white"
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

        {/* Reminder Dialog */}
        <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
          <DialogContent className="bg-[#18181b] border-zinc-800 sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-500" />
                Enviar Lembrete de Pagamento
              </DialogTitle>
              <DialogDescription className="text-zinc-400">
                Envie um lembrete para o cliente sobre esta receita pendente.
              </DialogDescription>
            </DialogHeader>
            
            {reminderItem && !reminderResult && (
              <div className="space-y-4 py-2">
                <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
                  <p className="font-medium text-white">{reminderItem.description}</p>
                  <p className="text-sm text-zinc-500 mt-1">
                    Cliente: {reminderItem.client_name}
                  </p>
                  <p className="text-xs text-zinc-400">
                    Destinatário: {clients.find((client) => client.id === reminderItem.client_id)?.email || 'e-mail indisponível'}
                  </p>
                  <p className="text-lg font-mono font-bold text-emerald-500 mt-2">
                    {formatCurrency(reminderItem.amount_cents)}
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Vencimento: {getRelativeDate(reminderItem.due_date)}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-zinc-300">Mensagem personalizada (opcional)</Label>
                  <Textarea
                    placeholder="Adicione uma mensagem personalizada ao lembrete..."
                    value={reminderMessage}
                    onChange={(e) => setReminderMessage(e.target.value)}
                    className="bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-500 min-h-[80px]"
                    data-testid="reminder-message-input"
                  />
                </div>
              </div>
            )}

            {reminderResult && (
              <div className={cn(
                'p-4 rounded-lg flex items-start gap-3 my-4',
                reminderResult.success 
                  ? 'bg-emerald-500/10 border border-emerald-500/20'
                  : 'bg-red-500/10 border border-red-500/20'
              )}>
                {reminderResult.success ? (
                  <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className={cn(
                    'font-medium',
                    reminderResult.success ? 'text-emerald-500' : 'text-red-500'
                  )}>
                    {reminderResult.success ? 'Lembrete enviado!' : 'Erro ao enviar'}
                  </p>
                  <p className="text-sm text-zinc-400 mt-1">{reminderResult.message}</p>
                </div>
              </div>
            )}

            <DialogFooter>
              {reminderResult ? (
                <Button
                  onClick={() => {
                    setReminderDialogOpen(false);
                    setReminderResult(null);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Fechar
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setReminderDialogOpen(false)}
                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSendReminder}
                    disabled={sendingReminder}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    data-testid="send-reminder-btn"
                  >
                    {sendingReminder ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Enviar Lembrete
                      </>
                    )}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
