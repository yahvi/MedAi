import React, { useEffect, useState } from 'react';
import { ArrowLeft, Globe, ShieldCheck, Stethoscope } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import ThemeSwitcher from './ThemeSwitcher';

export default function AuthScreen({ initialMode = 'login', onBack }) {
  const { login, register, demoLogin } = useAuth();
  const { language, t, cycleLanguage } = useSettings();
  const isHi = language === 'hi';
  const langLabel = isHi ? 'हिन्दी' : language === 'hinglish' ? 'Hinglish' : 'English';

  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    setError('');
  }, [initialMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemo = async () => {
    setError('');
    setSubmitting(true);
    try {
      await demoLogin();
    } catch (err) {
      setError(err.message || 'Could not start demo session.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col transition-colors duration-300"
      style={{ backgroundColor: 'var(--bg-canvas)', color: 'var(--text-ink)' }}
    >
      {/* Top Bar */}
      <header className="px-4 sm:px-6 py-4 flex items-center justify-between max-w-5xl w-full mx-auto">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
              style={{ borderColor: 'var(--border-strong)' }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{isHi ? 'होम' : 'Back'}</span>
            </button>
          )}
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-teal-700 text-white flex items-center justify-center shadow-sm">
              <Stethoscope className="h-4 w-4" />
            </div>
            <div>
              <div className="font-bold leading-none">{t.appName}</div>
              <div className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                {t.tagline}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <button
            onClick={() => cycleLanguage(false)}
            title="Switch Language: English / हिन्दी / Hinglish"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-white text-teal-800 text-xs font-semibold hover:bg-teal-50 cursor-pointer"
            style={{ borderColor: 'var(--border-strong)' }}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>{langLabel}</span>
          </button>
        </div>
      </header>

      {/* Focused Sign Up / Login Card */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-5">
          <div
            className="med-card rounded-3xl border shadow-lg p-6 sm:p-8"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-soft)',
            }}
          >
            {/* Mode Switch Tabs */}
            <div
              className="grid grid-cols-2 rounded-xl p-1 mb-6"
              style={{ backgroundColor: 'var(--bg-canvas)' }}
            >
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className={`py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isHi ? 'लॉग इन (Login)' : 'Login'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
                className={`py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  mode === 'register'
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isHi ? 'साइन अप (Sign Up)' : 'Sign Up'}
              </button>
            </div>

            <h1 className="text-xl font-bold text-slate-900">
              {mode === 'login' ? t.auth.signIn : t.auth.register}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {mode === 'login'
                ? isHi
                  ? 'अपने MedAi डैशबोर्ड और सहेजी गई रिपोर्ट देखने के लिए लॉग इन करें।'
                  : 'Sign in to access your patient dashboard, reports, and Dr. Sehat chats.'
                : isHi
                ? 'अपना निजी और सुरक्षित MedAi मरीज़ खाता बनाएं।'
                : 'Create your private MedAi account to upload reports and chat with Dr. Sehat.'}
            </p>

            {error && (
              <div className="mt-4 rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.auth.name}
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Priya Verma"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.auth.email}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="patient@example.com"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.auth.password}
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white font-semibold py-2.5 text-sm transition-colors cursor-pointer shadow-sm"
              >
                {submitting ? '...' : mode === 'login' ? t.auth.signIn : t.auth.register}
              </button>
            </form>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[11px] font-medium text-slate-400 uppercase">or</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={handleDemo}
              className="w-full rounded-xl border border-teal-300 bg-teal-50 hover:bg-teal-100 text-teal-900 font-semibold py-2.5 text-sm transition-colors cursor-pointer"
            >
              {t.auth.demoBtn}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError('');
              }}
              className="mt-4 w-full text-center text-xs font-medium text-teal-700 hover:underline cursor-pointer"
            >
              {mode === 'login' ? t.auth.switchToRegister : t.auth.switchToLogin}
            </button>
          </div>

          <div className="flex items-start gap-2.5 text-xs text-slate-600 bg-amber-50/90 border border-amber-200 rounded-xl p-3.5">
            <ShieldCheck className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
            <span>{t.disclaimerBanner}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
