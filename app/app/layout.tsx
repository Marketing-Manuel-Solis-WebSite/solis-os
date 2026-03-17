'use client';
import { AuthProvider, useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import NotificationBell from '@/components/notifications/notification-bell';
import FloatingAIChat from '@/components/ai/floating-ai-chat';
import { ToastProvider, FirebaseToastBridge } from '@/components/notifications/toast-provider';
import { NotificationProvider } from '@/components/notifications/notification-context';
import CommandPaletteProvider, { useCommandPalette } from '@/components/command-palette/command-palette-provider';
import { QueryProvider } from '@/lib/query-provider';
import { FeatureFlagProvider } from '@/lib/feature-flags';
import {
  LayoutDashboard, CheckSquare, FileText, MessageSquare, Zap, BarChart3,
  Users, Shield, LogOut, Menu, Bot, ChevronLeft, ChevronRight, Sun, Moon, ChevronDown,
  Settings, Loader2, CalendarDays, MoreHorizontal, Target, Clock, PenTool, FileInput, Plug, Search,
  Layers, Star, LayoutTemplate, Share2, EyeOff, GripVertical, Eye, Bell, X,
} from 'lucide-react';
import SpaceSidebarTree from '@/components/spaces/space-sidebar-tree';
import SpaceFeaturesPanel from '@/components/spaces/space-features-panel';
import NotificationSettings from '@/components/settings/notification-settings';
import PwaInstallPrompt from '@/components/shared/pwa-install-prompt';
import ShortcutsHelpModal from '@/components/shared/shortcuts-help-modal';
import { useGlobalShortcuts } from '@/lib/hooks/use-global-shortcuts';
import { useFeatureFlag } from '@/lib/feature-flags';
import OnboardingWizard from '@/components/onboarding/onboarding-wizard';
import { shouldShowOnboarding } from '@/lib/onboarding';
import MobileNav from '@/components/mobile/mobile-nav';
import MobileQuickActions from '@/components/mobile/mobile-quick-actions';
import { useIsMobile } from '@/lib/hooks/use-mobile-detect';
import { FeatureGate } from '@/components/shared/feature-gate';
import { getFavorites, type Favorite } from '@/lib/favorites';
import {
  getSidebarPreferences, saveSidebarPreferences, applySpaceOrder, reorderSpaces,
  type SidebarPreferences, DEFAULT_SIDEBAR_PREFS,
} from '@/lib/sidebar-preferences';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

// ============================================
// NAV ITEMS
// ============================================
const NAV = [
  { key: 'nav.dashboard', icon: LayoutDashboard, href: '/app' },
  { key: 'nav.tasks', icon: CheckSquare, href: '/app/tasks' },
  { key: 'nav.planner', icon: CalendarDays, href: '/app/planner' },
  { key: 'nav.docs', icon: FileText, href: '/app/docs' },
  { key: 'nav.chat', icon: MessageSquare, href: '/app/chat' },
  { key: 'nav.automations', icon: Zap, href: '/app/automations' },
  { key: 'nav.analytics', icon: BarChart3, href: '/app/analytics' },
  { key: 'nav.orgChart', icon: Users, href: '/app/org-chart' },
  { key: 'nav.ai', icon: Bot, href: '/app/ai' },
];

const MORE_NAV = [
  { key: 'nav.goals', icon: Target, href: '/app/goals' },
  { key: 'nav.timesheets', icon: Clock, href: '/app/timesheets' },
  { key: 'nav.whiteboards', icon: PenTool, href: '/app/whiteboards' },
  { key: 'nav.forms', icon: FileInput, href: '/app/forms' },
  { key: 'nav.templates', icon: LayoutTemplate, href: '/app/templates' },
  { key: 'nav.integrations', icon: Plug, href: '/app/integrations' },
];

// ============================================
// TEAM SELECTOR DROPDOWN
// ============================================
// ============================================
// LANGUAGE TOGGLE
// ============================================
function LanguageToggle() {
  const { lang, setLang } = useI18n();
  return (
    <button
      onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
      className="px-2 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all duration-200"
      aria-label="Toggle language"
    >
      {lang === 'es' ? 'EN' : 'ES'}
    </button>
  );
}

function TeamSelector() {
  const { teams, activeTeamId, setActiveTeamId, canSeeAllTeams, me, allMembers } = useAuth();
  const { t } = useI18n();
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
          <span className="text-[var(--text-muted)]">{t('common.noDepartment')}</span>
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
          <span>{t('common.general')}</span>
        ) : activeTeam ? (
          <>
            <span className="text-sm">{activeTeam.icon}</span>
            <span>{activeTeam.name}</span>
          </>
        ) : (
          <span className="text-[var(--text-muted)]">{t('common.selectTeam')}</span>
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
                <span className="text-sm font-medium">{t('common.general')}</span>
                <span className="text-[12px] text-[var(--text-muted)] ml-auto">{t('common.allDepts')}</span>
              </button>
              <div className="h-px bg-[var(--border-subtle)] my-1 mx-2" />
              {teams.filter(t => t.status !== 'archived').map(t => (
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
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [notifPrefsOpen, setNotifPrefsOpen] = useState(false);
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
    <>
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
                  onClick={() => { setNotifPrefsOpen(true); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all duration-200"
                >
                  <Bell className="h-4 w-4" strokeWidth={1.75} /> {t('settings.notifications')}
                </button>
                <button
                  onClick={() => { router.push('/app/admin'); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all duration-200"
                >
                  <Settings className="h-4 w-4" strokeWidth={1.75} /> {t('common.settings')}
                </button>
                <button
                  onClick={() => { signOut(auth); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[var(--error)] hover:bg-[var(--error-bg)] transition-all duration-200"
                >
                  <LogOut className="h-4 w-4" strokeWidth={1.75} /> {t('common.signOut')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Notification Preferences Modal */}
      <AnimatePresence>
        {notifPrefsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setNotifPrefsOpen(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-[var(--bg-base)] shadow-2xl border border-[var(--border-subtle)] p-6"
            >
              <button
                onClick={() => setNotifPrefsOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
              <NotificationSettings />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ============================================
// SEARCH TRIGGER
// ============================================
function SearchTrigger() {
  const { toggle } = useCommandPalette();
  const { t } = useI18n();
  return (
    <button
      onClick={toggle}
      className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-active)] transition-all duration-200 text-sm text-[var(--text-muted)] border border-[var(--border-subtle)]"
    >
      <Search className="h-3.5 w-3.5" strokeWidth={1.75} />
      <span className="text-[13px]">{t('common.search')}</span>
      <kbd className="ml-2 text-[10px] px-1 py-0.5 rounded bg-[var(--bg-base)] font-mono text-[var(--text-muted)]">⌘K</kbd>
    </button>
  );
}

// ============================================
// SHELL
// ============================================
// Sortable wrapper for space rows in sidebar
function SortableSpaceRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 10 : 'auto' as any,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { user, me, loading, isAdmin, isManager, canSeeAllTeams, teams } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
  const isMoreRoute = MORE_NAV.some(n => path.startsWith(n.href));
  const [moreOpen, setMoreOpen] = useState(isMoreRoute);
  const isSpacesRoute = path.startsWith('/app/spaces');
  const [spacesOpen, setSpacesOpen] = useState(isSpacesRoute);
  // Track which individual space trees are expanded in sidebar
  const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(() => {
    // Auto-expand the space that matches the current route
    const match = path.match(/\/app\/spaces\/([^/]+)/);
    return match ? new Set([match[1]]) : new Set();
  });
  const toggleSpaceExpand = (spaceId: string) => {
    setExpandedSpaces(prev => {
      const next = new Set(prev);
      if (next.has(spaceId)) next.delete(spaceId); else next.add(spaceId);
      return next;
    });
  };
  const morePopRef = useRef<HTMLDivElement>(null);
  const [morePopover, setMorePopover] = useState(false);

  // Space features panel
  const [spaceFeaturesId, setSpaceFeaturesId] = useState<string | null>(null);

  // Sidebar preferences (space order + hide)
  const [sidebarPrefs, setSidebarPrefs] = useState<SidebarPreferences>(DEFAULT_SIDEBAR_PREFS);
  const [showHiddenSpaces, setShowHiddenSpaces] = useState(false);
  const sidebarPrefsSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    getSidebarPreferences(user.uid).then(setSidebarPrefs).catch(() => {});
  }, [user?.uid]);

  const persistSidebarPrefs = (next: SidebarPreferences) => {
    setSidebarPrefs(next);
    if (!user?.uid) return;
    if (sidebarPrefsSaveTimer.current) clearTimeout(sidebarPrefsSaveTimer.current);
    sidebarPrefsSaveTimer.current = setTimeout(() => {
      saveSidebarPreferences(user.uid!, next).catch(() => {});
    }, 600);
  };

  const hideSpace = (spaceId: string) => {
    const next = { ...sidebarPrefs, hiddenSpaces: [...sidebarPrefs.hiddenSpaces, spaceId] };
    persistSidebarPrefs(next);
  };

  const unhideSpace = (spaceId: string) => {
    const next = { ...sidebarPrefs, hiddenSpaces: sidebarPrefs.hiddenSpaces.filter(id => id !== spaceId) };
    persistSidebarPrefs(next);
  };

  // DnD sensors
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Favorites
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    getFavorites(user.uid).then((favs) => { if (!cancelled) setFavorites(favs); }).catch(() => {});
    return () => { cancelled = true; };
  }, [user?.uid, path]); // re-fetch when navigating so list stays fresh

  useEffect(() => { if (!loading && !user) router.push('/login'); }, [loading, user, router]);

  // --- Global Shortcuts ---
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  const shortcutsEnabled = useFeatureFlag('global-shortcuts');
  useGlobalShortcuts({
    onNavigate: router.push,
    onNewTask: () => { /* TODO: open task create modal */ },
    onShowHelp: () => setShortcutsHelpOpen(true),
    enabled: shortcutsEnabled && !loading,
  });

  // --- Onboarding ---
  const [showOnboarding, setShowOnboarding] = useState(false);
  const onboardingEnabled = useFeatureFlag('onboarding-wizard');
  useEffect(() => {
    if (!user?.uid || !onboardingEnabled) return;
    shouldShowOnboarding(user.uid).then(show => setShowOnboarding(show)).catch(() => {});
  }, [user?.uid, onboardingEnabled]);

  // --- Mobile ---
  const isMobile = useIsMobile();

  // Prefetch all main nav routes for instant navigation
  useEffect(() => {
    [...NAV, ...MORE_NAV].forEach(n => router.prefetch(n.href));
    router.prefetch('/app/admin');
    router.prefetch('/app/spaces');
    router.prefetch('/app/shared');
  }, [router]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)]">
      <div className="text-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)] mx-auto mb-3" />
        <p className="text-sm text-[var(--text-muted)]">{t('common.loadingWorkspace')}</p>
      </div>
    </div>
  );
  if (!user || !me) return null;

  // Spaces: only teams the user belongs to (or all for admin)
  const sidebarTeamsRaw = teams.filter(team => {
    if (team.status === 'archived') return false;
    if (canSeeAllTeams) return true;
    return me.teamId === team.id || me.teamIds?.includes(team.id);
  });
  const sidebarTeams = applySpaceOrder(sidebarTeamsRaw, sidebarPrefs);
  const hiddenTeams = sidebarTeamsRaw.filter(t => sidebarPrefs.hiddenSpaces.includes(t.id));

  const isActive = (h: string) => h === '/app' ? path === '/app' : path.startsWith(h);
  const navTo = (href: string) => { router.push(href); if (window.innerWidth < 768) setOpen(false); };

  return (
    <div className="min-h-screen flex bg-[var(--bg-base)]">
      {/* ===== MOBILE BACKDROP ===== */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
      {/* ===== SIDEBAR ===== */}
      <motion.aside
        animate={{ width: open ? 240 : 60 }}
        transition={{ duration: 0.25, ease: EASE }}
        className={`fixed top-0 left-0 h-full z-40 flex flex-col bg-[var(--sidebar-bg)] max-md:!w-[240px] max-md:transition-transform max-md:duration-300 ${!open ? 'max-md:-translate-x-full' : 'max-md:translate-x-0'}`}
      >
        {/* Logo */}
        <div className="h-14 flex items-center px-3 gap-2.5">
          <Image src="/solis-logo.png" alt="Solis" width={32} height={32} className="w-8 h-8 rounded-lg object-contain shrink-0" />
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
                onClick={() => navTo(n.href)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-200 relative ${
                  active
                    ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-text-active)] font-semibold'
                    : 'text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-active)] hover:bg-[var(--sidebar-hover)]'
                } ${!open ? 'justify-center px-0' : ''}`}
              >
                {active && (
                  <motion.div
                    layoutId={`nav-indicator-main-${n.href}`}
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[var(--accent)]"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <n.icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                <AnimatePresence>
                  {open && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
                      {t(n.key)}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            );
          })}

          {/* Favorites section */}
          <FeatureGate flag="favorites">
            {open ? (
              <>
                <div className="pt-3 pb-1 px-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--sidebar-text)] opacity-60">{t('favorites.title')}</p>
                </div>
                <button
                  onClick={() => setFavoritesOpen(!favoritesOpen)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-200 text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-active)] hover:bg-[var(--sidebar-hover)]"
                >
                  <Star className="h-5 w-5 shrink-0 text-amber-400" strokeWidth={1.75} fill={favorites.length > 0 ? 'currentColor' : 'none'} />
                  <span>{t('favorites.title')}</span>
                  <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform duration-200 ${favoritesOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {favoritesOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: EASE }}
                      className="overflow-hidden"
                    >
                      <div className="pl-3 space-y-0.5">
                        {favorites.length === 0 ? (
                          <p className="px-2.5 py-2 text-[13px] text-[var(--text-muted)]">{t('favorites.empty')}</p>
                        ) : (
                          favorites.map((fav) => {
                            const hrefMap: Record<string, string> = {
                              task: '/app/tasks',
                              goal: '/app/goals',
                              doc: '/app/docs',
                              space: `/app/spaces/${fav.entityId}`,
                              list: '/app/tasks',
                            };
                            const iconMap: Record<string, string> = {
                              task: '✓',
                              goal: '◎',
                              doc: '📄',
                              space: '📁',
                              list: '📋',
                            };
                            return (
                              <button
                                key={`${fav.entityType}_${fav.entityId}`}
                                onClick={() => navTo(hrefMap[fav.entityType] || '/app')}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-all duration-200 text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-active)] hover:bg-[var(--sidebar-hover)]"
                              >
                                <span className="text-xs shrink-0">{iconMap[fav.entityType] || '★'}</span>
                                <span className="truncate">{fav.entityTitle || fav.entityId}</span>
                                <span className="text-[10px] text-[var(--text-muted)] ml-auto uppercase">{fav.entityType}</span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <button
                onClick={() => { setOpen(true); setFavoritesOpen(true); }}
                className="w-full flex items-center justify-center py-2 rounded-lg text-sm transition-all duration-200 text-amber-400 hover:text-amber-300 hover:bg-[var(--sidebar-hover)]"
                title={t('favorites.title')}
              >
                <Star className="h-5 w-5" strokeWidth={1.75} fill={favorites.length > 0 ? 'currentColor' : 'none'} />
              </button>
            )}
          </FeatureGate>

          {/* Shared with me */}
          {open ? (
            <button
              onClick={() => navTo('/app/shared')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-200 relative ${
                path === '/app/shared'
                  ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-text-active)] font-semibold'
                  : 'text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-active)] hover:bg-[var(--sidebar-hover)]'
              }`}
            >
              {path === '/app/shared' && (
                <motion.div layoutId="nav-indicator-shared" className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[var(--accent)]" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
              )}
              <Share2 className="h-5 w-5 shrink-0" strokeWidth={1.75} />
              <span className="truncate">{t('shared.title')}</span>
            </button>
          ) : (
            <button
              onClick={() => navTo('/app/shared')}
              className={`w-full flex items-center justify-center py-2 rounded-lg text-sm transition-all duration-200 ${
                path === '/app/shared'
                  ? 'text-[var(--sidebar-text-active)]'
                  : 'text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-active)] hover:bg-[var(--sidebar-hover)]'
              }`}
              title={t('shared.title')}
            >
              <Share2 className="h-5 w-5" strokeWidth={1.75} />
            </button>
          )}

          {/* Spaces section */}
          {sidebarTeams.length > 0 && (
            open ? (
              <>
                <div className="pt-3 pb-1 px-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--sidebar-text)] opacity-60">{t('nav.spaces')}</p>
                </div>
                <button
                  onClick={() => { navTo('/app/spaces'); }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-200 relative ${
                    path === '/app/spaces'
                      ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-text-active)] font-semibold'
                      : 'text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-active)] hover:bg-[var(--sidebar-hover)]'
                  }`}
                >
                  {path === '/app/spaces' && (
                    <motion.div layoutId="nav-indicator-spaces" className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[var(--accent)]" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                  )}
                  <Layers className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                  <span>{t('spaces.allSpaces')}</span>
                  <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform duration-200 ${spacesOpen ? 'rotate-180' : ''}`} onClick={(e) => { e.stopPropagation(); setSpacesOpen(!spacesOpen); }} />
                </button>
                <AnimatePresence>
                  {spacesOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: EASE }}
                      className="overflow-hidden"
                    >
                      <DndContext
                        sensors={dndSensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event: DragEndEvent) => {
                          const { active, over } = event;
                          if (!over || active.id === over.id) return;
                          const ids = sidebarTeams.map(s => s.id);
                          const oldIndex = ids.indexOf(active.id as string);
                          const newIndex = ids.indexOf(over.id as string);
                          if (oldIndex === -1 || newIndex === -1) return;
                          const newOrder = reorderSpaces(sidebarPrefs.spaceOrder, sidebarTeamsRaw.map(s => s.id), oldIndex, newIndex);
                          persistSidebarPrefs({ ...sidebarPrefs, spaceOrder: newOrder });
                        }}
                      >
                        <SortableContext items={sidebarTeams.map(s => s.id)} strategy={verticalListSortingStrategy}>
                          <div className="pl-3 space-y-0.5">
                            {sidebarTeams.map(st => {
                              const spaceHref = `/app/spaces/${st.id}`;
                              const spaceActive = path.startsWith(spaceHref);
                              const spaceExpanded = expandedSpaces.has(st.id);
                              return (
                                <SortableSpaceRow key={st.id} id={st.id}>
                                  <div className="flex items-center group">
                                    <div className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing p-0.5 text-[var(--text-muted)]">
                                      <GripVertical className="h-3 w-3" />
                                    </div>
                                    <button
                                      onClick={() => { navTo(spaceHref); if (!spaceExpanded) toggleSpaceExpand(st.id); }}
                                      className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-all duration-200 relative ${
                                        spaceActive
                                          ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-text-active)] font-semibold'
                                          : 'text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-active)] hover:bg-[var(--sidebar-hover)]'
                                      }`}
                                    >
                                      {spaceActive && (
                                        <motion.div layoutId={`nav-indicator-space-${st.id}`} className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-3 rounded-r-full" style={{ backgroundColor: st.color || 'var(--accent)' }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                                      )}
                                      <span className="text-sm shrink-0">{st.icon || '📁'}</span>
                                      <span className="truncate">{st.name}</span>
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); hideSpace(st.id); }}
                                      className="p-0.5 rounded text-[var(--text-muted)] hover:text-amber-400 hover:bg-[var(--sidebar-hover)] transition opacity-0 group-hover:opacity-100"
                                      title={t('spaces.hide') || 'Hide'}
                                    >
                                      <EyeOff className="h-3 w-3" />
                                    </button>
                                    {isManager && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setSpaceFeaturesId(spaceFeaturesId === st.id ? null : st.id); }}
                                        className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--sidebar-hover)] transition opacity-0 group-hover:opacity-100"
                                        title={t('common.settings')}
                                      >
                                        <Settings className="h-3 w-3" />
                                      </button>
                                    )}
                                    <button
                                      onClick={(e) => { e.stopPropagation(); toggleSpaceExpand(st.id); }}
                                      className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--sidebar-hover)] transition mr-1"
                                    >
                                      <ChevronDown className={`h-3 w-3 transition-transform duration-150 ${spaceExpanded ? 'rotate-180' : ''}`} />
                                    </button>
                                  </div>
                                  <AnimatePresence>
                                    {spaceExpanded && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.15, ease: EASE }}
                                        className="overflow-hidden"
                                      >
                                        <div className="pl-3">
                                          <SpaceSidebarTree
                                            spaceId={st.id}
                                            spaceName={st.name}
                                            spaceColor={st.color}
                                            spaceIcon={st.icon}
                                            userId={user?.uid || ''}
                                            canManage={isManager}
                                          />
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </SortableSpaceRow>
                              );
                            })}
                          </div>
                        </SortableContext>
                      </DndContext>

                      {/* Hidden spaces reveal */}
                      {hiddenTeams.length > 0 && (
                        <div className="pl-3 mt-1">
                          <button
                            onClick={() => setShowHiddenSpaces(!showHiddenSpaces)}
                            className="w-full flex items-center gap-2 px-2.5 py-1 rounded-lg text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--sidebar-hover)] transition"
                          >
                            <EyeOff className="h-3 w-3" />
                            {hiddenTeams.length} {t('spaces.hidden') || 'hidden'}
                            <ChevronDown className={`h-3 w-3 ml-auto transition-transform ${showHiddenSpaces ? 'rotate-180' : ''}`} />
                          </button>
                          <AnimatePresence>
                            {showHiddenSpaces && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                {hiddenTeams.map(ht => (
                                  <div key={ht.id} className="flex items-center gap-2 px-2.5 py-1 group">
                                    <span className="text-sm shrink-0 opacity-50">{ht.icon || '📁'}</span>
                                    <span className="text-[12px] text-[var(--text-muted)] truncate flex-1">{ht.name}</span>
                                    <button
                                      onClick={() => unhideSpace(ht.id)}
                                      className="p-0.5 rounded text-[var(--text-muted)] hover:text-emerald-400 hover:bg-[var(--sidebar-hover)] transition opacity-0 group-hover:opacity-100"
                                      title={t('spaces.unhide') || 'Show'}
                                    >
                                      <Eye className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <button
                onClick={() => navTo('/app/spaces')}
                className={`w-full flex items-center justify-center py-2 rounded-lg text-sm transition-all duration-200 ${
                  isSpacesRoute
                    ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-text-active)]'
                    : 'text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-active)] hover:bg-[var(--sidebar-hover)]'
                }`}
                title={t('nav.spaces')}
              >
                <Layers className="h-5 w-5" strokeWidth={1.75} />
              </button>
            )
          )}

          {/* More section */}
          {open ? (
            <>
              <button
                onClick={() => setMoreOpen(!moreOpen)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-200 ${
                  isMoreRoute && !moreOpen
                    ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-text-active)] font-semibold'
                    : 'text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-active)] hover:bg-[var(--sidebar-hover)]'
                }`}
              >
                <MoreHorizontal className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                <span>{t('nav.more')}</span>
                <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform duration-200 ${moreOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {moreOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: EASE }}
                    className="overflow-hidden"
                  >
                    <div className="pl-3 space-y-0.5">
                      {MORE_NAV.map(n => {
                        const active = isActive(n.href);
                        return (
                          <button
                            key={n.href}
                            onClick={() => navTo(n.href)}
                            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-200 relative ${
                              active
                                ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-text-active)] font-semibold'
                                : 'text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-active)] hover:bg-[var(--sidebar-hover)]'
                            }`}
                          >
                            {active && (
                              <motion.div
                                layoutId={`nav-indicator-more-${n.href}`}
                                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[var(--accent)]"
                                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                              />
                            )}
                            <n.icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                            <span>{t(n.key)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <div ref={morePopRef} className="relative">
              <button
                onClick={() => setMorePopover(!morePopover)}
                className={`w-full flex items-center justify-center py-2 rounded-lg text-sm transition-all duration-200 ${
                  isMoreRoute
                    ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-text-active)]'
                    : 'text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-active)] hover:bg-[var(--sidebar-hover)]'
                }`}
              >
                <MoreHorizontal className="h-5 w-5" strokeWidth={1.75} />
              </button>
              <AnimatePresence>
                {morePopover && (
                  <motion.div
                    initial={{ opacity: 0, x: -4, scale: 0.97 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -4, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-full top-0 ml-2 w-44 py-1.5 rounded-xl bg-[var(--bg-elevated)] shadow-dropdown z-50"
                  >
                    {MORE_NAV.map(n => {
                      const active = isActive(n.href);
                      return (
                        <button
                          key={n.href}
                          onClick={() => { navTo(n.href); setMorePopover(false); }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-all duration-200 ${
                            active ? 'text-[var(--accent)] font-semibold bg-[var(--accent-subtle)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                          }`}
                        >
                          <n.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                          <span>{t(n.key)}</span>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Admin section */}
          {isAdmin && (
            <>
              <AnimatePresence>
                {open && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-4 pb-1 px-2.5">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.15em] text-[var(--sidebar-text)]">{t('nav.admin')}</p>
                  </motion.div>
                )}
              </AnimatePresence>
              {!open && <div className="pt-2 mt-2"><div className="h-px bg-[var(--sidebar-divider)] mx-2" /></div>}
              <button
                onClick={() => navTo('/app/admin')}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-200 relative ${
                  path.startsWith('/app/admin')
                    ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-text-active)] font-semibold'
                    : 'text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-active)] hover:bg-[var(--sidebar-hover)]'
                } ${!open ? 'justify-center px-0' : ''}`}
              >
                {path.startsWith('/app/admin') && (
                  <motion.div layoutId="nav-indicator-admin" className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[var(--accent)]" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                )}
                <Shield className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                <AnimatePresence>{open && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{t('admin.console')}</motion.span>}</AnimatePresence>
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
      <motion.div animate={{ marginLeft: open ? 240 : 60 }} transition={{ duration: 0.25, ease: EASE }} className="flex-1 max-md:!ml-0">
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
            <SearchTrigger />
            {canSeeAllTeams && (
              <span className="hidden sm:inline text-[12px] px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)] font-medium tracking-wider text-[var(--text-muted)] uppercase">
                {path === '/app' ? 'DASHBOARD' : path.split('/').pop()?.toUpperCase().replace(/-/g, ' ')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <LanguageToggle />
            <ThemeToggle />
            <NotificationBell />
            <UserMenu />
          </div>
        </header>
        {/* Context Breadcrumb */}
        {path.startsWith('/app/spaces/') && (() => {
          const segments = path.split('/').filter(Boolean); // ['app','spaces','spaceId',...]
          const spaceId = segments[2];
          const spaceName = teams.find((tm: any) => tm.id === spaceId)?.name || spaceId;
          const hasFolderSeg = segments[3] === 'folder';
          const folderId = hasFolderSeg ? segments[4] : null;
          const hasListSeg = segments[3] === 'list';
          const listId = hasListSeg ? segments[4] : null;
          return (
            <div className="flex items-center gap-1.5 px-4 py-1.5 text-[12px] text-[var(--text-muted)] border-b border-[var(--border-subtle)]/50 bg-[var(--bg-base)]">
              <button onClick={() => router.push('/app/spaces')} className="hover:text-[var(--text-secondary)] transition">Spaces</button>
              <ChevronRight className="h-3 w-3" />
              <button onClick={() => router.push(`/app/spaces/${spaceId}`)} className="hover:text-[var(--accent)] transition font-medium">{spaceName}</button>
              {folderId && <><ChevronRight className="h-3 w-3" /><span className="font-medium">{folderId.slice(0, 8)}</span></>}
              {listId && <><ChevronRight className="h-3 w-3" /><span className="font-medium">{listId.slice(0, 8)}</span></>}
            </div>
          );
        })()}
        <main className={`min-h-[calc(100vh-56px)] ${isMobile ? 'pb-16' : ''}`}>
          <AnimatePresence mode="popLayout">
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

      {/* Space Features Panel (slide-over) */}
      <AnimatePresence>
        {spaceFeaturesId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSpaceFeaturesId(null)}
              className="fixed inset-0 bg-black/40 z-50"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.25, ease: EASE }}
              className="fixed right-0 top-0 h-full w-[480px] max-w-[90vw] bg-[var(--bg-base)] shadow-2xl z-50 overflow-y-auto border-l border-[var(--border)]"
            >
              <SpaceFeaturesPanel
                spaceId={spaceFeaturesId}
                onClose={() => setSpaceFeaturesId(null)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Global Shortcuts Help */}
      <ShortcutsHelpModal open={shortcutsHelpOpen} onOpenChange={setShortcutsHelpOpen} />

      {/* Onboarding Wizard */}
      {user?.uid && showOnboarding && (
        <OnboardingWizard userId={user.uid} open={showOnboarding} onClose={() => setShowOnboarding(false)} />
      )}

      {/* Mobile Bottom Nav + Quick Actions */}
      {isMobile && (
        <>
          <MobileQuickActions />
          <MobileNav />
        </>
      )}
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <QueryProvider>
        <FeatureFlagProvider>
          <ToastProvider>
            <NotificationProvider>
              <CommandPaletteProvider>
                <Shell>{children}</Shell>
                <FloatingAIChat />
                <PwaInstallPrompt />
                <FirebaseToastBridge />
              </CommandPaletteProvider>
            </NotificationProvider>
          </ToastProvider>
        </FeatureFlagProvider>
      </QueryProvider>
    </AuthProvider>
  );
}
