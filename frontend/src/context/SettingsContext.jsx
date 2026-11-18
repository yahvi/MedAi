import React, { createContext, useContext, useEffect, useState } from 'react';
import { translations } from '../i18n/translations';
import { api } from '../services/api';

export const MEDAI_THEMES = [
  {
    id: 'lavender-blue',
    name: 'Powder Blue & Sunset Peach',
    shortName: 'Sky & Peach',
    swatches: ['#8DB9F0', '#E9E8F8', '#F5B69E'],
  },
  {
    id: 'sage-ivory',
    name: 'Pale Sage Ivory & Forest',
    shortName: 'Sage Ivory',
    swatches: ['#E5E8CE', '#789575', '#384F37'],
  },
];

const DEFAULT_PREFS = {
  language: 'en',
  font_size: 'normal',
  high_contrast: false,
  voice_auto_read: false,
  theme: 'lavender-blue',
};

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [prefs, setPrefs] = useState(() => {
    try {
      const saved = localStorage.getItem('medai_prefs');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Default to the newly requested lavender-blue theme if theme wasn't explicitly set yet
        return { ...DEFAULT_PREFS, ...parsed, theme: parsed.theme || 'lavender-blue' };
      }
      return DEFAULT_PREFS;
    } catch {
      return DEFAULT_PREFS;
    }
  });

  useEffect(() => {
    localStorage.setItem('medai_prefs', JSON.stringify(prefs));
    const root = document.documentElement;
    root.classList.remove('font-scale-normal', 'font-scale-large', 'font-scale-xlarge');
    root.classList.add(`font-scale-${prefs.font_size || 'normal'}`);
    root.classList.toggle('high-contrast', Boolean(prefs.high_contrast));
    root.lang = prefs.language === 'hi' ? 'hi' : 'en';
    root.dataset.theme = prefs.theme || 'lavender-blue';
  }, [prefs]);

  const updatePreferences = async (patch, syncToServer = true) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    if (syncToServer && localStorage.getItem('medai_token')) {
      try {
        const res = await api.updatePreferences(next);
        if (res.preferences) {
          setPrefs((prev) => ({ ...prev, ...res.preferences, theme: next.theme }));
        }
      } catch {
        // Keep local preferences even if offline
      }
    }
  };

  const toggleTheme = () => {
    const nextTheme = prefs.theme === 'lavender-blue' ? 'sage-ivory' : 'lavender-blue';
    updatePreferences({ theme: nextTheme }, false);
  };

  const cycleLanguage = (syncToServer = true) => {
    const order = ['en', 'hi', 'hinglish'];
    const idx = order.indexOf(prefs.language);
    const nextLang = order[(idx + 1) % order.length];
    updatePreferences({ language: nextLang }, syncToServer);
  };

  const hydrateFromServer = (serverPrefs) => {
    if (serverPrefs) {
      setPrefs((prev) => ({ ...prev, ...serverPrefs }));
    }
  };

  const t = translations[prefs.language] || translations.en;

  return (
    <SettingsContext.Provider
      value={{
        prefs,
        language: prefs.language,
        theme: prefs.theme || 'lavender-blue',
        t,
        updatePreferences,
        cycleLanguage,
        toggleTheme,
        hydrateFromServer,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
