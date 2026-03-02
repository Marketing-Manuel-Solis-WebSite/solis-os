'use client';
import { useState, Suspense } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { friendlyError, ACCESS_ERRORS } from '@/lib/auth-errors';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Zap, AlertTriangle, ShieldX, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

function LoginForm() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const accessError = searchParams.get('error');

  const go = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email, pw);
      router.push('/app');
    } catch (er: any) { setErr(er.message || 'Error'); }
    setBusy(false);
  };

  const google = async () => {
    setBusy(true); setErr('');
    try { await signInWithPopup(auth, new GoogleAuthProvider()); router.push('/app'); }
    catch (er: any) { setErr(er.message || 'Error'); }
    setBusy(false);
  };

  const parsedErr = err ? friendlyError(err) : null;

  return (
    <div className="min-h-screen flex relative">
      {/* ===== LEFT — Logo con neon en el borde de la imagen ===== */}
      <div className="hidden lg:flex w-[52%] items-center justify-center relative overflow-hidden z-10">
        {/* Fondo oscuro profundo */}
        <div className="absolute inset-0 bg-[#060610]" />

        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />

        {/* Logo — limpio, sin neon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="relative z-10"
        >
          <img
            src="/solis-logo.png"
            alt="Solis"
            className="w-[440px] h-[440px] object-contain"
          />
        </motion.div>

        {/* ===== 3D STEP — escalon pronunciado ===== */}
        {/* Sombra amplia difusa — profundidad */}
        <div className="absolute top-0 right-0 bottom-0 w-[60px] z-20 pointer-events-none" style={{
          background: 'linear-gradient(to right, transparent, rgba(0,0,0,0.7))',
        }} />
        {/* Sombra media — transicion */}
        <div className="absolute top-0 right-0 bottom-0 w-[25px] z-20 pointer-events-none" style={{
          background: 'linear-gradient(to right, transparent, rgba(0,0,0,0.5))',
        }} />
        {/* Borde negro solido — la "pared" del escalon */}
        <div className="absolute top-0 right-0 bottom-0 w-[6px] z-20 pointer-events-none bg-black" />
      </div>

      {/* ===== RIGHT — Login form (un escalon mas arriba) ===== */}
      <div className="flex-1 flex items-center justify-center px-6 relative overflow-hidden bg-[var(--bg-base)]">
        {/* Sombra interna fuerte — efecto de estar un nivel mas arriba */}
        <div className="hidden lg:block absolute top-0 left-0 bottom-0 w-[160px] pointer-events-none z-0" style={{
          background: 'linear-gradient(to right, rgba(0,0,0,0.22), transparent)',
        }} />
        <div className="hidden lg:block absolute top-0 left-0 right-0 h-[120px] pointer-events-none z-0" style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.08), transparent)',
        }} />
        {/* Esquina superior izquierda — refuerzo de profundidad */}
        <div className="hidden lg:block absolute top-0 left-0 w-[100px] h-[100px] pointer-events-none z-0" style={{
          background: 'radial-gradient(ellipse at top left, rgba(0,0,0,0.12), transparent 70%)',
        }} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: EASE }}
          className="w-full max-w-[420px] relative z-10"
        >
          {/* Glassmorphic 3D card */}
          <div
            className="relative rounded-2xl overflow-hidden"
            style={{
              transform: 'perspective(1000px) rotateX(1.5deg)',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Background glass */}
            <div className="absolute inset-0 rounded-2xl" style={{
              background: 'linear-gradient(160deg, var(--bg-elevated) 0%, var(--bg-secondary) 100%)',
            }} />

            {/* Glass shine — top light reflection */}
            <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{
              background: 'linear-gradient(160deg, rgba(255,255,255,0.07) 0%, transparent 40%, rgba(0,0,0,0.02) 100%)',
            }} />

            {/* Inner border glow */}
            <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.04)',
              border: '1px solid rgba(255,255,255,0.05)',
            }} />

            {/* Top accent line */}
            <div className="absolute top-0 left-[15%] right-[15%] h-[2px] bg-gradient-to-r from-transparent via-[#8C28FF] to-transparent opacity-40" />

            {/* External 3D shadow */}
            <div className="absolute inset-0 rounded-2xl pointer-events-none -z-10" style={{
              boxShadow: '0 30px 60px -15px rgba(0,0,0,0.2), 0 0 1px rgba(255,255,255,0.05)',
            }} />

            {/* ===== Card Content ===== */}
            <div className="relative z-10 p-9">
              {/* Mobile logo */}
              <div className="flex items-center gap-2.5 justify-center mb-8 lg:hidden">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8C28FF] to-[#5B8DEF] flex items-center justify-center shadow-glow">
                  <Zap className="h-5 w-5 text-white" strokeWidth={2} />
                </div>
                <span className="text-lg font-bold text-[var(--text-primary)] tracking-wide">SOLIS CENTER</span>
              </div>

              {/* Header */}
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">Iniciar Sesion</h2>
                <p className="text-sm text-[var(--text-tertiary)] mt-1.5">Accede a tu espacio de trabajo</p>
              </div>

              {/* Access error — friendly */}
              <AnimatePresence>
                {accessError && ACCESS_ERRORS[accessError] && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="mb-5 overflow-hidden"
                  >
                    <div className="p-4 rounded-xl flex items-start gap-3" style={{
                      background: 'linear-gradient(135deg, var(--warning-bg), transparent)',
                      border: '1px solid var(--warning-border)',
                    }}>
                      <div className="shrink-0 w-9 h-9 rounded-xl bg-[var(--warning)]/15 flex items-center justify-center">
                        <AlertTriangle className="h-[18px] w-[18px] text-[var(--warning)]" />
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className="text-[13px] font-semibold text-[var(--text-primary)]">{ACCESS_ERRORS[accessError].title}</p>
                        <p className="text-xs text-[var(--text-tertiary)] mt-1 leading-relaxed">{ACCESS_ERRORS[accessError].msg}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Auth error — friendly, human-readable */}
              <AnimatePresence>
                {parsedErr && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="mb-5 overflow-hidden"
                  >
                    <div className="p-4 rounded-xl flex items-start gap-3" style={{
                      background: 'linear-gradient(135deg, var(--error-bg), transparent)',
                      border: '1px solid var(--error-border)',
                    }}>
                      <div className="shrink-0 w-9 h-9 rounded-xl bg-[var(--error)]/15 flex items-center justify-center">
                        <ShieldX className="h-[18px] w-[18px] text-[var(--error)]" />
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className="text-[13px] font-semibold text-[var(--text-primary)]">{parsedErr.title}</p>
                        <p className="text-xs text-[var(--text-tertiary)] mt-1 leading-relaxed">{parsedErr.msg}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Form */}
              <form onSubmit={go} className="space-y-4">
                {/* Email */}
                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--accent)] transition-colors duration-200 z-10">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Email"
                    required
                    className="w-full h-12 pl-10 pr-4 rounded-xl bg-[var(--bg-input)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all duration-300 border-[1.5px] border-[var(--border)] hover:border-[var(--border-strong)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15 focus:shadow-[0_0_20px_rgba(140,40,255,0.1)]"
                  />
                </div>

                {/* Password */}
                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--accent)] transition-colors duration-200 z-10">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={pw}
                    onChange={e => setPw(e.target.value)}
                    placeholder="Password"
                    required
                    minLength={6}
                    className="w-full h-12 pl-10 pr-11 rounded-xl bg-[var(--bg-input)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all duration-300 border-[1.5px] border-[var(--border)] hover:border-[var(--border-strong)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15 focus:shadow-[0_0_20px_rgba(140,40,255,0.1)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors duration-200 z-10"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Forgot password */}
                <div className="flex justify-end -mt-1">
                  <Link
                    href="/login/forgot-password"
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors duration-200"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>

                {/* Submit */}
                <motion.button
                  type="submit"
                  disabled={busy}
                  whileHover={{ scale: 1.015, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-[#8C28FF] to-[#7B68EE] text-white text-sm font-semibold transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{
                    boxShadow: '0 4px 20px rgba(140,40,255,0.4), 0 0 40px rgba(140,40,255,0.12)',
                  }}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Iniciar Sesion'}
                </motion.button>
              </form>

              {/* Divider */}
              <div className="relative my-7">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full h-px bg-gradient-to-r from-transparent via-[var(--border-strong)] to-transparent" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-[var(--bg-elevated)] px-4 text-xs text-[var(--text-muted)] uppercase tracking-wider">o continua con</span>
                </div>
              </div>

              {/* Google */}
              <motion.button
                onClick={google}
                disabled={busy}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="w-full h-11 rounded-xl bg-[var(--bg-input)] text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-active)] transition-all duration-300 flex items-center justify-center gap-2.5 disabled:opacity-50 border-[1.5px] border-[var(--border)] hover:border-[var(--border-strong)]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google
              </motion.button>
            </div>
          </div>

          {/* Powered by Nora */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center text-[13px] mt-6"
            style={{ color: 'var(--text-muted)', opacity: 0.4 }}
          >
            Powered by <span className="font-medium" style={{ color: 'var(--accent)', opacity: 0.6 }}>Nora</span>
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0B0B1A]">
        <Loader2 className="h-6 w-6 animate-spin text-[#8C28FF]" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
