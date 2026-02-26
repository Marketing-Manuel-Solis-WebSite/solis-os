'use client';
import { AuthProvider, useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import NotificationBell from '@/components/notifications/notification-bell';
import {
  LayoutDashboard, CheckSquare, FileText, MessageSquare, Zap, BarChart3,
  Users, Shield, LogOut, Menu, Bot, ChevronLeft, Sun, Moon, ChevronDown,
  Settings, User, Search,
} from 'lucide-react';

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

  const teamList = canSeeAllTeams ? teams : teams.filter(t => me?.teamIds?.includes(t.id));
  const getMemberCount = (teamId: string) => allMembers.filter(m => m.teamId === teamId || m.teamIds?.includes(teamId)).length;

  return (
    <div ref={ref} className="relative">
      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 h-10 px-3.5 rounded-xl border transition-all"
        style={{
          background: activeTeam ? `${activeTeam.color}10` : 'var(--bg-card)',
          borderColor: activeTeam ? `${activeTeam.color}30` : 'var(--border)',
        }}
      >
        {activeTeamId === '__all__' ? (
          <>
            <span className="text-sm">🏢</span>
            <span className="text-sm font-semibold text-[var(--gold)]">All Teams</span>
          </>
        ) : activeTeam ? (
          <>
            <span className="text-sm">{activeTeam.icon}</span>
            <span className="text-sm font-semibold" style={{ color: activeTeam.color }}>{activeTeam.name}</span>
          </>
        ) : (
          <span className="text-sm text-[var(--text-muted)]">Select Team</span>
        )}
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="absolute left-0 top-full mt-2 w-[260px] rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] shadow-2xl shadow-black/20 overflow-hidden z-50"
          >
            <div className="p-2">
              {canSeeAllTeams && (
                <button onClick={() => { setActiveTeamId('__all__'); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${activeTeamId === '__all__' ? 'bg-[var(--gold)]/10' : 'hover:bg-[var(--hover-bg)]'}`}>
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#D4A843]/20 to-[#D4A843]/5 flex items-center justify-center text-sm">🏢</div>
                  <div className="text-left flex-1">
                    <p className="text-sm font-semibold text-[var(--gold)]">All Teams</p>
                    <p className="text-[10px] text-[var(--text-muted)]">{allMembers.length} members</p>
                  </div>
                  {activeTeamId === '__all__' && <div className="w-2 h-2 rounded-full bg-[var(--gold)] shadow-[0_0_6px_rgba(212,168,67,0.5)]" />}
                </button>
              )}
              {canSeeAllTeams && teamList.length > 0 && <div className="h-px bg-[var(--border)] my-1.5 mx-3" />}
              {teamList.map(t => (
                <button key={t.id} onClick={() => { setActiveTeamId(t.id); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${activeTeamId === t.id ? 'bg-[var(--hover-bg)]' : 'hover:bg-[var(--hover-bg)]'}`}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base" style={{ backgroundColor: `${t.color}15` }}>
                    {t.icon}
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm font-medium" style={{ color: t.color }}>{t.name}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">{getMemberCount(t.id)} members</p>
                  </div>
                  {activeTeamId === t.id && <div className="w-2 h-2 rounded-full shadow-lg" style={{ backgroundColor: t.color, boxShadow: `0 0 6px ${t.color}80` }} />}
                  <div className="w-1 h-6 rounded-full" style={{ backgroundColor: `${t.color}30` }} />
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
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.9, rotate: 15 }}
      onClick={toggle}
      className="p-2.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition"
    >
      <AnimatePresence mode="wait" initial={false}>
        {resolved === 'dark' ? (
          <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
            <Sun className="h-[18px] w-[18px]" />
          </motion.div>
        ) : (
          <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
            <Moon className="h-[18px] w-[18px]" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
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
      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 h-10 pl-1.5 pr-3 rounded-xl hover:bg-[var(--bg-card)] transition">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#D4A843]/30 to-[#D4A843]/10 flex items-center justify-center text-xs font-bold text-[#D4A843] border border-[#D4A843]/15">
          {(me.displayName || 'U')[0].toUpperCase()}
        </div>
        <span className="text-sm font-medium text-[var(--text-secondary)] hidden md:block">{me.displayName?.split(' ')[0]}</span>
        <ChevronDown className="h-3 w-3 text-[var(--text-muted)]" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] shadow-2xl shadow-black/20 overflow-hidden z-50"
          >
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{me.displayName}</p>
              <p className="text-[11px] text-[var(--text-muted)]">{me.email}</p>
              <span className="inline-block mt-1 text-[9px] px-2 py-0.5 rounded-full bg-[#D4A843]/10 text-[#D4A843] font-bold uppercase tracking-wider">{me.role}</span>
            </div>
            <div className="p-1.5">
              <button onClick={() => { router.push('/app/admin'); setOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition">
                <Settings className="h-4 w-4" /> Settings
              </button>
              <button onClick={() => { signOut(auth); setOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/5 transition">
                <LogOut className="h-4 w-4" /> Sign Out
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
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#D4A843] to-[#9A7B2F] flex items-center justify-center mx-auto mb-4 pulse-gold">
          <Zap className="h-6 w-6 text-[#06080F]" />
        </div>
        <p className="text-sm text-[var(--text-muted)]">Loading workspace...</p>
      </motion.div>
    </div>
  );
  if (!user || !me) return null;

  const isActive = (h: string) => h === '/app' ? path === '/app' : path.startsWith(h);

  return (
    <div className="min-h-screen flex bg-[var(--bg-base)]">
      {/* ===== SIDEBAR ===== */}
      <motion.aside
        animate={{ width: open ? 240 : 68 }}
        transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="fixed top-0 left-0 h-full z-40 flex flex-col bg-[var(--bg-base)] border-r border-[var(--border)]"
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 gap-3 border-b border-[var(--border)]">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#D4A843] to-[#9A7B2F] flex items-center justify-center shrink-0 shadow-lg shadow-[#D4A843]/10">
            <Zap className="h-4 w-4 text-[#06080F]" />
          </motion.div>
          <AnimatePresence>
            {open && (
              <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15 }} className="min-w-0">
                <p className="text-sm font-bold text-[var(--text-primary)] tracking-wide">SOLIS</p>
                <p className="text-[10px] text-[#D4A843] tracking-widest uppercase">center</p>
              </motion.div>
            )}
          </AnimatePresence>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setOpen(!open)}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition ml-auto">
            {open ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </motion.button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {NAV.map(n => {
            const active = isActive(n.href);
            return (
              <motion.button key={n.href} whileHover={{ x: 2 }} whileTap={{ scale: 0.97 }}
                onClick={() => router.push(n.href)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all relative group ${
                  active
                    ? 'bg-[#D4A843]/10 text-[#D4A843] font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
                } ${!open ? 'justify-center px-0' : ''}`}
              >
                {active && (
                  <motion.div layoutId="nav-indicator" className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-[#D4A843] shadow-[0_0_8px_rgba(212,168,67,0.5)]"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }} />
                )}
                <n.icon className={`h-[18px] w-[18px] shrink-0 transition ${active ? 'drop-shadow-[0_0_6px_rgba(212,168,67,0.4)]' : ''}`} />
                <AnimatePresence>
                  {open && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
                      {n.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}

          {/* Admin section */}
          {isAdmin && (
            <>
              <AnimatePresence>
                {open && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-5 pb-1 px-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Administration</p>
                  </motion.div>
                )}
              </AnimatePresence>
              {!open && <div className="pt-3 border-t border-[var(--border)] mt-3" />}
              <motion.button whileHover={{ x: 2 }} whileTap={{ scale: 0.97 }}
                onClick={() => router.push('/app/admin')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all relative ${
                  path.startsWith('/app/admin') ? 'bg-[#D4A843]/10 text-[#D4A843] font-semibold' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
                } ${!open ? 'justify-center px-0' : ''}`}
              >
                {path.startsWith('/app/admin') && (
                  <motion.div layoutId="nav-indicator" className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-[#D4A843] shadow-[0_0_8px_rgba(212,168,67,0.5)]" />
                )}
                <Shield className="h-[18px] w-[18px] shrink-0" />
                <AnimatePresence>{open && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>Admin Console</motion.span>}</AnimatePresence>
              </motion.button>
            </>
          )}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-[var(--border)]">
          <div className={`flex items-center gap-3 ${!open ? 'justify-center' : ''}`}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#D4A843]/20 to-[#D4A843]/5 flex items-center justify-center text-sm font-bold text-[#D4A843] shrink-0 border border-[#D4A843]/10">
              {(me.displayName || 'U')[0].toUpperCase()}
            </div>
            <AnimatePresence>
              {open && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">{me.displayName}</p>
                  <p className="text-[10px] text-[var(--text-muted)] truncate">{me.role.toUpperCase()}</p>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {open && (
                <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                  onClick={() => signOut(auth)} className="p-1.5 text-[var(--text-muted)] hover:text-red-400 transition">
                  <LogOut className="h-4 w-4" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.aside>

      {/* ===== MAIN ===== */}
      <motion.div animate={{ marginLeft: open ? 240 : 68 }} transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }} className="flex-1">
        {/* Topbar */}
        <header className="h-16 glass sticky top-0 z-30 flex items-center justify-between px-6 border-b border-[var(--border)]">
          <div className="flex items-center gap-3 flex-1">
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setOpen(!open)}
              className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition md:hidden">
              <Menu className="h-4 w-4" />
            </motion.button>
            <TeamSelector />
            {canSeeAllTeams && (
              <span className="hidden sm:inline text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wider bg-[#D4A843]/10 text-[#D4A843] border border-[#D4A843]/20">
                {path === '/app' ? 'DASHBOARD' : path.split('/').pop()?.toUpperCase().replace(/-/g, ' ')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell />
            <div className="w-px h-6 bg-[var(--border)] mx-1.5" />
            <UserMenu />
          </div>
        </header>
        <main className="min-h-[calc(100vh-64px)]">
          <AnimatePresence mode="wait">
            <motion.div
              key={path}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
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
  return <AuthProvider><Shell>{children}</Shell></AuthProvider>;
}
