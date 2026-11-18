import React, { useEffect, useState } from 'react';
import { CheckCircle2, Eye, Globe, Palette, Server, Volume2 } from 'lucide-react';
import { MEDAI_THEMES, useSettings } from '../context/SettingsContext';
import { PLANNED_LANGUAGES, SUPPORTED_LANGUAGES } from '../i18n/translations';
import { api } from '../services/api';

export default function SettingsPage() {
  const { prefs, theme, t, updatePreferences } = useSettings();
  const [health, setHealth] = useState(null);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    api.health().then(setHealth).catch(() => {});
  }, []);

  const applyChange = async (patch) => {
    await updatePreferences(patch);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1800);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t.settings.title}</h1>
          <p className="text-sm text-slate-600 mt-1">{t.settings.subtitle}</p>
        </div>
        {savedNotice && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t.settings.saved}
          </span>
        )}
      </div>

      {/* Color Theme Selection */}
      <section className="med-card bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-teal-700" />
          <h2 className="text-base font-bold text-slate-900">Color Theme</h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {MEDAI_THEMES.map((item) => {
            const active = theme === item.id;
            return (
              <button
                key={item.id}
                onClick={() => applyChange({ theme: item.id })}
                className={`p-4 rounded-xl border text-left transition-colors cursor-pointer space-y-2 ${
                  active
                    ? 'border-teal-700 bg-teal-50 text-teal-950'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm">{item.name}</span>
                  <span className="flex items-center gap-1">
                    {item.swatches.map((hex) => (
                      <span
                        key={hex}
                        className="h-4 w-4 rounded-full border border-slate-300"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </span>
                </div>
                <div className="text-xs text-slate-500">{item.swatches.join(' • ')}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Language Selection */}
      <section className="med-card bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-teal-700" />
          <h2 className="text-base font-bold text-slate-900">{t.settings.languageSection}</h2>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const active = prefs.language === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => applyChange({ language: lang.code })}
                className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                  active
                    ? 'border-teal-600 bg-teal-50 text-teal-950'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-bold text-sm">{lang.nativeLabel}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {lang.label} • Voice ({lang.speechLang})
                </div>
              </button>
            );
          })}
        </div>

        <div className="text-xs text-slate-500 pt-1">
          Extensible regional roadmap:{' '}
          {PLANNED_LANGUAGES.map((l) => l.label).join(', ')} (architecture ready).
        </div>
      </section>

      {/* Accessibility */}
      <section className="med-card bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-5 shadow-xs">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-teal-700" />
          <h2 className="text-base font-bold text-slate-900">{t.settings.accessibilitySection}</h2>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            {t.settings.fontSize}
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { id: 'normal', label: t.settings.fontNormal },
              { id: 'large', label: t.settings.fontLarge },
              { id: 'xlarge', label: t.settings.fontXLarge },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => applyChange({ font_size: opt.id })}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                  prefs.font_size === opt.id
                    ? 'border-teal-600 bg-teal-50 text-teal-900'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
          <div>
            <div className="text-sm font-semibold text-slate-900">{t.settings.highContrast}</div>
            <div className="text-xs text-slate-500">{t.settings.highContrastDesc}</div>
          </div>
          <input
            type="checkbox"
            checked={Boolean(prefs.high_contrast)}
            onChange={(e) => applyChange({ high_contrast: e.target.checked })}
            className="h-5 w-5 accent-teal-700"
          />
        </label>

        <label className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
          <div className="flex items-start gap-2.5">
            <Volume2 className="h-4 w-4 text-teal-700 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-slate-900">{t.settings.autoRead}</div>
              <div className="text-xs text-slate-500">{t.settings.autoReadDesc}</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={Boolean(prefs.voice_auto_read)}
            onChange={(e) => applyChange({ voice_auto_read: e.target.checked })}
            className="h-5 w-5 accent-teal-700"
          />
        </label>
      </section>

      {/* Backend / AI Status */}
      {health && (
        <section className="med-card bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-3 shadow-xs">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-teal-700" />
            <h2 className="text-base font-bold text-slate-900">{t.settings.systemStatus}</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <div className="text-slate-500">AI Engine</div>
              <div className="font-bold text-slate-900 mt-0.5">
                {health.gemini_configured
                  ? `Live (${health.gemini_model})`
                  : 'Demo Mode (set GEMINI_API_KEY)'}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <div className="text-slate-500">Database / Auth</div>
              <div className="font-bold text-slate-900 mt-0.5">{health.storage_mode}</div>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <div className="text-slate-500">Build Stage</div>
              <div className="font-bold text-teal-700 mt-0.5">{health.phase}</div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

