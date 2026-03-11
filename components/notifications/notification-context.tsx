'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { onNotificationsSnapshot, type AppNotification } from '@/lib/notifications';

interface NotificationContextValue {
  notifications: AppNotification[];
}

const NotificationContext = createContext<NotificationContextValue>({ notifications: [] });

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = onNotificationsSnapshot(user.uid, setNotifications);
    return () => unsub();
  }, [user?.uid]);

  return (
    <NotificationContext.Provider value={{ notifications }}>
      {children}
    </NotificationContext.Provider>
  );
}
