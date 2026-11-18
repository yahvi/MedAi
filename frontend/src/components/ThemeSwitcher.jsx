import React from 'react';
import { Palette } from 'lucide-react';
import { MEDAI_THEMES, useSettings } from '../context/SettingsContext';

export default function ThemeSwitcher() {
  const { theme, toggleTheme } = useSettings();
  const next = MEDAI_THEMES.find((item) => item.id !== theme) || MEDAI_THEMES[0];

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={`Switch to ${next.name}`}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors cursor-pointer"
      style={{
        backgroundColor: 'var(--bg-pill)',
        borderColor: 'var(--border-strong)',
        color: 'var(--text-ink)',
      }}
    >
      <Palette className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--brand-primary)' }} />
      <span className="flex items-center -space-x-1">
        {next.swatches.map((hex) => (
          <span
            key={hex}
            className="h-3 w-3 rounded-full border border-white shadow-xs"
            style={{ backgroundColor: hex }}
          />
        ))}
      </span>
      <span className="hidden md:inline">{next.shortName}</span>
    </button>
  );
}

