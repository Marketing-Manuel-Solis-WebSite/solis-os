'use client';
import { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, updateProfile } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Zap } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [name, setName] = useState('');
  const [isReg, setIsReg] = useState(false); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const router = useRouter();

  const go = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      if (isReg) { const c = await createUserWithEmailAndPassword(auth, email, pw); if (name) await updateProfile(c.user, { displayName: name }); }
      else await signInWithEmailAndPassword(auth, email, pw);
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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Animated grid background */}
      <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(31,41,55,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(31,41,55,0.3) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      <div className="absolute inset-0 bg-gradient-to-br from-[#D4A843]/5 via-transparent to-blue-900/10" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#D4A843]/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/5 rounded-full blur-[100px]" />

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#D4A843] to-[#9A7B2F] mb-5 shadow-lg shadow-[#D4A843]/20">
            <Zap className="h-9 w-9 text-[#06080F]" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white">SOLIS CENTER</h1>
          <p className="text-sm text-gray-500 mt-2 tracking-widest uppercase">Workspace Platform</p>
        </div>

        {/* Card */}
        <div className="glass glow rounded-2xl p-8">
          <h2 className="text-xl font-bold text-white text-center">{isReg ? 'Create Account' : 'Sign In'}</h2>
          <p className="text-sm text-gray-500 text-center mb-6">{isReg ? 'Join your team' : 'Access your workspace'}</p>

          {err && <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{err}</div>}

          <form onSubmit={go} className="space-y-4">
            {isReg && <input value={name} onChange={e=>setName(e.target.value)} placeholder="Full Name" className="input-dark" />}
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" required className="input-dark" />
            <input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="Password" required minLength={6} className="input-dark" />
            <button type="submit" disabled={busy} className="w-full h-[42px] rounded-xl btn-gold text-sm disabled:opacity-50">
              {busy ? '...' : isReg ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="relative my-6"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-d-border" /></div><div className="relative flex justify-center"><span className="bg-d-card px-3 text-xs text-gray-600">or</span></div></div>

          <button onClick={google} disabled={busy} className="w-full h-[42px] rounded-xl border border-d-border text-sm font-medium text-gray-300 hover:bg-d-hover hover:border-gray-600 transition flex items-center justify-center gap-3 disabled:opacity-50">
            <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Google
          </button>

          <p className="text-center text-sm text-gray-600 mt-5">
            {isReg ? 'Have an account?' : 'No account?'}
            <button onClick={()=>{setIsReg(!isReg);setErr('');}} className="text-[#D4A843] font-semibold ml-1 hover:underline">{isReg ? 'Sign In' : 'Register'}</button>
          </p>
        </div>
      </div>
    </div>
  );
}
