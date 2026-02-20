'use client';
import { AuthProvider, useAuth } from '@/lib/auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { LayoutDashboard, CheckSquare, FileText, MessageSquare, Zap, BarChart3, Users, Shield, LogOut, Bell, Menu, X, Bot, Search, Plus, ChevronLeft } from 'lucide-react';

function Shell({ children }: { children: React.ReactNode }) {
  const { user, me, loading, isAdmin, teams, activeTeamId, setActiveTeamId, canSeeAllTeams } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(true);
  const activeTeam = teams.find(t => t.id === activeTeamId);

  useEffect(() => { if (!loading && !user) router.push('/login'); }, [loading, user, router]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center"><div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#D4A843] to-[#9A7B2F] flex items-center justify-center mx-auto mb-4 animate-pulse"><Zap className="h-6 w-6 text-[#06080F]" /></div><p className="text-sm text-gray-600">Loading workspace...</p></div>
    </div>
  );
  if (!user || !me) return null;

  const nav = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/app' },
    { label: 'Tasks', icon: CheckSquare, href: '/app/tasks' },
    { label: 'Docs', icon: FileText, href: '/app/docs' },
    { label: 'Chat', icon: MessageSquare, href: '/app/chat' },
    { label: 'Automations', icon: Zap, href: '/app/automations' },
    { label: 'Analytics', icon: BarChart3, href: '/app/analytics' },
    { label: 'Org Chart', icon: Users, href: '/app/org-chart' },
    { label: 'Solis AI', icon: Bot, href: '/app/ai' },
  ];

  const active = (h: string) => h === '/app' ? path === '/app' : path.startsWith(h);

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full z-40 flex flex-col transition-all duration-300 ${open ? 'w-[240px]' : 'w-[68px]'} bg-[#0C1017] border-r border-[#1F2937]/60`}>
        {/* Logo */}
        <div className="h-16 flex items-center px-4 gap-3 border-b border-[#1F2937]/60">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#D4A843] to-[#9A7B2F] flex items-center justify-center shrink-0 shadow-lg shadow-[#D4A843]/10">
            <Zap className="h-4 w-4 text-[#06080F]" />
          </div>
          {open && <div className="min-w-0"><p className="text-sm font-bold text-white tracking-wide">SOLIS</p><p className="text-[10px] text-[#D4A843] tracking-widest uppercase">center</p></div>}
          <button onClick={()=>setOpen(!open)} className={`p-1.5 text-gray-600 hover:text-gray-400 transition ${open ? 'ml-auto' : 'ml-auto'}`}>
            {open ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {nav.map(n => (
            <button key={n.href} onClick={()=>router.push(n.href)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all duration-200 group ${
                active(n.href)
                  ? 'bg-[#D4A843]/10 text-[#D4A843] font-semibold shadow-sm shadow-[#D4A843]/5'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]'
              } ${!open ? 'justify-center px-0' : ''}`}>
              <n.icon className={`h-[18px] w-[18px] shrink-0 transition ${active(n.href) ? 'drop-shadow-[0_0_6px_rgba(212,168,67,0.4)]' : 'group-hover:text-gray-300'}`} />
              {open && <span>{n.label}</span>}
              {active(n.href) && open && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#D4A843] shadow-[0_0_8px_rgba(212,168,67,0.6)]" />}
            </button>
          ))}

          {isAdmin && (
            <>
              {open && <div className="pt-5 pb-1 px-3"><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-700">Administration</p></div>}
              {!open && <div className="pt-3 border-t border-[#1F2937]/40 mt-3" />}
              <button onClick={()=>router.push('/app/admin')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all ${
                  path.startsWith('/app/admin') ? 'bg-[#D4A843]/10 text-[#D4A843] font-semibold' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]'
                } ${!open ? 'justify-center px-0' : ''}`}>
                <Shield className={`h-[18px] w-[18px] shrink-0 ${path.startsWith('/app/admin') ? 'drop-shadow-[0_0_6px_rgba(212,168,67,0.4)]' : ''}`} />
                {open && <span>Admin Console</span>}
              </button>
            </>
          )}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-[#1F2937]/60">
          <div className={`flex items-center gap-3 ${!open ? 'justify-center' : ''}`}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#D4A843]/20 to-[#D4A843]/5 flex items-center justify-center text-sm font-bold text-[#D4A843] shrink-0 border border-[#D4A843]/10">
              {(me.displayName||'U')[0].toUpperCase()}
            </div>
            {open && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{me.displayName}</p>
                <p className="text-[10px] text-gray-600 truncate">{me.role.toUpperCase()}</p>
              </div>
            )}
            {open && <button onClick={()=>signOut(auth)} className="p-1.5 text-gray-700 hover:text-red-400 transition"><LogOut className="h-4 w-4" /></button>}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className={`flex-1 transition-all duration-300 ${open ? 'ml-[240px]' : 'ml-[68px]'}`}>
        <header className="h-16 glass sticky top-0 z-30 flex items-center justify-between px-6 border-b border-[#1F2937]/40">
          <div className="flex items-center gap-3 flex-1">
            <button onClick={()=>setOpen(!open)} className="p-2 text-gray-600 hover:text-gray-400 transition"><Menu className="h-4 w-4" /></button>
            {/* Team Selector */}
            <div className="flex items-center gap-2">
              <select
                value={activeTeamId}
                onChange={e => setActiveTeamId(e.target.value)}
                className="h-9 px-3 rounded-xl text-sm font-semibold border cursor-pointer transition-all"
                style={{
                  backgroundColor: activeTeam ? `${activeTeam.color}15` : '#111827',
                  borderColor: activeTeam ? `${activeTeam.color}30` : '#1F2937',
                  color: activeTeam ? activeTeam.color : '#94A3B8',
                }}
              >
                {canSeeAllTeams && <option value="__all__">🏢 All Teams</option>}
                {(canSeeAllTeams ? teams : teams.filter(t => me?.teamIds?.includes(t.id))).map(t => (
                  <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
                ))}
              </select>
              {activeTeam && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wider" style={{ backgroundColor: `${activeTeam.color}15`, color: activeTeam.color, border: `1px solid ${activeTeam.color}30` }}>
                  {activeTeam.name.toUpperCase()}
                </span>
              )}
              {activeTeamId === '__all__' && canSeeAllTeams && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wider bg-[#D4A843]/10 text-[#D4A843] border border-[#D4A843]/20">ALL TEAMS</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative p-2.5 rounded-xl text-gray-600 hover:text-gray-400 hover:bg-white/[0.02] transition">
              <Bell className="h-[18px] w-[18px]" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#D4A843] shadow-[0_0_6px_rgba(212,168,67,0.6)]" />
            </button>
          </div>
        </header>
        <main className="min-h-[calc(100vh-64px)]">{children}</main>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider><Shell>{children}</Shell></AuthProvider>;
}
