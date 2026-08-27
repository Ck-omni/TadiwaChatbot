import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    const redirectTo = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    const result = await login(email, password);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || 'Unable to sign in.');
      return;
    }

    const redirectTo = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';
    navigate(redirectTo, { replace: true });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6"
     style={
      {
        background: `url('./src/assets/login.png') no-repeat center center`,
        backgroundSize: 'cover',
        backgroundPosition: 'fixed',
        backgroundAttachment: 'fixed',
      }
     }
    >
      <div className="w-full flex flex-row justify-between px-20">
        <div>

        </div>
        <div className="w-full max-w-lg"  >
          <div className="flex flex-col items-start mb-2">
            <img src="./src/assets/logo.png" alt="Logo" className="w-1/3 mb-4" />
          </div>
          <h1 className="text-2xl font-bold text-white mt-5 uppercase">Tadiwa Chatbot</h1>
          <p className="text-sm text-white/40 mt-1">OmniContact helpdesk agent manager</p>
          <div className="glass-surface rounded-3xl shadow-sm mt-10 p-8 w-full py-10">
            <p className="text-sm text-white/40 mt-1">Sign in here</p>
            <form onSubmit={handleSubmit} className=" mt-10" noValidate>
              <div>
                <label htmlFor="email" className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Work Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@omnicontact.bix"
                  className="w-full px-4 py-3 bg-transparent border border-slate-200 rounded-xl text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 transition-all"
                />
              </div>

              <div className="mt-6">
                <label htmlFor="password" className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 pr-11 bg-transparent border border-slate-200 rounded-xl text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end mt-1">
                <a href="" className="text-sm text-blue-500 hover:text-blue-600 transition-colors">
                  Forgot Password?
                </a>
              </div>

              {error && (
                <div className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3" role="alert">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-10 flex items-center justify-center gap-2 py-3 border border-slate-200 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-all active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-blue-500/20"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                {isSubmitting ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
            <div className="flex items-center justify-center gap-2 mt-6 text-sm text-slate-400">
              <p>New here?</p>
              <a href="" className="text-blue-500 hover:text-blue-600 transition-colors">
                Send invite request
              </a>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mt-6 text-[10px] uppercase tracking-widest font-bold text-slate-400">
            <ShieldCheck size={14} />
            OmniContact Internal Systems · Authorized Use Only
          </div>
        </div>
      </div>
    </div>
  );
}
