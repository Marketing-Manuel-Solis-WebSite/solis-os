'use client';

import { useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, CheckSquare, FileText, MessageSquare,
  Zap, BarChart3, Users, Settings, ChevronDown, ChevronRight,
  Plus, Search, Building2, FolderOpen, List, Briefcase,
  Bot, Shield, PanelLeftClose, PanelLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useWorkspaceStore } from '@/lib/hooks/use-workspace-store';
import { useAuthStore } from '@/lib/hooks/use-auth-store';

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
  badge?: number;
  adminOnly?: boolean;
}

export function Sidebar() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const orgId = params.orgId as string;
  const { sidebarOpen, toggleSidebar } = useWorkspaceStore();
  const { isAdmin } = useAuthStore();
  const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(new Set(['default']));

  const mainNav: NavItem[] = [
    { label: 'Dashboard', icon: LayoutDashboard, href: `/${orgId}/dashboard` },
    { label: 'Tasks', icon: CheckSquare, href: `/${orgId}/tasks` },
    { label: 'Docs', icon: FileText, href: `/${orgId}/docs` },
    { label: 'Chat', icon: MessageSquare, href: `/${orgId}/chat`, badge: 3 },
    { label: 'Automations', icon: Zap, href: `/${orgId}/automations` },
    { label: 'Analytics', icon: BarChart3, href: `/${orgId}/analytics` },
    { label: 'Org Chart', icon: Users, href: `/${orgId}/org-chart` },
    { label: 'Solis AI', icon: Bot, href: `/${orgId}/ai` },
  ];

  const adminNav: NavItem[] = [
    { label: 'Admin Console', icon: Shield, href: `/${orgId}/admin`, adminOnly: true },
  ];

  const isActive = (href: string) => pathname.startsWith(href);

  const toggleSpace = (spaceId: string) => {
    setExpandedSpaces((prev) => {
      const next = new Set(prev);
      if (next.has(spaceId)) next.delete(spaceId);
      else next.add(spaceId);
      return next;
    });
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full bg-card border-r border-border z-40 flex flex-col transition-all duration-300',
        sidebarOpen ? 'w-64' : 'w-16'
      )}
    >
      {/* Header */}
      <div className="h-14 flex items-center px-4 border-b border-border gap-3">
        <div className="w-8 h-8 rounded-lg bg-solis-navy flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-solis-gold">S</span>
        </div>
        {sidebarOpen && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">Solis Center</p>
            <p className="text-[10px] text-muted-foreground truncate">Law Office</p>
          </div>
        )}
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="h-8 w-8 flex-shrink-0">
          {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Search */}
      {sidebarOpen && (
        <div className="px-3 py-2">
          <button className="w-full flex items-center gap-2 h-9 px-3 rounded-md bg-muted/50 text-muted-foreground text-sm hover:bg-muted transition-colors">
            <Search className="h-4 w-4" />
            <span>Search...</span>
            <kbd className="ml-auto text-[10px] bg-background px-1.5 py-0.5 rounded border">⌘K</kbd>
          </button>
        </div>
      )}

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 py-2">
        <div className="space-y-0.5">
          {mainNav.map((item) => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors relative',
                isActive(item.href)
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                !sidebarOpen && 'justify-center px-0'
              )}
              title={!sidebarOpen ? item.label : undefined}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {sidebarOpen && (
                <>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <span className="px-1.5 py-0.5 text-[10px] bg-primary text-primary-foreground rounded-full">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>

        {/* Workspace Tree */}
        {sidebarOpen && (
          <div className="mt-6">
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Workspaces
              </span>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Plus className="h-3 w-3" />
              </Button>
            </div>

            {/* Example workspace tree */}
            <div className="space-y-0.5">
              <div>
                <button
                  onClick={() => toggleSpace('operations')}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm hover:bg-muted transition-colors"
                >
                  {expandedSpaces.has('operations') ? (
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  )}
                  <Building2 className="h-4 w-4 text-blue-500" />
                  <span className="flex-1 text-left truncate">Operations</span>
                </button>

                {expandedSpaces.has('operations') && (
                  <div className="ml-5 pl-3 border-l border-border space-y-0.5 mt-0.5">
                    <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                      <FolderOpen className="h-3.5 w-3.5" />
                      <span className="truncate">Immigration Cases</span>
                    </button>
                    <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                      <List className="h-3.5 w-3.5" />
                      <span className="truncate">Active Tasks</span>
                    </button>
                    <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                      <List className="h-3.5 w-3.5" />
                      <span className="truncate">Client Follow-ups</span>
                    </button>
                  </div>
                )}
              </div>

              <div>
                <button
                  onClick={() => toggleSpace('sales')}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm hover:bg-muted transition-colors"
                >
                  {expandedSpaces.has('sales') ? (
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  )}
                  <Briefcase className="h-4 w-4 text-green-500" />
                  <span className="flex-1 text-left truncate">Sales & CRM</span>
                </button>

                {expandedSpaces.has('sales') && (
                  <div className="ml-5 pl-3 border-l border-border space-y-0.5 mt-0.5">
                    <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                      <List className="h-3.5 w-3.5" />
                      <span className="truncate">Leads Pipeline</span>
                    </button>
                    <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                      <List className="h-3.5 w-3.5" />
                      <span className="truncate">Active Deals</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Admin Nav */}
        {isAdmin && (
          <div className="mt-6">
            {sidebarOpen && (
              <div className="px-3 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Administration
                </span>
              </div>
            )}
            <div className="space-y-0.5">
              {adminNav.map((item) => (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                    isActive(item.href)
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    !sidebarOpen && 'justify-center px-0'
                  )}
                  title={!sidebarOpen ? item.label : undefined}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  {sidebarOpen && <span>{item.label}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Footer */}
      {sidebarOpen && (
        <div className="p-3 border-t border-border">
          <button
            onClick={() => router.push(`/${orgId}/admin`)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </button>
        </div>
      )}
    </aside>
  );
}
