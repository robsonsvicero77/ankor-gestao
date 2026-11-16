import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { dashboardApi, receivablesApi, payablesApi } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Target,
  ArrowDownCircle,
  ArrowUpCircle,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Calendar,
  Clock,
  LineChart as LineChartIcon
} from 'lucide-react';
import { 
  formatCurrency, 
  formatDate, 
  getRelativeDate,
  getAlertStatusColor, 
  getAlertStatusLabel,
  cn 
} from '../lib/utils';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine
} from 'recharts';

export function DashboardPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [markingPaid, setMarkingPaid] = useState(null);

  const fetchDashboard = async () => {
    try {
      const response = await dashboardApi.get();
      setDashboard(response.data);
      setError('');
    } catch (err) {
      setError('Erro ao carregar dashboard');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleMarkPaid = async (type, id) => {
    setMarkingPaid(id);
    try {
      if (type === 'receivable') {
        await receivablesApi.markPaid(id);
      } else {
        await payablesApi.markPaid(id);
      }
      await fetchDashboard();
    } catch (err) {
      console.error('Erro ao marcar como pago:', err);
    } finally {
      setMarkingPaid(null);
    }
  };

  const getAlertIcon = (status) => {
    switch (status) {
      case 'OK':
        return <CheckCircle className="h-5 w-5" />;
      case 'ATENCAO':
        return <AlertTriangle className="h-5 w-5" />;
      case 'RISCO':
        return <XCircle className="h-5 w-5" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
          <p className="text-zinc-400">{error}</p>
          <Button onClick={fetchDashboard} className="mt-4">
            Tentar novamente
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 stagger-children" data-testid="dashboard-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white">Dashboard</h1>
            <p className="text-zinc-400 text-sm mt-1">Visão geral das suas finanças</p>
          </div>
          
          {/* Alert Status Badge */}
          <div className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium',
            getAlertStatusColor(dashboard?.alert_status)
          )} data-testid="alert-status-badge">
            {getAlertIcon(dashboard?.alert_status)}
            {getAlertStatusLabel(dashboard?.alert_status)}
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Current Balance */}
          <Card className="bg-[#18181b] border-zinc-800 card-interactive">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Wallet className="h-5 w-5 text-emerald-500" />
                </div>
                <span className="text-sm text-zinc-400">Saldo Atual</span>
              </div>
              <p className={cn(
                'text-2xl font-bold font-mono tabular-nums',
                dashboard?.current_balance_cents >= 0 ? 'text-emerald-500' : 'text-red-500'
              )} data-testid="current-balance">
                {formatCurrency(dashboard?.current_balance_cents || 0)}
              </p>
            </CardContent>
          </Card>

          {/* Receivables 30d */}
          <Card className="bg-[#18181b] border-zinc-800 card-interactive">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                </div>
                <span className="text-sm text-zinc-400">Receitas (30 dias)</span>
              </div>
              <p className="text-2xl font-bold font-mono tabular-nums text-blue-500" data-testid="receivables-30d">
                {formatCurrency(dashboard?.receivables_30d_cents || 0)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {dashboard?.pending_receivables_count || 0} pendentes
                {dashboard?.overdue_receivables_count > 0 && (
                  <span className="text-red-400 ml-1">
                    ({dashboard.overdue_receivables_count} atrasadas)
                  </span>
                )}
              </p>
            </CardContent>
          </Card>

          {/* Payables 30d */}
          <Card className="bg-[#18181b] border-zinc-800 card-interactive">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-rose-500/10">
                  <TrendingDown className="h-5 w-5 text-rose-500" />
                </div>
                <span className="text-sm text-zinc-400">Despesas (30 dias)</span>
              </div>
              <p className="text-2xl font-bold font-mono tabular-nums text-rose-500" data-testid="payables-30d">
                {formatCurrency(dashboard?.payables_30d_cents || 0)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {dashboard?.pending_payables_count || 0} pendentes
                {dashboard?.overdue_payables_count > 0 && (
                  <span className="text-red-400 ml-1">
                    ({dashboard.overdue_payables_count} atrasadas)
                  </span>
                )}
              </p>
            </CardContent>
          </Card>

          {/* Projected Balance */}
          <Card className="bg-[#18181b] border-zinc-800 card-interactive">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Target className="h-5 w-5 text-purple-500" />
                </div>
                <span className="text-sm text-zinc-400">Saldo Projetado</span>
              </div>
              <p className={cn(
                'text-2xl font-bold font-mono tabular-nums',
                dashboard?.projected_balance_cents >= 0 ? 'text-purple-500' : 'text-red-500'
              )} data-testid="projected-balance">
                {formatCurrency(dashboard?.projected_balance_cents || 0)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">em 30 dias</p>
            </CardContent>
          </Card>
        </div>

        {/* Projection Chart */}
        {dashboard?.projection_chart && dashboard.projection_chart.length > 0 && (
          <Card className="bg-[#18181b] border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <LineChartIcon className="h-5 w-5 text-zinc-400" />
                Projeção de Saldo (30 dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={dashboard.projection_chart.map(d => ({
                      ...d,
                      date: new Date(d.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                      balanceFormatted: d.balance / 100
                    }))}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#71717a" 
                      fontSize={12}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      stroke="#71717a" 
                      fontSize={12}
                      tickLine={false}
                      tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#18181b', 
                        border: '1px solid #27272a',
                        borderRadius: '8px',
                        color: '#fff'
                      }}
                      formatter={(value) => [formatCurrency(value * 100), 'Saldo']}
                      labelFormatter={(label) => `Data: ${label}`}
                    />
                    <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                    <Area
                      type="monotone"
                      dataKey="balanceFormatted"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#balanceGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <Button
            onClick={() => navigate('/receivables')}
            variant="outline"
            className="h-auto py-4 border-zinc-800 hover:bg-zinc-800/50 hover:border-zinc-700"
            data-testid="add-receivable-btn"
          >
            <ArrowDownCircle className="h-5 w-5 mr-2 text-emerald-500" />
            <span className="text-white">Nova Receita</span>
          </Button>
          <Button
            onClick={() => navigate('/payables')}
            variant="outline"
            className="h-auto py-4 border-zinc-800 hover:bg-zinc-800/50 hover:border-zinc-700"
            data-testid="add-payable-btn"
          >
            <ArrowUpCircle className="h-5 w-5 mr-2 text-rose-500" />
            <span className="text-white">Nova Despesa</span>
          </Button>
        </div>

        {/* Timeline */}
        <Card className="bg-[#18181b] border-zinc-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-zinc-400" />
                Próximos 7 dias
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {dashboard?.timeline_7d?.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-400">Nenhum compromisso nos próximos 7 dias</p>
                <p className="text-zinc-500 text-sm mt-1">
                  Adicione receitas ou despesas para ver a timeline
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {dashboard?.timeline_7d?.map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="flex items-center justify-between p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-colors"
                    data-testid={`timeline-item-${item.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        'p-2 rounded-lg',
                        item.type === 'receivable' ? 'bg-emerald-500/10' : 'bg-rose-500/10'
                      )}>
                        {item.type === 'receivable' ? (
                          <ArrowDownCircle className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <ArrowUpCircle className="h-5 w-5 text-rose-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-white">{item.description}</p>
                        <p className="text-sm text-zinc-500">
                          {item.client_name || item.category} • {getRelativeDate(item.due_date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className={cn(
                        'font-mono font-medium tabular-nums',
                        item.type === 'receivable' ? 'text-emerald-500' : 'text-rose-500'
                      )}>
                        {item.type === 'receivable' ? '+' : '-'}{formatCurrency(item.amount_cents)}
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMarkPaid(item.type, item.id)}
                        disabled={markingPaid === item.id}
                        className="text-zinc-400 hover:text-emerald-500 hover:bg-emerald-500/10"
                        data-testid={`mark-paid-${item.id}`}
                      >
                        {markingPaid === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
