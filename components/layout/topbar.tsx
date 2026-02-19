'use client';

import { Bell, Search, Plus, ChevronDown, LogOut, User, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/primitives';
import { useAuthStore } from '@/lib/hooks/use-auth-store';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { useRouter } from 'next/navigation';
import { getInitials } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';

export function TopBar() {
  const { profile, user, organization } = useAuthStore();
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  const displayName = profile?.displayName || user?.displayName || user?.email || 'User';

  return (
    <header className="h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 sticky top-0 z-30">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium text-foreground">
          {organization?.name || 'Solis Center'}
        </h2>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="hidden md:flex items-center gap-2 text-muted-foreground">
          <Search className="h-4 w-4" />
          <span className="text-sm">Search</span>
          <kbd className="text-[10px] bg-muted px-1.5 py-0.5 rounded border ml-2">⌘K</kbd>
        </Button>

        <Button variant="solis" size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Create</span>
        </Button>

        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={toggleTheme}>
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <Button variant="ghost" size="icon" className="h-9 w-9 relative">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-solis-danger rounded-full" />
        </Button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 hover:bg-muted rounded-md px-2 py-1 transition-colors"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={profile?.photoURL || user?.photoURL || undefined} />
              <AvatarFallback className="text-xs bg-solis-gold text-white">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-card border border-border rounded-lg shadow-lg py-1 animate-scale-in">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-sm font-medium truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                onClick={() => setShowUserMenu(false)}
              >
                <User className="h-4 w-4" />
                Profile
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted transition-colors"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
