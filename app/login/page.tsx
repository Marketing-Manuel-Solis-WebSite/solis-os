'use client';
import { useState, Suspense } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter, useSearchParams } from 'next/navigation';

const ACCESS_ERRORS: Record<string, string> = {
  no_account: 'No tienes una cuenta. Contacta a tu administrador para obtener acceso.',
  deactivated: 'Tu cuenta ha sido desactivada. Contacta a tu administrador.',
};

function LoginForm() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const accessError = searchParams.get('error');

  const go = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email, pw);
      router.push('/app');
    } catch (er: any) { setErr(er.message?.replace('Firebase: ', '') || 'Error'); }
    setBusy(false);
  };

  const google = async () => {
    setBusy(true); setErr('');
    try { await signInWithPopup(auth, new GoogleAuthProvider()); router.push('/app'); }
    catch (er: any) { setErr(er.message?.replace('Firebase: ', '') || 'Error'); }
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left — Logo */}
      <div className="hidden lg:flex w-1/2 items-center justify-center bg-[var(--bg-elevated)] border-r border-[var(--border)] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#D4A843]/5 via-transparent to-[#D4A843]/5" />
        <img
          src="/solis-logo.png"
          alt="Solis"
          className="relative z-10 max-w-[60%] max-h-[60%] object-contain drop-shadow-lg"
        />
      </div>

      {/* Right — Form */}
      <div className="flex-1 flex items-center justify-center px-6 bg-[var(--bg-base)]">
        <div className="w-full max-w-md">
          <div className="glass glow rounded-2xl p-8">
            <h2 className="text-xl font-bold text-[var(--text-primary)] text-center">Iniciar Sesión</h2>
            <p className="text-sm text-[var(--text-muted)] text-center mb-6">Accede a tu espacio de trabajo</p>

            {accessError && ACCESS_ERRORS[accessError] && (
              <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
                {ACCESS_ERRORS[accessError]}
              </div>
            )}

            {err && <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{err}</div>}

            <form onSubmit={go} className="space-y-4">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required className="input-dark" />
              <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Contraseña" required minLength={6} className="input-dark" />
              <button type="submit" disabled={busy} className="w-full h-[42px] rounded-xl btn-gold text-sm disabled:opacity-50">
                {busy ? '...' : 'Iniciar Sesión'}
              </button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[var(--border)]" /></div>
              <div className="relative flex justify-center"><span className="bg-[var(--bg-card)] px-3 text-xs text-[var(--text-muted)]">o</span></div>
            </div>

            <button onClick={google} disabled={busy}
              className="w-full h-[42px] rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:border-[var(--text-muted)] transition flex items-center justify-center gap-3 disabled:opacity-50">
              <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Google
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)]"><div className="text-[var(--text-muted)]">Cargando...</div></div>}>
      <LoginForm />
    </Suspense>
  );
}
