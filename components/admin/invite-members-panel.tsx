'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/components/notifications/toast-provider';
import {
  createInvitation, getAllInvitations, revokeInvitation,
  type Invitation, type InviteStatus,
} from '@/lib/invite-system';
import {
  Mail, UserPlus, Copy, Ban, Loader2, Check, Filter,
  Clock, CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type FilterTab = 'all' | InviteStatus;

const STATUS_CONFIG: Record<InviteStatus, { color: string; bg: string; border: string; icon: typeof Check }> = {
  pending: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: Clock },
  accepted: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle2 },
  expired: { color: 'text-[var(--text-muted)]', bg: 'bg-[var(--bg-tertiary)]', border: 'border-[var(--border)]', icon: AlertTriangle },
  revoked: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: XCircle },
};

const ALLOWED_ROLES = ['member', 'guest', 'readonly'] as const;

export default function InviteMembersPanel() {
  const { user, me, teams } = useAuth();
  const { t } = useI18n();
  const toast = useToast();

  // Form state
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('member');
  const [teamId, setTeamId] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Invitations list
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const activeTeams = useMemo(
    () => (teams || []).filter((t: any) => t.status !== 'archived'),
    [teams],
  );

  const selectedTeamName = useMemo(
    () => activeTeams.find((t: any) => t.id === teamId)?.name || '',
    [activeTeams, teamId],
  );

  const filteredInvitations = useMemo(() => {
    if (filter === 'all') return invitations;
    return invitations.filter(inv => {
      // Check runtime expiry for pending invites
      if (inv.status === 'pending' && filter === 'expired') {
        const expires = inv.expiresAt?.seconds
          ? inv.expiresAt.seconds * 1000
          : new Date(inv.expiresAt).getTime();
        return Date.now() > expires;
      }
      if (inv.status === 'pending' && filter === 'pending') {
        const expires = inv.expiresAt?.seconds
          ? inv.expiresAt.seconds * 1000
          : new Date(inv.expiresAt).getTime();
        return Date.now() <= expires;
      }
      return inv.status === filter;
    });
  }, [invitations, filter]);

  useEffect(() => {
    loadInvitations();
  }, []);

  async function loadInvitations() {
    setLoading(true);
    try {
      const all = await getAllInvitations();
      setInvitations(all);
    } catch (err) {
      console.error('[InviteMembersPanel] Failed to load invitations:', err);
    }
    setLoading(false);
  }

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.warning(t('admin.inviteEmailRequired'));
      return;
    }
    if (!user || !me) return;

    setSending(true);
    try {
      const result = await createInvitation({
        email: email.trim(),
        role,
        teamId: teamId || '',
        teamName: selectedTeamName || t('admin.inviteNoTeam'),
        invitedBy: user.uid,
        invitedByName: me.displayName || user.email || '',
        message: message.trim() || undefined,
      });

      const inviteUrl = `${window.location.origin}/invite/${result.token}`;
      toast.success(t('admin.inviteSent'), email.trim());

      // Copy link to clipboard
      try {
        await navigator.clipboard.writeText(inviteUrl);
        toast.info(t('admin.inviteLinkCopied'), inviteUrl);
      } catch { /* clipboard not available */ }

      // Reset form
      setEmail('');
      setRole('member');
      setTeamId('');
      setMessage('');
      await loadInvitations();
    } catch (err: any) {
      toast.error('Error', err.message || 'Failed to send invitation');
    }
    setSending(false);
  }

  async function handleRevoke(inv: Invitation) {
    setRevokingId(inv.id);
    try {
      await revokeInvitation(inv.id);
      toast.success(t('admin.inviteRevoked2'));
      await loadInvitations();
    } catch (err: any) {
      toast.error('Error', err.message || 'Failed to revoke');
    }
    setRevokingId(null);
  }

  function copyInviteLink(inv: Invitation) {
    const url = `${window.location.origin}/invite/${inv.token}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.info(t('admin.inviteLinkCopied'), url);
    }).catch(() => {
      toast.warning('Could not copy', url);
    });
  }

  function formatDate(ts: any): string {
    if (!ts) return '-';
    const d = ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function getEffectiveStatus(inv: Invitation): InviteStatus {
    if (inv.status === 'pending' && inv.expiresAt) {
      const expires = inv.expiresAt?.seconds
        ? inv.expiresAt.seconds * 1000
        : new Date(inv.expiresAt).getTime();
      if (Date.now() > expires) return 'expired';
    }
    return inv.status;
  }

  const FILTERS: { id: FilterTab; label: string }[] = [
    { id: 'all', label: t('admin.inviteAll') },
    { id: 'pending', label: t('admin.invitePending') },
    { id: 'accepted', label: t('admin.inviteAccepted') },
    { id: 'expired', label: t('admin.inviteExpired') },
    { id: 'revoked', label: t('admin.inviteRevoked') },
  ];

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <h2 className="text-xl font-bold text-[var(--text-primary)]">{t('admin.invitations')}</h2>

      {/* ===== INVITE FORM ===== */}
      <div className="rounded-2xl bg-[var(--bg-elevated)] shadow-card border border-[var(--border)] p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="p-2 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent)]/20">
            <UserPlus className="h-4 w-4 text-[var(--accent)]" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('admin.inviteNew')}</h3>
        </div>

        <form onSubmit={handleSendInvite} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">
              {t('admin.inviteEmail')} *
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="user@example.com"
                required
                className="input-dark pl-10 w-full"
              />
            </div>
          </div>

          {/* Role + Team row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">
                {t('admin.inviteRole')}
              </label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="input-dark w-full"
              >
                {ALLOWED_ROLES.map(r => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">
                {t('admin.inviteTeam')}
              </label>
              <select
                value={teamId}
                onChange={e => setTeamId(e.target.value)}
                className="input-dark w-full"
              >
                <option value="">{t('admin.inviteNoTeam')}</option>
                {activeTeams.map((team: any) => (
                  <option key={team.id} value={team.id}>
                    {team.icon ? `${team.icon} ` : ''}{team.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1.5">
              {t('admin.inviteMessage')}
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={2}
              placeholder={t('admin.inviteMessage')}
              className="input-dark w-full resize-none"
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={sending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              {sending ? t('admin.inviteSending') : t('admin.sendInvite')}
            </button>
          </div>
        </form>
      </div>

      {/* ===== INVITATIONS TABLE ===== */}
      <div className="rounded-2xl bg-[var(--bg-elevated)] shadow-card border border-[var(--border)] p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="p-2 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent)]/20">
            <Filter className="h-4 w-4 text-[var(--accent)]" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('admin.pendingInvites')}</h3>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                filter === f.id
                  ? 'bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent)]/20'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)]" />
          </div>
        ) : filteredInvitations.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="h-8 w-8 text-[var(--text-muted)] mx-auto mb-2" />
            <p className="text-sm text-[var(--text-muted)]">{t('admin.noItems')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">{t('admin.inviteEmail')}</th>
                  <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">{t('admin.inviteRole')}</th>
                  <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">{t('admin.inviteTeam')}</th>
                  <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Status</th>
                  <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">{t('admin.inviteSentDate')}</th>
                  <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">{t('admin.inviteExpiresDate')}</th>
                  <th className="text-right py-2 px-3 text-[var(--text-muted)] font-medium">{t('admin.actionsColumnHeader')}</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {filteredInvitations.map(inv => {
                    const effectiveStatus = getEffectiveStatus(inv);
                    const cfg = STATUS_CONFIG[effectiveStatus];
                    const StatusIcon = cfg.icon;
                    return (
                      <motion.tr
                        key={inv.id}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-tertiary)]/50 transition"
                      >
                        <td className="py-3 px-3">
                          <span className="text-[var(--text-primary)] font-medium">{inv.email}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-[var(--text-secondary)] capitalize">{inv.role}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-[var(--text-secondary)]">{inv.teamName || '-'}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.border} border ${cfg.color}`}>
                            <StatusIcon className="h-3 w-3" />
                            {t(`admin.invite${effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1)}` as any)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[var(--text-muted)]">{formatDate(inv.createdAt)}</td>
                        <td className="py-3 px-3 text-[var(--text-muted)]">{formatDate(inv.expiresAt)}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => copyInviteLink(inv)}
                              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition"
                              title={t('admin.copyLink')}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            {effectiveStatus === 'pending' && (
                              <button
                                onClick={() => handleRevoke(inv)}
                                disabled={revokingId === inv.id}
                                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition disabled:opacity-50"
                                title={t('admin.revokeInvite')}
                              >
                                {revokingId === inv.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Ban className="h-3.5 w-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
