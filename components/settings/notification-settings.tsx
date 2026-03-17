'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/components/notifications/toast-provider';
import { getUserPreferences, saveUserPreferences } from '@/lib/db';
import { Bell, Mail, MessageSquare, AtSign, Clock, Zap, BarChart3, Loader2 } from 'lucide-react';
import type { NotificationPreferences } from '@/types';

const DEFAULT_PREFS: NotificationPreferences = {
  email: true,
  emailDigest: 'none',
  inApp: true,
  assignments: true,
  mentions: true,
  dueSoon: true,
  automationOutcomes: true,
  weeklyReport: true,
};

/* ============================================
   TOGGLE SWITCH
   ============================================ */
function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg-elevated)]"
      style={{
        backgroundColor: checked ? 'var(--accent)' : 'var(--bg-tertiary)',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <span
        className="inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{ transform: checked ? 'translateX(22px)' : 'translateX(4px)' }}
      />
    </button>
  );
}

/* ============================================
   NOTIFICATION SETTINGS PANEL
   ============================================ */
export default function NotificationSettings() {
  const { user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();

  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Load preferences on mount
  useEffect(() => {
    mountedRef.current = true;
    if (!user?.uid) return;

    (async () => {
      try {
        const saved = await getUserPreferences(user.uid, 'notifications');
        if (saved && mountedRef.current) {
          setPrefs({ ...DEFAULT_PREFS, ...saved });
        }
      } catch {
        // First time — use defaults
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();

    return () => { mountedRef.current = false; };
  }, [user?.uid]);

  // Debounced auto-save
  const save = useCallback((updated: NotificationPreferences) => {
    if (!user?.uid) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      try {
        await saveUserPreferences(user.uid, 'notifications', updated);
        if (mountedRef.current) {
          toast.success(t('settings.preferencesSaved'));
        }
      } catch {
        if (mountedRef.current) {
          toast.error(t('common.error'));
        }
      }
    }, 500);
  }, [user?.uid, toast, t]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const update = useCallback((key: keyof NotificationPreferences, value: any) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: value };
      save(next);
      return next;
    });
  }, [save]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Bell className="h-5 w-5 text-[var(--accent)]" />
          {t('settings.notifications')}
        </h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">{t('settings.notificationsDesc')}</p>
      </div>

      {/* General Section */}
      <section className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('settings.general')}</h3>
        </div>
        <div className="divide-y divide-[var(--border-subtle)]">
          <SettingRow
            icon={<MessageSquare className="h-4 w-4" />}
            label={t('settings.inAppNotifications')}
            control={<Toggle checked={prefs.inApp} onChange={v => update('inApp', v)} />}
          />
          <SettingRow
            icon={<Mail className="h-4 w-4" />}
            label={t('settings.emailNotifications')}
            control={<Toggle checked={prefs.email} onChange={v => update('email', v)} />}
          />
        </div>
      </section>

      {/* Email Section */}
      <section className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('settings.emailDigest')}</h3>
        </div>
        <div className="px-4 py-3">
          <select
            value={prefs.emailDigest}
            onChange={e => update('emailDigest', e.target.value as NotificationPreferences['emailDigest'])}
            disabled={!prefs.email}
            className="w-full h-9 px-3 rounded-lg text-sm bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="none">{t('settings.digestNone')}</option>
            <option value="daily">{t('settings.digestDaily')}</option>
            <option value="weekly">{t('settings.digestWeekly')}</option>
          </select>
        </div>
      </section>

      {/* Activity Types Section */}
      <section className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('settings.activityTypes')}</h3>
        </div>
        <div className="divide-y divide-[var(--border-subtle)]">
          <SettingRow
            icon={<Bell className="h-4 w-4" />}
            label={t('settings.assignments')}
            control={<Toggle checked={prefs.assignments} onChange={v => update('assignments', v)} />}
          />
          <SettingRow
            icon={<AtSign className="h-4 w-4" />}
            label={t('settings.mentions')}
            control={<Toggle checked={prefs.mentions} onChange={v => update('mentions', v)} />}
          />
          <SettingRow
            icon={<Clock className="h-4 w-4" />}
            label={t('settings.dueSoon')}
            control={<Toggle checked={prefs.dueSoon} onChange={v => update('dueSoon', v)} />}
          />
          <SettingRow
            icon={<Zap className="h-4 w-4" />}
            label={t('settings.automationOutcomes')}
            control={<Toggle checked={prefs.automationOutcomes} onChange={v => update('automationOutcomes', v)} />}
          />
          <SettingRow
            icon={<BarChart3 className="h-4 w-4" />}
            label={t('settings.weeklyReport')}
            control={<Toggle checked={prefs.weeklyReport} onChange={v => update('weeklyReport', v)} />}
          />
        </div>
      </section>
    </div>
  );
}

/* ============================================
   SETTING ROW
   ============================================ */
function SettingRow({ icon, label, control }: { icon: React.ReactNode; label: string; control: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-[var(--text-muted)]">{icon}</span>
        <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      </div>
      {control}
    </div>
  );
}
