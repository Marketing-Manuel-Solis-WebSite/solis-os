'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import {
  getInvitationByToken, validateInvitation, acceptInvitation,
  type Invitation, type InviteValidation,
} from '@/lib/invite-system';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { motion } from 'framer-motion';
import {
  Loader2, CheckCircle2, XCircle, Clock, AlertTriangle,
  UserPlus, ArrowRight, Mail, Shield,
} from 'lucide-react';
import Link from 'next/link';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const token = params.token as string;

  const [invite, setInvite] = useState<Invitation | null>(null);
  const [validation, setValidation] = useState<InviteValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  // Listen for auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // Load invitation by token
  useEffect(() => {
    if (!token) return;
    loadInvite();
  }, [token]);

  async function loadInvite() {
    setLoading(true);
    try {
      const inv = await getInvitationByToken(token);
      if (!inv) {
        setValidation({ valid: false, error: 'not_found' });
        setLoading(false);
        return;
      }
      setInvite(inv);
      const result = validateInvitation(inv);
      setValidation(result);
    } catch (err) {
      console.error('[InviteAccept] Error loading invite:', err);
      setValidation({ valid: false, error: 'not_found' });
    }
    setLoading(false);
  }

  async function handleAccept() {
    if (!invite || !user) return;
    setAccepting(true);
    try {
      await acceptInvitation(invite.id, user.uid);
      setAccepted(true);
    } catch (err: any) {
      console.error('[InviteAccept] Error accepting:', err);
    }
    setAccepting(false);
  }

  function handleLoginRedirect() {
    router.push(`/login?invite=${token}`);
  }

  // Loading state
  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  // Not found
  if (!validation || validation.error === 'not_found') {
    return (
      <PageShell>
        <ErrorState
          icon={<XCircle className="h-12 w-12 text-red-400" />}
          title={t('invite.notFound')}
          description={t('invite.notFoundDesc')}
        />
      </PageShell>
    );
  }

  // Expired
  if (validation.error === 'expired') {
    return (
      <PageShell>
        <ErrorState
          icon={<Clock className="h-12 w-12 text-amber-400" />}
          title={t('invite.expired')}
          description={t('invite.expired')}
        />
      </PageShell>
    );
  }

  // Revoked
  if (validation.error === 'revoked') {
    return (
      <PageShell>
        <ErrorState
          icon={<AlertTriangle className="h-12 w-12 text-red-400" />}
          title={t('invite.revoked')}
          description={t('invite.revoked')}
        />
      </PageShell>
    );
  }

  // Already accepted
  if (validation.error === 'already_accepted') {
    return (
      <PageShell>
        <ErrorState
          icon={<CheckCircle2 className="h-12 w-12 text-emerald-400" />}
          title={t('invite.alreadyAccepted')}
          description={t('invite.alreadyAccepted')}
        />
      </PageShell>
    );
  }

  // Accepted just now
  if (accepted) {
    return (
      <PageShell>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="text-center"
        >
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
            {t('invite.accepted')}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            {t('invite.acceptedDesc')}
          </p>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:opacity-90 transition"
          >
            {t('invite.goToApp')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </PageShell>
    );
  }

  // Valid invitation — show invite details
  return (
    <PageShell>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="text-center"
      >
        {/* Icon */}
        <div className="mx-auto mb-5 w-16 h-16 rounded-full bg-[var(--accent-subtle)] border border-[var(--accent)]/20 flex items-center justify-center">
          <UserPlus className="h-8 w-8 text-[var(--accent)]" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
          {t('invite.title')}
        </h1>

        {/* Role + Team */}
        <p className="text-base text-[var(--text-secondary)] mb-1">
          {t('invite.joinAs', {
            role: invite?.role || 'member',
            team: invite?.teamName || 'SOLIS CENTER',
          })}
        </p>

        {/* Inviter */}
        {invite?.invitedByName && (
          <p className="text-sm text-[var(--text-muted)] mb-2">
            {t('invite.invitedBy')}: {invite.invitedByName}
          </p>
        )}

        {/* Optional message */}
        {invite?.message && (
          <div className="mx-auto max-w-sm mt-4 mb-4 p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border)] text-left">
            <div className="flex items-start gap-2">
              <Mail className="h-4 w-4 text-[var(--text-muted)] mt-0.5 shrink-0" />
              <p className="text-sm text-[var(--text-secondary)] italic">
                &ldquo;{invite.message}&rdquo;
              </p>
            </div>
          </div>
        )}

        {/* Email info */}
        <div className="mx-auto max-w-sm mt-4 mb-6 p-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border)]">
          <div className="flex items-center gap-2 justify-center">
            <Shield className="h-4 w-4 text-[var(--text-muted)]" />
            <span className="text-sm text-[var(--text-muted)]">
              {invite?.email}
            </span>
          </div>
        </div>

        {/* Action */}
        {user ? (
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-50"
          >
            {accepting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {accepting ? t('invite.accepting') : t('invite.accept')}
          </button>
        ) : (
          <button
            onClick={handleLoginRedirect}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:opacity-90 transition"
          >
            <ArrowRight className="h-4 w-4" />
            {t('invite.loginFirst')}
          </button>
        )}
      </motion.div>
    </PageShell>
  );
}

// ==========================================
// Shell — centered card layout
// ==========================================
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] p-4">
      {/* Background grid */}
      <div
        className="fixed inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <h2 className="text-lg font-bold tracking-wide text-[var(--text-primary)]">SOLIS CENTER</h2>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-[var(--bg-elevated)] shadow-card border border-[var(--border)] p-8">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

// ==========================================
// Error state component
// ==========================================
function ErrorState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="text-center"
    >
      <div className="mx-auto mb-4">{icon}</div>
      <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">{title}</h1>
      <p className="text-sm text-[var(--text-muted)] mb-6">{description}</p>
      <Link
        href="/login"
        className="inline-flex items-center gap-2 text-sm text-[var(--accent)] hover:underline"
      >
        <ArrowRight className="h-4 w-4" />
        {('Go to login')}
      </Link>
    </motion.div>
  );
}
