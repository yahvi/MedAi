import React, { useState } from 'react';
import {
  Activity,
  BookOpen,
  ClipboardList,
  FileSearch,
  GitCompare,
  Globe,
  HeartPulse,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircleHeart,
  Pill,
  Settings,
  ShieldAlert,
  Stethoscope,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import ThemeSwitcher from './ThemeSwitcher';

export default function Layout({ activePage, onNavigate, children }) {
  const { user, logout } = useAuth();
  const { language, t, updatePreferences } = useSettings();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const primaryItems = [
    { id: 'dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
    { id: 'reports', label: t.nav.reports, icon: FileSearch },
    { id: 'prescriptions', label: t.nav.prescriptions, icon: Pill },
    { id: 'chat', label: t.nav.chat, icon: MessageCircleHeart },
    { id: 'comparison', label: t.nav.comparison, icon: GitCompare },
    { id: 'lifestyle', label: t.nav.lifestyle, icon: HeartPulse },
    { id: 'doctorPrep', label: t.nav.doctorPrep, icon: ClipboardList },
    { id: 'dictionary', label: t.nav.dictionary, icon: BookOpen },
    { id: 'history', label: t.nav.history, icon: History },
  ];

  const handleNav = (id) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  const toggleLanguage = () => {
    updatePreferences({ language: language === 'en' ? 'hi' : 'en' });
  };

  const MobileDrawer = (
    <div
      className="flex h-full flex-col border-r"
      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-soft)' }}
    >
      <div
        className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: 'var(--border-soft)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="h-9 w-9 rounded-xl text-white flex items-center justify-center shadow-sm"
            style={{ backgroundColor: 'var(--brand-primary)' }}
          >
            <Stethoscope className="h-4 w-4" />
          </div>
          <div>
            <div className="text-base font-bold leading-none">{t.appName}</div>
            <div className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
              {t.tagline}
            </div>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(false)}
          className="p-1.5 rounded-lg hover:bg-black/5 cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {[...primaryItems, { id: 'settings', label: t.nav.settings, icon: Settings }].map(
          ({ id, label, icon: Icon }) => {
            const active = activePage === id;
            return (
              <button
                key={id}
                onClick={() => handleNav(id)}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-semibold transition-all cursor-pointer"
                style={
                  active
                    ? {
                        backgroundColor: 'var(--brand-primary)',
                        color: 'var(--text-on-primary)',
                      }
                    : { color: 'var(--text-ink)' }
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            );
          }
        )}
      </nav>

      <div className="p-3 border-t" style={{ borderColor: 'var(--border-soft)' }}>
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-white/80 px-3 py-2.5 border border-black/5">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{user?.name}</p>
            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
              {user?.email}
            </p>
          </div>
          <button
            onClick={logout}
            title={t.auth.signOut}
            className="p-2 rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="min-h-screen flex transition-colors duration-300"
      style={{ backgroundColor: 'var(--bg-canvas)', color: 'var(--text-ink)' }}
    >
      {/* Desktop Floating Slim Icon Rail (matches floating glass dashboard aesthetic) */}
      <aside className="hidden lg:flex flex-col items-center py-4 pl-4 pr-2 sticky top-0 h-screen shrink-0 z-30">
        <div
          className="flex flex-col items-center justify-between h-full w-[72px] rounded-[2rem] py-4 border shadow-lg shadow-black/5 backdrop-blur-md"
          style={{
            backgroundColor: 'var(--bg-header)',
            borderColor: 'var(--border-soft)',
          }}
        >
          {/* Brand Logo */}
          <button
            onClick={() => handleNav('dashboard')}
            title={t.appName}
            className="h-11 w-11 rounded-2xl text-white flex items-center justify-center shadow-md transition-transform hover:scale-105 cursor-pointer"
            style={{ backgroundColor: 'var(--brand-primary)' }}
          >
            <Stethoscope className="h-5 w-5" />
          </button>

          {/* Module Icon Rail */}
          <nav className="flex flex-col items-center gap-1.5 my-2 overflow-y-auto py-1">
            {primaryItems.map(({ id, label, icon: Icon }) => {
              const active = activePage === id;
              return (
                <button
                  key={id}
                  onClick={() => handleNav(id)}
                  title={label}
                  aria-label={label}
                  className="group relative h-10 w-10 rounded-full flex items-center justify-center transition-all cursor-pointer"
                  style={
                    active
                      ? {
                          backgroundColor: 'var(--brand-primary)',
                          color: 'var(--text-on-primary)',
                          boxShadow: '0 6px 16px -4px rgba(70,63,110,0.45)',
                        }
                      : {
                          color: 'var(--text-muted)',
                        }
                  }
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {/* Hover Tooltip */}
                  <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute left-14 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold shadow-lg z-50 bg-slate-900 text-white">
                    {label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Bottom Controls: Settings + Sign Out */}
          <div className="flex flex-col items-center gap-1.5 pt-2 border-t border-black/5 w-10">
            <button
              onClick={() => handleNav('settings')}
              title={t.nav.settings}
              className="group relative h-10 w-10 rounded-full flex items-center justify-center transition-all cursor-pointer"
              style={
                activePage === 'settings'
                  ? { backgroundColor: 'var(--brand-primary)', color: 'var(--text-on-primary)' }
                  : { color: 'var(--text-muted)' }
              }
            >
              <Settings className="h-[18px] w-[18px]" />
              <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute left-14 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold shadow-lg z-50 bg-slate-900 text-white">
                {t.nav.settings}
              </span>
            </button>

            <button
              onClick={logout}
              title={`${t.auth.signOut} (${user?.name})`}
              className="group relative h-10 w-10 rounded-full flex items-center justify-center text-slate-500 hover:bg-rose-100 hover:text-rose-700 transition-colors cursor-pointer"
            >
              <LogOut className="h-[18px] w-[18px]" />
              <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute left-14 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold shadow-lg z-50 bg-slate-900 text-white">
                {t.auth.signOut}
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-72 max-w-[85vw] h-full shadow-2xl">{MobileDrawer}</div>
          <div
            className="flex-1 bg-slate-900/40 backdrop-blur-[1px]"
            onClick={() => setMobileMenuOpen(false)}
          />
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Floating Glass Top Pill Header */}
        <header className="sticky top-0 z-20 px-4 lg:px-6 pt-3.5 pb-2">
          <div
            className="max-w-6xl mx-auto rounded-full border shadow-sm backdrop-blur-md px-3 sm:px-4 py-2 flex items-center justify-between gap-2"
            style={{
              backgroundColor: 'var(--bg-header)',
              borderColor: 'var(--border-soft)',
            }}
          >
            {/* Left: Mobile Menu + Brand / Quick Pill */}
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setMobileMenuOpen((v) => !v)}
                className="lg:hidden p-2 rounded-full border border-black/10 bg-white/80 cursor-pointer"
                aria-label="Toggle Menu"
              >
                <Menu className="h-4 w-4" />
              </button>

              <button
                onClick={() => handleNav('dashboard')}
                className="flex items-center gap-2 px-2.5 py-1 rounded-full hover:bg-black/5 transition-colors cursor-pointer"
              >
                <Activity className="h-4 w-4 shrink-0" style={{ color: 'var(--brand-primary)' }} />
                <span className="font-bold text-sm">{t.appName}</span>
              </button>

              {/* Center-left quick module nav pills on wide screens */}
              <div className="hidden xl:flex items-center gap-1 pl-2 border-l border-black/10">
                {[
                  { id: 'reports', label: t.nav.reports },
                  { id: 'prescriptions', label: t.nav.prescriptions },
                  { id: 'chat', label: t.nav.chat },
                  { id: 'comparison', label: t.nav.comparison },
                  { id: 'lifestyle', label: t.nav.lifestyle },
                ].map((item) => {
                  const active = activePage === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNav(item.id)}
                      className="px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer"
                      style={
                        active
                          ? {
                              backgroundColor: 'var(--brand-primary)',
                              color: 'var(--text-on-primary)',
                            }
                          : { color: 'var(--text-muted)' }
                      }
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Theme Switcher + Language + User Pill */}
            <div className="flex items-center gap-2 shrink-0">
              <ThemeSwitcher />

              <button
                onClick={toggleLanguage}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors cursor-pointer"
                style={{
                  backgroundColor: 'var(--bg-pill)',
                  borderColor: 'var(--border-strong)',
                  color: 'var(--brand-primary)',
                }}
                title="Switch Language (English / Hindi)"
              >
                <Globe className="h-3.5 w-3.5" />
                <span>{language === 'en' ? 'EN → हिन्दी' : 'हिन्दी → EN'}</span>
              </button>

              <div
                className="hidden sm:flex items-center gap-2 pl-2 pr-3 py-1 rounded-full border text-xs font-semibold"
                style={{
                  backgroundColor: 'var(--bg-pill)',
                  borderColor: 'var(--border-soft)',
                }}
              >
                <span
                  className="h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                  style={{ backgroundColor: 'var(--brand-primary)' }}
                >
                  {(user?.name || 'P').charAt(0).toUpperCase()}
                </span>
                <span className="max-w-[110px] truncate">{user?.name?.split(' ')[0]}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 px-4 lg:px-6 py-4 max-w-6xl w-full mx-auto">
          {children}
        </main>

        {/* Safety Footer */}
        <footer className="px-4 lg:px-6 py-4 mt-4">
          <div
            className="max-w-6xl mx-auto rounded-2xl border px-4 py-3 text-xs flex flex-col sm:flex-row items-center justify-between gap-2"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-soft)',
              color: 'var(--text-muted)',
            }}
          >
            <span className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0" style={{ color: 'var(--brand-primary)' }} />
              <span>{t.disclaimerBanner}</span>
            </span>
            <span className="font-semibold shrink-0" style={{ color: 'var(--brand-primary)' }}>
              MedAi • All 13 Modules
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
