import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Mail, Lock, User, Briefcase, Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function Field({ label, type = 'text', value, onChange, placeholder, icon: Icon, error, autoComplete }) {
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (show ? 'text' : 'password') : type;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <div className="relative flex items-center">
        {Icon && (
          <span className="absolute left-3.5 pointer-events-none" style={{ color: focused ? '#2563eb' : '#94a3b8' }}>
            <Icon size={15} />
          </span>
        )}
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="input-field"
          style={{
            paddingLeft: Icon ? '2.75rem' : '1rem',
            paddingRight: isPassword ? '2.75rem' : '1rem',
            borderColor: error ? '#fca5a5' : focused ? '#2563eb' : '#e2e8f0',
            boxShadow: focused ? '0 0 0 3px rgba(37, 99, 235, 0.08)' : 'none',
          }}
        />
        {isPassword && (
          <button type="button" onClick={() => setShow(s => !s)}
            className="absolute right-3.5 text-slate-400 hover:text-slate-600" tabIndex={-1}>
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>
      {error && (
        <p className="text-[11px] flex items-center gap-1 text-red-500">
          <AlertCircle size={10} /> {error}
        </p>
      )}
    </div>
  );
}

export default function AuthPage() {
  const { login, register, authError, setAuthError } = useAuth();

  const [mode, setMode]         = useState('login');
  const [loading, setLoading]   = useState(false);
  const [formErr, setFormErr]   = useState({});
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [fullName, setFullName] = useState('');
  const [company, setCompany]   = useState('');
  const [apiError, setApiError] = useState('');

  const switchMode = (m) => {
    setMode(m);
    setFormErr({});
    setApiError('');
    setAuthError('');
  };

  const validate = () => {
    const errs = {};
    if (!email.includes('@'))   errs.email    = 'Enter a valid email address.';
    if (password.length < 6)    errs.password = 'Minimum 6 characters.';
    if (mode === 'register') {
      if (!fullName.trim())     errs.fullName = 'Full name is required.';
      if (confirm !== password) errs.confirm  = 'Passwords do not match.';
    }
    setFormErr(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    if (!validate()) return;
    setLoading(true);
    try {
      if (mode === 'login') {
        await login({ email, password });
      } else {
        await register({ email, password, fullName, company });
      }
    } catch (err) {
      setApiError(err?.response?.data?.detail || err?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Brand */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="rounded-lg p-2 bg-blue-600">
            <Building2 size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Flyyy<span className="text-blue-600">AI</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">
              Construction Intelligence
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="card p-8">
          {/* Tab toggle */}
          <div className="flex rounded-lg p-1 mb-6 bg-slate-100">
            {['login', 'register'].map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-200
                  ${mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-900">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              {mode === 'login'
                ? 'Sign in to access your projects and vendors.'
                : 'Get started with FlyyyAI in 30 seconds.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <AnimatePresence mode="wait">
              {mode === 'register' && (
                <motion.div key="register-fields"
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }} className="flex flex-col gap-4 overflow-hidden">
                  <Field label="Full Name" value={fullName} onChange={setFullName}
                    placeholder="Dinesh Kumar" icon={User} error={formErr.fullName} autoComplete="name" />
                  <Field label="Company (optional)" value={company} onChange={setCompany}
                    placeholder="ABC Construction Ltd" icon={Briefcase} autoComplete="organization" />
                </motion.div>
              )}
            </AnimatePresence>

            <Field label="Email Address" type="email" value={email} onChange={setEmail}
              placeholder="engineer@company.com" icon={Mail} error={formErr.email} autoComplete="email" />
            <Field label="Password" type="password" value={password} onChange={setPassword}
              placeholder={mode === 'register' ? 'Min 6 characters' : 'Your password'} icon={Lock}
              error={formErr.password} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />

            <AnimatePresence>
              {mode === 'register' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <Field label="Confirm Password" type="password" value={confirm} onChange={setConfirm}
                    placeholder="Repeat password" icon={Lock} error={formErr.confirm} autoComplete="new-password" />
                </motion.div>
              )}
            </AnimatePresence>

            {apiError && (
              <div className="flex items-start gap-2 rounded-lg px-4 py-3 bg-red-50 border border-red-200">
                <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs text-red-600">{apiError}</p>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="btn-primary w-full mt-2 flex items-center justify-center gap-2 py-3">
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Please wait...</>
                : mode === 'login' ? 'Sign In' : 'Create Account'
              }
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-6">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
              className="font-semibold text-blue-600 hover:underline">
              {mode === 'login' ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
