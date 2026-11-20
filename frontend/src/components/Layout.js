import React from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  FileText,
  FileSignature,
  Users,
  BookOpen,
  LogOut,
  Settings,
  Plus,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { supabase } from '../lib/supabase';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/receivables', label: 'Receitas', icon: ArrowDownCircle },
  { path: '/payables', label: 'Despesas', icon: ArrowUpCircle },
  { path: '/proposals', label: 'Propostas', icon: FileText },
  { path: '/contracts', label: 'Contratos', icon: FileSignature },
  { path: '/clients', label: 'Clientes', icon: Users },
  { path: '/ledger', label: 'Histórico', icon: BookOpen },
  { path: '/settings', label: 'Configurações', icon: Settings },
];

const quickActionItems = [
  {
    path: '/receivables',
    label: 'Receitas',
    description: 'Entradas e recebimentos',
    icon: ArrowDownCircle,
    colorClass: 'text-success bg-success-background border-success/30',
  },
  {
    path: '/payables',
    label: 'Despesas',
    description: 'Saídas e pagamentos',
    icon: ArrowUpCircle,
    colorClass: 'text-error bg-error-background border-error/30',
  },
  {
    path: '/proposals',
    label: 'Propostas',
    description: 'Orçamentos e propostas',
    icon: FileText,
    colorClass: 'text-info bg-info-background border-info/30',
  },
  {
    path: '/contracts',
    label: 'Contratos',
    description: 'Contratos e documentos',
    icon: FileSignature,
    colorClass: 'text-brand-primary bg-brand-light border-brand-primary/30',
  },
];

