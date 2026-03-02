'use client';
import { useState, Suspense } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { friendlyError } from '@/lib/auth-errors';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Mail, ArrowLeft, CheckCircle2, RefreshCw } from 'lucide-react';
import Link from 'next/link';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
    } catch (er: any) {
      // Si es user-not-found, mostramos exito de todos modos (seguridad)
      const code = (er.message || '').match(/\(auth\/([^)]+)\)/)?.[1] || '';
      if (code === 'user-not-found') {
        setSent(true);
      } else {
        const parsed = friendlyError(er.message || 'Error');
        setErr(parsed.msg);
      }
    }
    setBusy(false);
  };

  const handleResend = () => {
    setSent(false);
    setErr('');
  };

  return (
    <div className="min-h-screen flex relative">
      {/* ===== LEFT — Logo ===== */}
      <div className="hidden lg:flex w-[52%] items-center justify-center relative overflow-hidden z-10">
        <div className="absolute inset-0 bg-[#060610]" />
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="relative z-10"
        >
          <img src="/solis-logo.png" alt="Solis" className="w-[440px] h-[440px] object-contain" />
        </motion.div>

        {/* 3D Step */}
        <div className="absolute top-0 right-0 bottom-0 w-[60px] z-20 pointer-events-none" style={{
          background: 'linear-gradient(to right, transparent, rgba(0,0,0,0.7))',
        }} />
        <div className="absolute top-0 right-0 bottom-0 w-[25px] z-20 pointer-events-none" style={{
          background: 'linear-gradient(to right, transparent, rgba(0,0,0,0.5))',
        }} />
        <div className="absolute top-0 right-0 bottom-0 w-[6px] z-20 pointer-events-none bg-black" />
      </div>

      {/* ===== RIGHT — Form ===== */}
      <div className="flex-1 flex items-center justify-center px-6 relative overflow-hidden bg-[var(--bg-base)]">
        <div className="hidden lg:block absolute top-0 left-0 bottom-0 w-[160px] pointer-events-none z-0" style={{
          background: 'linear-gradient(to right, rgba(0,0,0,0.22), transparent)',
        }} />
        <div className="hidden lg:block absolute top-0 left-0 right-0 h-[120px] pointer-events-none z-0" style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.08), transparent)',
        }} />
        <div className="hidden lg:block absolute top-0 left-0 w-[100px] h-[100px] pointer-events-none z-0" style={{
          background: 'radial-gradient(ellipse at top left, rgba(0,0,0,0.12), transparent 70%)',
        }} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: EASE }}
          className="w-full max-w-[420px] relative z-10"
        >
          {/* Glassmorphic Card */}
          <div
            className="relative rounded-2xl overflow-hidden"
            style={{ transform: 'perspective(1000px) rotateX(1.5deg)', transformStyle: 'preserve-3d' }}
          >
            <div className="absolute inset-0 rounded-2xl" style={{
              background: 'linear-gradient(160deg, var(--bg-elevated) 0%, var(--bg-secondary) 100%)',
            }} />
            <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{
              background: 'linear-gradient(160deg, rgba(255,255,255,0.07) 0%, transparent 40%, rgba(0,0,0,0.02) 100%)',
            }} />
            <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.04)',
              border: '1px solid rgba(255,255,255,0.05)',
            }} />
            <div className="absolute top-0 left-[15%] right-[15%] h-[2px] bg-gradient-to-r from-transparent via-[#8C28FF] to-transparent opacity-40" />
            <div className="absolute inset-0 rounded-2xl pointer-events-none -z-10" style={{
              boxShadow: '0 30px 60px -15px rgba(0,0,0,0.2), 0 0 1px rgba(255,255,255,0.05)',
            }} />

            <div className="relative z-10 p-9">
              <AnimatePresence mode="wait">
                {!sent ? (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.3, ease: EASE }}
                  >
                    {/* Header */}
                    <div className="text-center mb-8">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#8C28FF]/20 to-[#7B68EE]/10 flex items-center justify-center mx-auto mb-4">
                        <Mail className="h-6 w-6 text-[#8C28FF]" />
                      </div>
                      <h2 className="text-2xl font-bold text-[var(--text-primary)]">Restablecer Contraseña</h2>
                      <p className="text-sm text-[var(--text-tertiary)] mt-1.5 leading-relaxed">
                        Ingresa tu email y te enviaremos un enlace para crear una nueva contraseña.
                      </p>
                    </div>

                    {/* Error */}
                    <AnimatePresence>
                      {err && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3, ease: EASE }}
                          className="mb-5 overflow-hidden"
                        >
                          <div className="p-3 rounded-xl text-center" style={{
                            background: 'linear-gradient(135deg, var(--error-bg), transparent)',
                            border: '1px solid var(--error-border)',
                          }}>
                            <p className="text-xs text-[var(--error)]">{err}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Form */}
                    <form onSubmit={handleSend} className="space-y-4">
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
                          autoFocus
                          className="w-full h-12 pl-10 pr-4 rounded-xl bg-[var(--bg-input)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all duration-300 border-[1.5px] border-[var(--border)] hover:border-[var(--border-strong)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15 focus:shadow-[0_0_20px_rgba(140,40,255,0.1)]"
                        />
                      </div>

                      <motion.button
                        type="submit"
                        disabled={busy}
                        whileHover={{ scale: 1.015, y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full h-12 rounded-xl bg-gradient-to-r from-[#8C28FF] to-[#7B68EE] text-white text-sm font-semibold transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2"
                        style={{ boxShadow: '0 4px 20px rgba(140,40,255,0.4), 0 0 40px rgba(140,40,255,0.12)' }}
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar enlace'}
                      </motion.button>
                    </form>

                    {/* Back link */}
                    <Link
                      href="/login"
                      className="flex items-center justify-center gap-1.5 mt-6 text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors duration-200"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Volver a iniciar sesion
                    </Link>
                  </motion.div>
                ) : (
                  <motion.div
                    key="sent"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="text-center"
                  >
                    {/* Success icon */}
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                      className="w-16 h-16 rounded-full bg-[#00C48C]/15 flex items-center justify-center mx-auto mb-5"
                    >
                      <CheckCircle2 className="h-8 w-8 text-[#00C48C]" />
                    </motion.div>

                    <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Revisa tu email</h2>
                    <p className="text-sm text-[var(--text-tertiary)] leading-relaxed mb-2">
                      Si existe una cuenta con <span className="font-medium text-[var(--text-secondary)]">{email}</span>, recibiras un enlace para restablecer tu contraseña.
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mb-8">
                      Si no lo ves, revisa tu carpeta de spam.
                    </p>

                    {/* Actions */}
                    <Link href="/login">
                      <motion.button
                        whileHover={{ scale: 1.015, y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full h-12 rounded-xl bg-gradient-to-r from-[#8C28FF] to-[#7B68EE] text-white text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2"
                        style={{ boxShadow: '0 4px 20px rgba(140,40,255,0.4), 0 0 40px rgba(140,40,255,0.12)' }}
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Volver a iniciar sesion
                      </motion.button>
                    </Link>

                    <button
                      onClick={handleResend}
                      className="flex items-center justify-center gap-1.5 mt-5 mx-auto text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors duration-200"
                    >
                      <RefreshCw className="h-3 w-3" />
                      No llego? Reenviar
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Powered by */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center text-[11px] mt-6"
            style={{ color: 'var(--text-muted)', opacity: 0.4 }}
          >
            Powered by <span className="font-medium" style={{ color: 'var(--accent)', opacity: 0.6 }}>Nora</span>
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0B0B1A]">
        <Loader2 className="h-6 w-6 animate-spin text-[#8C28FF]" />
      </div>
    }>
      <ForgotPasswordForm />
    </Suspense>
  );
}
