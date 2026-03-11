'use client';
import { createContext, useContext, useCallback, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { useNotifications } from './notification-context';
import { useI18n } from '@/lib/i18n';

/* ============================================
   TYPES
   ============================================ */
type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  action?: ToastAction;
  duration: number;
  timestamp: number;
  persistent?: boolean;
}

interface ToastInput {
  type?: ToastType;
  title: string;
  message?: string;
  action?: ToastAction;
  duration?: number;
  persistent?: boolean;
}

interface ToastContextValue {
  toast: (input: ToastInput) => string;
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string, action?: ToastAction) => string;
  warning: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
  loading: (title: string, message?: string) => string;
  dismiss: (id: string) => void;
  update: (id: string, input: Partial<ToastInput>) => void;
}

/* ============================================
   CONSTANTS
   ============================================ */
const DURATIONS: Record<ToastType, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 0, // persistent
  loading: 0, // persistent until resolved
};

const MAX_TOASTS = 4;

const TYPE_CONFIG: Record<ToastType, { icon: typeof CheckCircle2; accentColor: string; borderVar: string; bgVar: string }> = {
  success: { icon: CheckCircle2, accentColor: 'var(--success)', borderVar: 'var(--success-border)', bgVar: 'var(--success-bg)' },
  error: { icon: AlertCircle, accentColor: 'var(--error)', borderVar: 'var(--error-border)', bgVar: 'var(--error-bg)' },
  warning: { icon: AlertTriangle, accentColor: 'var(--warning)', borderVar: 'var(--warning-border)', bgVar: 'var(--warning-bg)' },
  info: { icon: Info, accentColor: 'var(--info)', borderVar: 'var(--info-border)', bgVar: 'var(--info-bg)' },
  loading: { icon: Loader2, accentColor: 'var(--accent)', borderVar: 'var(--border)', bgVar: 'var(--accent-subtle)' },
};

/* ============================================
   CONTEXT
   ============================================ */
const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

/* ============================================
   INDIVIDUAL TOAST COMPONENT
   ============================================ */
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const { t } = useI18n();
  const config = TYPE_CONFIG[toast.type];
  const Icon = config.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.96 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      role="alert"
      aria-live="assertive"
      className="pointer-events-auto w-[380px] rounded-xl shadow-lg bg-[var(--bg-elevated)] overflow-hidden"
    >
      <div className="flex items-start gap-3 p-4">
        {/* Accent line */}
        <div className="w-0.5 self-stretch rounded-full shrink-0" style={{ backgroundColor: config.accentColor }} />

        {/* Icon */}
        <div className="shrink-0 mt-0.5">
          <Icon
            className={`h-4 w-4 ${toast.type === 'loading' ? 'animate-spin' : ''}`}
            style={{ color: config.accentColor }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)] leading-tight">
            {toast.title}
          </p>
          {toast.message && (
            <p className="text-sm text-[var(--text-tertiary)] mt-1 leading-relaxed">
              {toast.message}
            </p>
          )}
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className="mt-2 text-sm font-medium px-2.5 py-1 rounded bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all duration-200"
            >
              {toast.action.label}
            </button>
          )}
        </div>

        {/* Close */}
        <button
          onClick={() => onDismiss(toast.id)}
          className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded transition-all duration-200 shrink-0"
          aria-label={t('notif.closeNotification')}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Progress bar for auto-dismiss */}
      {toast.duration > 0 && (
        <motion.div
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: toast.duration / 1000, ease: 'linear' }}
          className="h-[2px] origin-left"
          style={{ backgroundColor: config.accentColor, opacity: 0.4 }}
        />
      )}
    </motion.div>
  );
}

/* ============================================
   PROVIDER
   ============================================ */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idCounter = useRef(0);

  // Auto-dismiss
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setToasts(prev => prev.filter(t => t.duration === 0 || now - t.timestamp < t.duration));
    }, 250);
    return () => clearInterval(timer);
  }, [toasts.length]);

  const addToast = useCallback((input: ToastInput): string => {
    const id = `toast-${++idCounter.current}`;
    const type = input.type || 'info';
    const duration = input.persistent ? 0 : (input.duration ?? DURATIONS[type]);

    setToasts(prev => [
      { id, type, title: input.title, message: input.message, action: input.action, duration, timestamp: Date.now() },
      ...prev,
    ].slice(0, MAX_TOASTS));

    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const update = useCallback((id: string, input: Partial<ToastInput>) => {
    setToasts(prev => prev.map(t => {
      if (t.id !== id) return t;
      return {
        ...t,
        ...(input.type && { type: input.type }),
        ...(input.title && { title: input.title }),
        ...(input.message !== undefined && { message: input.message }),
        ...(input.action !== undefined && { action: input.action }),
        ...(input.duration !== undefined && { duration: input.duration }),
        timestamp: Date.now(),
      };
    }));
  }, []);

  const success = useCallback((title: string, message?: string) => addToast({ type: 'success', title, message }), [addToast]);
  const error = useCallback((title: string, message?: string, action?: ToastAction) => addToast({ type: 'error', title, message, action }), [addToast]);
  const warning = useCallback((title: string, message?: string) => addToast({ type: 'warning', title, message }), [addToast]);
  const info = useCallback((title: string, message?: string) => addToast({ type: 'info', title, message }), [addToast]);
  const loading = useCallback((title: string, message?: string) => addToast({ type: 'loading', title, message, persistent: true }), [addToast]);

  const value: ToastContextValue = { toast: addToast, success, error, warning, info, loading, dismiss, update };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/* ============================================
   TOAST CONTAINER + FIREBASE BRIDGE
   ============================================ */
function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  const { t } = useI18n();
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none" aria-label={t('notif.notifications')}>
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ============================================
   FIREBASE NOTIFICATION BRIDGE
   Listens for new Firebase notifications and
   shows them as toasts automatically
   ============================================ */
export function FirebaseToastBridge() {
  const { notifications } = useNotifications();
  const toastCtx = useContext(ToastContext);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);

  useEffect(() => {
    if (!toastCtx) return;

    if (initialLoadRef.current) {
      notifications.forEach(n => seenIdsRef.current.add(n.id));
      initialLoadRef.current = false;
      return;
    }

    const newOnes = notifications.filter(n => !seenIdsRef.current.has(n.id) && !n.read);
    newOnes.forEach(n => seenIdsRef.current.add(n.id));

    newOnes.forEach(n => {
      toastCtx.toast({
        type: 'info',
        title: n.title,
        message: n.message,
        duration: 5000,
      });
    });
  }, [notifications, toastCtx]);

  return null;
}
