import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
  Menu,
  X,
  Settings
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from './ui/sheet';
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

const mobileNavItems = navItems.filter((item) => item.path !== '/settings');

function isNavItemActive(pathname, itemPath) {
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

export function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
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

  return (
    <div className="min-h-screen bg-surface-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-64 lg:overflow-y-auto lg:bg-surface lg:border-r lg:border-border">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center px-6 border-b border-border">
            <h1 className="text-xl font-bold text-text-primary">
              <span className="text-brand-accent">Ankor</span><span className="text-brand-primary">Gestão</span>
            </h1>
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
      <header className="lg:hidden sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-surface/95 backdrop-blur px-4">
        <h1 className="text-lg font-bold text-text-primary">
          <span className="text-brand-accent">Ankor</span><span className="text-brand-primary">Gestão</span>
        </h1>
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={mobileMenuOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação'}
              data-testid="mobile-menu-btn"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="top-14 bottom-0 h-auto w-64 border-l border-border p-4">
            <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
            <SheetDescription className="sr-only">Navegação principal do sistema</SheetDescription>
            <nav aria-label="Navegação principal" className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = isNavItemActive(location.pathname, item.path);
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-brand-light text-brand-primary'
                        : 'text-text-secondary hover:bg-surface-alt hover:text-text-primary'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
            <div className="absolute bottom-4 left-4 right-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="w-full justify-start text-text-secondary hover:text-text-primary"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border bg-surface/95 backdrop-blur h-16">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = isNavItemActive(location.pathname, item.path);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              data-testid={`mobile-nav-${item.path.slice(1)}`}
              className={cn(
                'flex min-w-0 flex-col items-center gap-1 px-1 py-2 rounded-lg transition-colors',
                isActive ? 'text-brand-primary' : 'text-text-secondary'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="max-w-full truncate text-[10px] font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Main Content */}
      <main className="lg:pl-64 pb-20 lg:pb-0">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
