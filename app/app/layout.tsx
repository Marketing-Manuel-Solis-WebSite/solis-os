'use client';
import { AuthProvider, useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import NotificationBell from '@/components/notifications/notification-bell';
import { ToastProvider, FirebaseToastBridge } from '@/components/notifications/toast-provider';
import {
  LayoutDashboard, CheckSquare, FileText, MessageSquare, Zap, BarChart3,
  Users, Shield, LogOut, Menu, Bot, ChevronLeft, Sun, Moon, ChevronDown,
  Settings, Loader2,
} from 'lucide-react';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

// ============================================
// NAV ITEMS
// ============================================
const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/app' },
  { label: 'Tasks', icon: CheckSquare, href: '/app/tasks' },
  { label: 'Docs', icon: FileText, href: '/app/docs' },
  { label: 'Chat', icon: MessageSquare, href: '/app/chat' },
  { label: 'Automations', icon: Zap, href: '/app/automations' },
  { label: 'Analytics', icon: BarChart3, href: '/app/analytics' },
  { label: 'Org Chart', icon: Users, href: '/app/org-chart' },
  { label: 'Solis AI', icon: Bot, href: '/app/ai' },
];

// ============================================
// TEAM SELECTOR DROPDOWN
// ============================================
function TeamSelector() {
  const { teams, activeTeamId, setActiveTeamId, canSeeAllTeams, me, allMembers } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeTeam = teams.find(t => t.id === activeTeamId);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!canSeeAllTeams) {
    const myTeam = teams.find(t => t.id === me?.teamId);
    return (
      <div className="flex items-center gap-2 h-8 px-3 rounded-lg bg-[var(--bg-tertiary)] text-sm font-medium text-[var(--text-primary)]">
        {myTeam ? (
          <>
            <span className="text-sm">{myTeam.icon}</span>
            <span>{myTeam.name}</span>
          </>
        ) : (
          <span className="text-[var(--text-muted)]">No Department</span>
        )}
      </div>
    );
  }

  const getMemberCount = (teamId: string) => allMembers.filter(m => m.teamId === teamId || m.teamIds?.includes(teamId)).length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 h-8 px-3 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-active)] transition-all duration-200 text-sm font-medium text-[var(--text-primary)] shadow-sm"
      >
        {activeTeamId === '__all__' ? (
          <span>General</span>
        ) : activeTeam ? (
          <>
            <span className="text-sm">{activeTeam.icon}</span>
            <span>{activeTeam.name}</span>
          </>
        ) : (
          <span className="text-[var(--text-muted)]">Select Team</span>
        )}
        <ChevronDown className={`h-3.5 w-3.5 text-[var(--text-muted)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="absolute left-0 top-full mt-1.5 w-[240px] rounded-xl bg-[var(--bg-elevated)] shadow-dropdown overflow-hidden z-50"
          >
            <div className="p-1.5">
              <button
                onClick={() => { setActiveTeamId('__all__'); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-200 ${activeTeamId === '__all__' ? 'bg-[var(--accent-subtle)] text-[var(--accent)]' : 'hover:bg-[var(--bg-hover)] text-[var(--text-primary)]'}`}
              >
                <span className="text-sm font-medium">General</span>
                <span className="text-[12px] text-[var(--text-muted)] ml-auto">All depts</span>
              </button>
              <div className="h-px bg-[var(--border-subtle)] my-1 mx-2" />
              {teams.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setActiveTeamId(t.id); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-200 ${activeTeamId === t.id ? 'bg-[var(--accent-subtle)]' : 'hover:bg-[var(--bg-hover)]'}`}
                >
                  <span className="text-sm">{t.icon}</span>
                  <span className="text-sm font-medium text-[var(--text-primary)]">{t.name}</span>
                  <span className="text-[12px] text-[var(--text-muted)] ml-auto">{getMemberCount(t.id)}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// THEME TOGGLE
// ============================================
function ThemeToggle() {
  const { resolved, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all duration-200"
      aria-label="Toggle theme"
    >
      {resolved === 'dark' ? (
        <Sun className="h-5 w-5" strokeWidth={1.75} />
      ) : (
        <Moon className="h-5 w-5" strokeWidth={1.75} />
      )}
    </button>
  );
}

// ============================================
// USER MENU
// ============================================
function UserMenu() {
  const { me } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!me) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 h-8 pl-1 pr-2.5 rounded-lg hover:bg-[var(--bg-hover)] transition-all duration-200"
      >
        <div className="w-6 h-6 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center text-xs font-semibold text-[var(--accent)]">
          {(me.displayName || 'U')[0].toUpperCase()}
        </div>
        <span className="text-sm font-medium text-[var(--text-secondary)] hidden md:block">{me.displayName?.split(' ')[0]}</span>
        <ChevronDown className="h-3 w-3 text-[var(--text-muted)]" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="absolute right-0 top-full mt-1.5 w-52 rounded-xl bg-[var(--bg-elevated)] shadow-dropdown overflow-hidden z-50"
          >
            <div className="px-3 py-3">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{me.displayName}</p>
              <p className="text-[13px] text-[var(--text-muted)] mt-0.5">{me.email}</p>
              <span className="inline-block mt-1.5 text-[12px] px-1.5 py-0.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] font-medium uppercase tracking-wider">
                {me.role}
              </span>
            </div>
            <div className="h-px bg-[var(--border-subtle)] mx-2" />
            <div className="p-1.5">
              <button
                onClick={() => { router.push('/app/admin'); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all duration-200"
              >
                <Settings className="h-4 w-4" strokeWidth={1.75} /> Settings
              </button>
              <button
                onClick={() => { signOut(auth); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[var(--error)] hover:bg-[var(--error-bg)] transition-all duration-200"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.75} /> Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// SHELL
// ============================================
function Shell({ children }: { children: React.ReactNode }) {
  const { user, me, loading, isAdmin, canSeeAllTeams } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(true);

  useEffect(() => { if (!loading && !user) router.push('/login'); }, [loading, user, router]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)]">
      <div className="text-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)] mx-auto mb-3" />
        <p className="text-sm text-[var(--text-muted)]">Loading workspace...</p>
      </div>
    </div>
  );
  if (!user || !me) return null;

  const isActive = (h: string) => h === '/app' ? path === '/app' : path.startsWith(h);

  return (
    <div className="min-h-screen flex bg-[var(--bg-base)]">
      {/* ===== SIDEBAR ===== */}
      <motion.aside
        animate={{ width: open ? 240 : 60 }}
        transition={{ duration: 0.25, ease: EASE }}
        className="fixed top-0 left-0 h-full z-40 flex flex-col bg-[var(--sidebar-bg)]"
      >
        {/* Logo */}
        <div className="h-14 flex items-center px-3 gap-2.5">
          <img src="/solis-logo.png" alt="Solis" className="w-8 h-8 rounded-lg object-contain shrink-0" />
          <AnimatePresence>
            {open && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} className="min-w-0">
                <p className="text-sm font-bold text-[var(--sidebar-text-active)] tracking-wide">SOLIS CENTER</p>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={() => setOpen(!open)}
            className="p-1 text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-active)] transition-colors duration-200 ml-auto"
          >
            {open ? <ChevronLeft className="h-4 w-4" strokeWidth={1.75} /> : <Menu className="h-4 w-4" strokeWidth={1.75} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {NAV.map(n => {
            const active = isActive(n.href);
            return (
              <button
                key={n.href}
                onClick={() => router.push(n.href)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-200 relative ${
                  active
                    ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-text-active)] font-semibold'
                    : 'text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-active)] hover:bg-[var(--sidebar-hover)]'
                } ${!open ? 'justify-center px-0' : ''}`}
              >
                {active && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[var(--accent)]"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <n.icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                <AnimatePresence>
                  {open && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
                      {n.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            );
          })}

          {/* Admin section */}
          {isAdmin && (
            <>
              <AnimatePresence>
                {open && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-4 pb-1 px-2.5">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.15em] text-[var(--sidebar-text)]">Administration</p>
                  </motion.div>
                )}
              </AnimatePresence>
              {!open && <div className="pt-2 mt-2"><div className="h-px bg-[var(--sidebar-divider)] mx-2" /></div>}
              <button
                onClick={() => router.push('/app/admin')}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-200 relative ${
                  path.startsWith('/app/admin')
                    ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-text-active)] font-semibold'
                    : 'text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-active)] hover:bg-[var(--sidebar-hover)]'
                } ${!open ? 'justify-center px-0' : ''}`}
              >
                {path.startsWith('/app/admin') && (
                  <motion.div layoutId="nav-indicator" className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[var(--accent)]" />
                )}
                <Shield className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                <AnimatePresence>{open && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>Admin Console</motion.span>}</AnimatePresence>
              </button>
            </>
          )}
        </nav>

        {/* User */}
        <div className="p-3">
          <div className={`flex items-center gap-2.5 ${!open ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-lg bg-[var(--sidebar-active)] flex items-center justify-center text-xs font-semibold text-[var(--sidebar-text-active)] shrink-0">
              {(me.displayName || 'U')[0].toUpperCase()}
            </div>
            <AnimatePresence>
              {open && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--sidebar-text-active)] truncate">{me.displayName}</p>
                  <p className="text-[12px] text-[var(--sidebar-text)] truncate uppercase tracking-wider">{me.role}</p>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {open && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => signOut(auth)}
                  className="p-1.5 text-[var(--sidebar-text)] hover:text-[var(--error)] transition-colors duration-200"
                >
                  <LogOut className="h-4 w-4" strokeWidth={1.75} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.aside>

      {/* ===== MAIN ===== */}
      <motion.div animate={{ marginLeft: open ? 240 : 60 }} transition={{ duration: 0.25, ease: EASE }} className="flex-1">
        {/* Topbar */}
        <header className="h-14 sticky top-0 z-30 flex items-center justify-between px-5 bg-[var(--bg-base)]/80 backdrop-blur-md shadow-topbar">
          <div className="flex items-center gap-3 flex-1">
            <button
              onClick={() => setOpen(!open)}
              className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors duration-200 md:hidden"
            >
              <Menu className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <TeamSelector />
            {canSeeAllTeams && (
              <span className="hidden sm:inline text-[12px] px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)] font-medium tracking-wider text-[var(--text-muted)] uppercase">
                {path === '/app' ? 'DASHBOARD' : path.split('/').pop()?.toUpperCase().replace(/-/g, ' ')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell />
            <UserMenu />
          </div>
        </header>
        <main className="min-h-[calc(100vh-56px)]">
          <AnimatePresence mode="wait">
            <motion.div
              key={path}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </motion.div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <Shell>{children}</Shell>
        <FirebaseToastBridge />
      </ToastProvider>
    </AuthProvider>
  );
}
