'use client';

import { useAuth } from '@/components/auth-provider';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  BarChart3, 
  Receipt, 
  Package, 
  Warehouse, 
  Users, 
  LogOut, 
  Truck, 
  Menu,
  X,
  Settings,
  ArrowLeftRight,
  RefreshCw,
} from 'lucide-react';
import { OwnerSettingsModal } from '@/components/settings/owner-settings-modal';
import { ThemeToggle } from '@/components/theme-toggle';
import { startTopReload, stopTopReload } from '@/components/top-reload-bar';
import { invalidateApiCache } from '@/lib/api';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleQuickRefresh = () => {
    setIsRefreshing(true);
    startTopReload();
    invalidateApiCache();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:refresh-active-page'));
    }
    router.refresh();
    setTimeout(() => {
      stopTopReload();
      setIsRefreshing(false);
    }, 650);
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Close mobile drawer upon route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-dvh w-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3 p-6 rounded-3xl border border-border/80 bg-card/60 backdrop-blur-xl shadow-lg">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
          <span className="text-xs font-medium tracking-wide text-muted-foreground">Loading Shree Om Tiles...</span>
        </div>
      </div>
    );
  }

  const allNavItems = [
    { name: 'Analytics', href: '/dashboard', icon: BarChart3, roles: ['OWNER', 'ADMIN'] },
    { name: 'My Dashboard', href: '/dashboard', icon: BarChart3, roles: ['SALESMAN'] },
    { name: 'Driver Dashboard', href: '/dashboard', icon: Truck, roles: ['DRIVER'] },
    { name: 'Invoices', href: '/dashboard/invoices', icon: Receipt, roles: ['OWNER', 'ADMIN', 'SALESMAN'] },
    { name: 'Deliveries', href: '/dashboard/deliveries', icon: Truck, roles: ['OWNER', 'ADMIN'] },
    { name: 'My Deliveries', href: '/dashboard/deliveries', icon: Package, roles: ['DRIVER'] },
    { name: 'Transactions', href: '/dashboard/payments', icon: ArrowLeftRight, roles: ['OWNER', 'ADMIN'] },
    { name: 'Products', href: '/dashboard/products', icon: Package, roles: ['OWNER', 'ADMIN', 'SALESMAN'] },
    { name: 'Warehouses', href: '/dashboard/warehouses', icon: Warehouse, roles: ['OWNER', 'ADMIN', 'SALESMAN'] },
    { name: 'Parties', href: '/dashboard/parties', icon: Users, roles: ['OWNER', 'ADMIN', 'SALESMAN'] },
    { name: 'Staff', href: '/dashboard/users', icon: Users, roles: ['OWNER'] },
  ];

  const navItems = allNavItems.filter((item) => item.roles.includes(user?.role || ''));

  return (
    <div className="flex flex-col md:flex-row h-dvh overflow-hidden bg-background text-foreground font-sans">
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-card/85 backdrop-blur-xl border-b border-border/80 sticky top-0 z-30 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-extrabold text-sm shadow-xs">
            SO
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground leading-none">Shree Om Tiles</h2>
            <span className="text-[10px] text-muted-foreground">Tiles & Sanitaryware</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleQuickRefresh}
            title="Refresh current page"
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-xl transition cursor-pointer"
            aria-label="Refresh current screen data"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>
          <ThemeToggle variant="compact" />
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-xl transition"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Slide-Out Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/50 dark:bg-black/75 backdrop-blur-xs z-40 md:hidden transition-opacity"
        />
      )}

      {/* Sidebar (Desktop Permanent Sticky, Mobile Slide-Out) */}
      <aside
        className={`fixed md:sticky md:top-0 inset-y-0 left-0 z-50 w-64 shrink-0 h-dvh border-r border-border/80 bg-card/95 md:bg-card/75 backdrop-blur-2xl flex flex-col justify-between overflow-hidden transform transition-transform duration-200 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col min-h-0 flex-1">
          <div className="p-5 flex items-center justify-between border-b border-border/80 shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-extrabold text-sm shadow-sm">
                SO
              </div>
              <div>
                <h2 className="text-sm font-extrabold tracking-tight text-foreground leading-none">Shree Om Tiles</h2>
                <span className="text-[11px] text-muted-foreground">Tiles & Sanitaryware</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleQuickRefresh}
                title="Refresh dashboard data"
                className="hidden md:flex p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-xl transition cursor-pointer"
                aria-label="Refresh dashboard data"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
              </button>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="md:hidden p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <nav className="p-3.5 space-y-1 overflow-y-auto flex-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Area: Theme Switcher & User Profile (Permanently Anchored to Screen Bottom) */}
        <div className="p-4 border-t border-border/80 bg-card/50 space-y-3 shrink-0">
          {/* Theme Switcher in Sidebar */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Theme</span>
            <ThemeToggle variant="pill" />
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="overflow-hidden min-w-0 pr-2">
              <p className="text-sm font-semibold text-foreground truncate">{user?.name || user?.phone}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                  {user?.role || 'SALESMAN'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleQuickRefresh}
                title="Refresh Page Data"
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition cursor-pointer"
                aria-label="Refresh data"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
              </button>
              <button
                onClick={() => setIsSettingsOpen(true)}
                title="Store Settings & Profile"
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition"
              >
                <Settings className="h-4 w-4" />
              </button>
              <button
                onClick={logout}
                title="Logout"
                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area: Scrolls independently */}
      <main className="flex-1 h-full overflow-y-auto bg-background p-3.5 sm:p-6 md:p-8">
        <div className="max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>

      {/* Owner Store Settings & Password Change Modal */}
      <OwnerSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        userRole={user?.role}
      />
    </div>
  );
}
