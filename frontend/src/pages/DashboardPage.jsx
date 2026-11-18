import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  ClipboardList,
  FileSearch,
  FileText,
  GitCompare,
  HeartPulse,
  MessageCircleHeart,
  Pill,
  Search,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { api } from '../services/api';

export default function DashboardPage({
  reports,
  sessions,
  prescriptions = [],
  onNavigate,
  onOpenReport,
  onQuickAsk,
  onRefreshData,
}) {
  const { user } = useAuth();
  const { language, theme, t } = useSettings();
  const isHi = language === 'hi';
  const isSkyPeach = theme === 'lavender-blue';

  const [loadingSample, setLoadingSample] = useState(false);
  const [quickQuery, setQuickQuery] = useState('');

  const urgentTotal = reports.reduce((acc, r) => acc + (r.urgent_count || 0), 0);
  const attentionTotal = reports.reduce((acc, r) => acc + (r.attention_count || 0), 0);
  const latestReport = reports?.[0] || null;
  const latestTestsCount = (latestReport?.analysis?.tests || []).length;

  const handleLoadSample = async () => {
    setLoadingSample(true);
    try {
      const res = await api.createSampleReport('standard');
      await onRefreshData();
      onOpenReport(res.report);
    } finally {
      setLoadingSample(false);
    }
  };

  const handleQuickSubmit = (e) => {
    e.preventDefault();
    const q = quickQuery.trim();
    if (!q) {
      onNavigate('chat');
      return;
    }
    onQuickAsk?.(q);
  };

  const moduleCards = [
    {
      id: 'reports',
      icon: FileSearch,
      title: t.nav.reports,
      desc: isHi ? 'PDF/फ़ोटो से टेस्ट मान, अलर्ट व सरल सारांश' : 'Analyze lab PDFs/images, alerts & plain-language summary',
    },
    {
      id: 'prescriptions',
      icon: Pill,
      title: t.nav.prescriptions,
      desc: isHi ? 'पर्चे के संक्षिप्त शब्द व अस्पष्ट लिखावट चेतावनी' : 'Decode Rx abbreviations & flag unclear handwriting',
    },
    {
      id: 'chat',
      icon: MessageCircleHeart,
      title: t.nav.chat,
      desc: isHi ? 'हिन्दी/अंग्रेज़ी और आवाज़ से प्रश्न पूछें' : 'Ask report-aware health questions by text or voice',
    },
    {
      id: 'comparison',
      icon: GitCompare,
      title: t.nav.comparison,
      desc: isHi ? 'दो रिपोर्ट की तुलना और प्रगति ट्रैक करें' : 'Compare two reports & track progress against ranges',
    },
    {
      id: 'lifestyle',
      icon: HeartPulse,
      title: t.nav.lifestyle,
      desc: isHi ? 'व्यक्तिगत दैनिक व साप्ताहिक आहार-व्यायाम गाइड' : 'Supportive daily habits & 7-day meal/exercise plan',
    },
    {
      id: 'doctorPrep',
      icon: ClipboardList,
      title: t.nav.doctorPrep,
      desc: isHi ? 'डॉक्टर से पूछने योग्य प्रश्न व विज़िट शीट' : 'Organized concerns, doctor questions & visit sheet',
    },
    {
      id: 'dictionary',
      icon: BookOpen,
      title: t.nav.dictionary,
      desc: isHi ? 'कठिन मेडिकल शब्दों का सरल अर्थ खोजें' : 'Search medical terms linked directly to your reports',
    },
  ];

  return (
    <div className="space-y-6">
      {/* =====================================================================
          ATMOSPHERIC HERO CANVAS WITH FLOATING GLASS CARDS
          (Inspired by Powder Blue #8DB9F0 + Soft Lavender #E9E8F8 + Sunset Peach #F5B69E)
          ===================================================================== */}
      <section
        className="relative rounded-[2.25rem] p-5 sm:p-8 lg:p-10 overflow-hidden shadow-xl border"
        style={{
          background: isSkyPeach
            ? 'linear-gradient(135deg, #6EA8EE 0%, #9EC2F4 42%, #D7DDF8 70%, #F5B69E 100%)'
            : 'linear-gradient(135deg, #4B6749 0%, #6D8B6A 48%, #B5C5A3 82%, #E5E8CE 100%)',
          borderColor: 'var(--border-soft)',
        }}
      >
        {/* Soft atmospheric sunset / light horizon glow */}
        <div
          className="pointer-events-none absolute -top-20 right-10 h-64 w-64 rounded-full blur-3xl opacity-55"
          style={{ backgroundColor: isSkyPeach ? '#F5B69E' : '#E5E8CE' }}
        />
        <div
          className="pointer-events-none absolute -bottom-24 left-1/3 h-72 w-72 rounded-full blur-3xl opacity-45"
          style={{ backgroundColor: isSkyPeach ? '#E9E8F8' : '#789575' }}
        />

        <div className="relative z-10 flex flex-col justify-between gap-8 min-h-[380px]">
          {/* Top Row: Subtle Pill Actions (mirrors Buy / Filters / Rent bar) */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => onNavigate('reports')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 hover:bg-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
              style={{ color: 'var(--brand-primary)' }}
            >
              <Upload className="h-3.5 w-3.5" />
              <span>{t.dashboard.uploadCta}</span>
            </button>

            <div className="hidden md:flex items-center gap-1 rounded-full bg-white/80 backdrop-blur-md px-2 py-1.5 shadow-sm border border-white/60">
              {[
                { id: 'reports', label: `${reports.length} ${isHi ? 'रिपोर्ट' : 'Reports'}` },
                { id: 'prescriptions', label: `${prescriptions.length} ${isHi ? 'पर्चे' : 'Prescriptions'}` },
                { id: 'comparison', label: isHi ? 'तुलना' : 'Compare' },
                { id: 'lifestyle', label: isHi ? 'आहार गाइड' : 'Lifestyle' },
              ].map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => onNavigate(chip.id)}
                  className="px-3 py-1 rounded-full text-xs font-semibold hover:bg-white transition-colors cursor-pointer"
                  style={{ color: 'var(--text-ink)' }}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => onNavigate('chat')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/90 hover:bg-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
              style={{ color: 'var(--brand-primary)' }}
            >
              <span>{t.dashboard.askDrSehat}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Center Editorial Headline */}
          <div className="max-w-xl space-y-2.5 py-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/90">
              {isHi ? 'व्यक्तिगत स्वास्थ्य संवाद' : 'PERSONAL HEALTH COMMUNICATION'}
            </p>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.08] drop-shadow-xs">
              {t.dashboard.greeting}, {user?.name?.split(' ')[0]}
            </h1>
            <p className="text-sm sm:text-base text-white/90 max-w-md leading-relaxed">
              {t.dashboard.subtitle}
            </p>
          </div>

          {/* Bottom Floating Frosted Glass Cards Row (2-column layout matching reference) */}
          <div className="grid lg:grid-cols-2 gap-4 items-end">
            {/* Bottom-Left Floating Card: Quick Ask / Search Card */}
            <div className="rounded-[1.75rem] bg-white/92 backdrop-blur-xl border border-white/80 p-5 shadow-lg space-y-4">
              <div>
                <h2 className="text-lg font-bold leading-snug" style={{ color: 'var(--text-ink)' }}>
                  {isHi ? 'डॉ. सेहत से पूछें या रिपोर्ट समझें' : 'Ask Dr. Sehat Anything'}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {isHi
                    ? 'कोई लैब टेस्ट, मेडिकल शब्द या स्वास्थ्य सवाल लिखें'
                    : 'Type a lab value, symptom question, or medical term to start'}
                </p>
              </div>

              <form onSubmit={handleQuickSubmit} className="relative flex items-center">
                <Search className="h-4 w-4 absolute left-3.5 text-slate-400" />
                <input
                  type="text"
                  value={quickQuery}
                  onChange={(e) => setQuickQuery(e.target.value)}
                  placeholder={
                    isHi
                      ? 'जैसे: मेरा HbA1c या हीमोग्लोबिन समझाएं...'
                      : 'Search or ask about Hemoglobin, HbA1c, Vitamin D...'
                  }
                  className="w-full rounded-full border border-slate-200 bg-[#F4F5FD] pl-10 pr-12 py-2.5 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
                <button
                  type="submit"
                  aria-label="Ask Dr. Sehat"
                  className="absolute right-1.5 h-8 w-8 rounded-full flex items-center justify-center text-white shadow-sm cursor-pointer transition-transform hover:scale-105"
                  style={{ backgroundColor: 'var(--brand-primary)' }}
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              {/* Compact Summary Mini-Stats */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                    style={{ backgroundColor: 'var(--bg-canvas)', color: 'var(--brand-primary)' }}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {reports.length} {isHi ? 'रिपोर्ट' : 'Reports'}
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                    style={{ backgroundColor: 'var(--brand-warm-soft)', color: 'var(--brand-primary)' }}
                  >
                    <MessageCircleHeart className="h-3.5 w-3.5" />
                    {sessions.length} {isHi ? 'चैट' : 'Chats'}
                  </span>
                </div>
                <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                  {isHi ? '13 मॉड्यूल सक्रिय' : '13 Modules Active'}
                </span>
              </div>
            </div>

            {/* Bottom-Right Floating Card: Latest Report Spotlight (mirrors property spotlight card) */}
            <div className="rounded-[1.75rem] bg-white/88 backdrop-blur-xl border border-white/80 p-5 shadow-lg space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    {latestReport
                      ? isHi
                        ? 'नवीनतम मेडिकल रिपोर्ट'
                        : 'Latest Medical Report'
                      : isHi
                      ? 'त्वरित शुरुआत'
                      : 'Quick Start Spotlight'}
                  </div>
                  <h2 className="text-lg font-bold truncate mt-0.5" style={{ color: 'var(--text-ink)' }}>
                    {latestReport
                      ? latestReport.title
                      : isHi
                      ? 'अपनी पहली रिपोर्ट जांचें'
                      : 'Ready for Your First Report'}
                  </h2>
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                    {latestReport
                      ? `${latestReport.lab_name || 'MedAi Analysis'} • ${
                          latestReport.report_date ||
                          new Date(latestReport.created_at).toLocaleDateString()
                        }`
                      : isHi
                      ? 'PDF/फ़ोटो अपलोड करें या नमूना रिपोर्ट आज़माएं'
                      : 'Upload a PDF/image lab report or try a sample panel'}
                  </p>
                </div>

                <button
                  onClick={() => (latestReport ? onOpenReport(latestReport) : onNavigate('reports'))}
                  title={isHi ? 'खोलें' : 'Open'}
                  className="h-9 w-9 rounded-full bg-white border border-black/10 flex items-center justify-center shrink-0 hover:scale-105 transition-transform cursor-pointer shadow-xs"
                  style={{ color: 'var(--brand-primary)' }}
                >
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>

              {/* 3-Column Metrics Row (mirrors 3 Beds | 2 Baths | 1,260 sq ft) */}
              <div className="grid grid-cols-3 gap-2 rounded-2xl p-3" style={{ backgroundColor: 'var(--bg-canvas)' }}>
                <div className="text-center">
                  <div className="text-base font-extrabold" style={{ color: 'var(--text-ink)' }}>
                    {latestReport ? latestTestsCount : reports.length}
                  </div>
                  <div className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                    {latestReport ? (isHi ? 'टेस्ट' : 'Lab Tests') : t.dashboard.totalReports}
                  </div>
                </div>
                <div className="text-center border-x border-black/10">
                  <div className="text-base font-extrabold text-amber-700">
                    {latestReport ? latestReport.attention_count : attentionTotal}
                  </div>
                  <div className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                    {isHi ? 'ध्यान दें' : 'Attention'}
                  </div>
                </div>
                <div className="text-center">
                  <div
                    className={`text-base font-extrabold ${
                      (latestReport ? latestReport.urgent_count : urgentTotal) > 0
                        ? 'text-rose-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    {latestReport ? latestReport.urgent_count : urgentTotal}
                  </div>
                  <div className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                    {isHi ? 'तुरंत अलर्ट' : 'Urgent'}
                  </div>
                </div>
              </div>

              {/* Full-width Dark Pill Action Button (mirrors "View Details →") */}
              {latestReport ? (
                <button
                  onClick={() => onOpenReport(latestReport)}
                  className="w-full py-2.5 px-4 rounded-full text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition-opacity hover:opacity-95 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--brand-primary)',
                    color: 'var(--text-on-primary)',
                  }}
                >
                  <span>{isHi ? 'पूरी रिपोर्ट देखें' : 'View Report Details'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={handleLoadSample}
                  disabled={loadingSample}
                  className="w-full py-2.5 px-4 rounded-full text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition-opacity hover:opacity-95 cursor-pointer disabled:opacity-60"
                  style={{
                    backgroundColor: 'var(--brand-primary)',
                    color: 'var(--text-on-primary)',
                  }}
                >
                  <Sparkles className="h-4 w-4" />
                  <span>{loadingSample ? '...' : t.dashboard.trySample}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          ALL MEDAI MODULES BENTO GRID
          ===================================================================== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold" style={{ color: 'var(--text-ink)' }}>
            {t.dashboard.quickModules}
          </h2>
          <div className="flex items-center gap-2 text-xs">
            {urgentTotal > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" />
                {urgentTotal} {t.reports.urgentBadge}
              </span>
            )}
            {attentionTotal > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold">
                <Bell className="h-3.5 w-3.5" />
                {attentionTotal} {t.reports.attentionBadge}
              </span>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {moduleCards.map(({ id, icon: Icon, title, desc }, idx) => (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className="med-card group text-left rounded-[1.5rem] border p-4 space-y-2.5 transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer shadow-xs"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-soft)',
              }}
            >
              <div className="flex items-center justify-between">
                <div
                  className="h-10 w-10 rounded-2xl flex items-center justify-center border"
                  style={{
                    backgroundColor:
                      isSkyPeach && idx % 2 === 1 ? 'var(--brand-warm-soft)' : 'var(--bg-canvas)',
                    borderColor:
                      isSkyPeach && idx % 2 === 1 ? 'var(--brand-warm)' : 'var(--border-soft)',
                    color: 'var(--brand-primary)',
                  }}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <ArrowUpRight
                  className="h-4 w-4 opacity-40 group-hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--brand-primary)' }}
                />
              </div>
              <div className="font-bold text-sm" style={{ color: 'var(--text-ink)' }}>
                {title}
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {desc}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* =====================================================================
          RECENT MEDICAL REPORTS
          ===================================================================== */}
      {reports.length > 0 && (
        <section
          className="med-card rounded-[1.75rem] border p-5 sm:p-6 shadow-xs"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-soft)',
          }}
        >
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-base font-bold" style={{ color: 'var(--text-ink)' }}>
              {t.dashboard.recentReports}
            </h2>
            <button
              onClick={() => onNavigate('history')}
              className="text-xs font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
              style={{ color: 'var(--brand-primary)' }}
            >
              {t.dashboard.viewAll}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="divide-y divide-black/5">
            {reports.slice(0, 4).map((rep) => (
              <button
                key={rep.id}
                onClick={() => onOpenReport(rep)}
                className="w-full py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left hover:bg-white/70 -mx-2 px-2 rounded-2xl transition-colors cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate" style={{ color: 'var(--text-ink)' }}>
                      {rep.title}
                    </span>
                    {rep.is_demo && (
                      <span
                        className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: 'var(--bg-canvas)', color: 'var(--brand-primary)' }}
                      >
                        Demo
                      </span>
                    )}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {rep.report_date || new Date(rep.created_at).toLocaleDateString()} •{' '}
                    {(rep.analysis?.tests || []).length}{' '}
                    {isHi ? 'टेस्ट निकाले गए' : 'tests extracted'}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {rep.urgent_count > 0 && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-100 text-rose-800">
                      {rep.urgent_count} {t.reports.urgentBadge}
                    </span>
                  )}
                  {rep.attention_count > 0 && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                      {rep.attention_count} {t.reports.attentionBadge}
                    </span>
                  )}
                  {rep.urgent_count === 0 && rep.attention_count === 0 && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                      {isHi ? 'सभी सामान्य' : 'All Normal'}
                    </span>
                  )}
                  <ArrowRight className="h-4 w-4 opacity-50" />
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