function isNavItemActive(pathname, itemPath) {
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

export function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [quickMenuOpen, setQuickMenuOpen] = React.useState(false);
  const [avatarUrl, setAvatarUrl] = React.useState('');

  React.useEffect(() => {
    let active = true;
    setAvatarUrl('');
    if (!user?.avatar_path) return () => { active = false; };

    supabase.storage
      .from('avatars')
      .createSignedUrl(user.avatar_path, 3600)
      .then(({ data, error }) => {
        if (error) {
          console.error('Error loading profile avatar:', error);
          return;
        }
        if (active) setAvatarUrl(data.signedUrl);
      })
      .catch((error) => {
        console.error('Error loading profile avatar:', error);
      });

    return () => { active = false; };
  }, [user?.avatar_path]);

  // Close quick actions menu on route change
  React.useEffect(() => {
    setQuickMenuOpen(false);
  }, [location.pathname]);

  // Close quick actions menu on Escape key
  React.useEffect(() => {
    if (!quickMenuOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setQuickMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quickMenuOpen]);

  const isQuickRouteActive = quickActionItems.some((item) => isNavItemActive(location.pathname, item.path));
  const isSettingsActive = isNavItemActive(location.pathname, '/settings');

  return (
    <div className="min-h-screen bg-surface-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-64 lg:overflow-y-auto lg:bg-surface lg:border-r lg:border-border">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center px-6 border-b border-border">
            <Link to="/dashboard" className="flex items-center">
              <img
                src={`${process.env.PUBLIC_URL || ''}/logo_ankor.svg`}
                alt="Ankor Gestão"
                className="h-7 w-auto object-contain"
              />
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = isNavItemActive(location.pathname, item.path);
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  data-testid={`nav-${item.path.slice(1)}`}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-brand-light text-brand-primary border border-brand-primary/15'
                      : 'text-text-secondary hover:bg-surface-alt hover:text-text-primary'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          {/* User info */}
          <div className="border-t border-border p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-brand-light flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-brand-primary font-medium text-sm">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{user?.name}</p>
                <p className="text-xs text-text-secondary truncate">{user?.email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              data-testid="logout-btn"
              className="w-full justify-start text-text-secondary hover:text-text-primary hover:bg-surface-alt"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-surface/95 backdrop-blur px-4">
        <Link to="/dashboard" className="flex items-center">
          <img
            src={`${process.env.PUBLIC_URL || ''}/logo_ankor.svg`}
            alt="Ankor Gestão"
            className="h-6 w-auto object-contain"
          />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={logout}
          aria-label="Sair"
          title="Sair"
          data-testid="mobile-logout-btn"
          className="h-9 w-9 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-alt"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      {/* Mobile Bottom Navigation & Quick Action Popup */}
      <div className="lg:hidden">
        {/* Quick Actions Popup */}
        {quickMenuOpen && (
          <>
            <div
              className="fixed inset-0 bg-text-primary/40 backdrop-blur-sm z-40 transition-opacity animate-in fade-in duration-200"
              onClick={() => setQuickMenuOpen(false)}
              aria-hidden="true"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Ações rápidas"
              className="fixed bottom-20 left-4 right-4 z-50 max-w-sm mx-auto bg-surface/98 backdrop-blur-md rounded-2xl border border-border shadow-2xl p-4 animate-in fade-in slide-in-from-bottom-4 duration-200"
            >
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/80">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Ações Rápidas
                </span>
                <button
                  type="button"
                  onClick={() => setQuickMenuOpen(false)}
                  className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors"
                  aria-label="Fechar menu de ações rápidas"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {quickActionItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = isNavItemActive(location.pathname, item.path);
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setQuickMenuOpen(false)}
                      data-testid={`quick-nav-${item.path.slice(1)}`}
                      className={cn(
                        'flex flex-col items-start gap-2 p-3 rounded-xl border transition-all duration-200',
                        isActive
                          ? 'bg-brand-light/70 border-brand-primary/40 text-brand-primary font-semibold shadow-sm'
                          : 'bg-surface hover:bg-surface-alt border-border text-text-primary active:scale-[0.98]'
                      )}
                    >
                      <div className={cn('p-2 rounded-lg border', item.colorClass)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium leading-tight">{item.label}</div>
                        <div className="text-[11px] text-text-secondary mt-0.5 line-clamp-1">{item.description}</div>
                      </div>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Bottom Bar */}
        <nav
          aria-label="Navegação inferior mobile"
          className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 place-items-center border-t border-border/80 bg-surface/95 backdrop-blur-md h-16 px-2 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
        >
          {/* Dashboard */}
          <NavLink
            to="/dashboard"
            data-testid="mobile-nav-dashboard"
            aria-label="Dashboard"
            title="Dashboard"
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200',
              isNavItemActive(location.pathname, '/dashboard')
                ? 'bg-brand-light text-brand-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-alt'
            )}
          >
            <LayoutDashboard className="h-5 w-5" />
          </NavLink>

          {/* Clientes */}
          <NavLink
            to="/clients"
            data-testid="mobile-nav-clients"
            aria-label="Clientes"
            title="Clientes"
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200',
              isNavItemActive(location.pathname, '/clients')
                ? 'bg-brand-light text-brand-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-alt'
            )}
          >
            <Users className="h-5 w-5" />
          </NavLink>

          {/* + Button */}
          <button
            type="button"
            onClick={() => setQuickMenuOpen((prev) => !prev)}
            data-testid="mobile-nav-plus"
            aria-expanded={quickMenuOpen}
            aria-label="Ações rápidas"
            title="Ações rápidas"
            className={cn(
              'relative flex h-11 w-11 items-center justify-center rounded-full bg-brand-primary text-text-inverse shadow-md shadow-brand-primary/30 transition-all duration-200 active:scale-95 hover:bg-brand-hover',
              isQuickRouteActive && !quickMenuOpen && 'ring-2 ring-brand-primary ring-offset-2 ring-offset-surface'
            )}
          >
            <Plus className={cn('h-5 w-5 transition-transform duration-200', quickMenuOpen && 'rotate-45')} />
            {isQuickRouteActive && !quickMenuOpen && (
              <span className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-brand-accent ring-2 ring-surface" />
            )}
          </button>

          {/* Histórico */}
          <NavLink
            to="/ledger"
            data-testid="mobile-nav-ledger"
            aria-label="Histórico"
            title="Histórico"
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200',
              isNavItemActive(location.pathname, '/ledger')
                ? 'bg-brand-light text-brand-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-alt'
            )}
          >
            <BookOpen className="h-5 w-5" />
          </NavLink>

          {/* Configurações (Avatar do usuário) */}
          <NavLink
            to="/settings"
            data-testid="mobile-nav-settings"
            aria-label="Configurações"
            title="Configurações"
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200',
              isSettingsActive
                ? 'bg-brand-light text-brand-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-alt'
            )}
          >
            <div
              className={cn(
                'h-7 w-7 shrink-0 overflow-hidden rounded-full flex items-center justify-center transition-all duration-200',
                isSettingsActive
                  ? 'ring-2 ring-brand-primary ring-offset-2 ring-offset-surface shadow-sm'
                  : 'ring-1 ring-border/80'
              )}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-semibold text-brand-primary bg-brand-light h-full w-full flex items-center justify-center">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              )}
            </div>
          </NavLink>
        </nav>
      </div>

      {/* Main Content */}
      <main className="lg:pl-64 pb-20 lg:pb-0">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
