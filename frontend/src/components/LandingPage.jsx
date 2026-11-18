import React from 'react';
import {
  ArrowRight,
  BookOpen,
  FileSearch,
  GitCompare,
  Globe,
  HeartPulse,
  LogIn,
  MessageCircleHeart,
  Mic,
  Pill,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserPlus,
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import ThemeSwitcher from './ThemeSwitcher';

export default function LandingPage({ onOpenLogin, onOpenSignup, onDemoLogin, demoBusy }) {
  const { language, theme, t, cycleLanguage } = useSettings();
  const isHi = language === 'hi';
  const isHinglish = language === 'hinglish';
  const isSkyPeach = theme === 'lavender-blue';
  const langLabel = isHi ? 'हिन्दी' : isHinglish ? 'Hinglish' : 'English';

  const features = [
    {
      icon: FileSearch,
      title: isHi ? 'AI मेडिकल रिपोर्ट विश्लेषण' : 'AI Medical Report Analysis',
      desc: isHi
        ? 'PDF या फ़ोटो अपलोड करें और हर टेस्ट के मान, सामान्य सीमा और सरल भाषा में अर्थ समझें।'
        : 'Upload PDF or image lab reports to get structured tables, reference-range status, and plain-language explanations.',
    },
    {
      icon: MessageCircleHeart,
      title: isHi ? 'डॉ. सेहत AI चैटबॉट' : 'Dr. Sehat AI Assistant',
      desc: isHi
        ? 'अपनी रिपोर्ट से जुड़े प्रश्न हिन्दी या अंग्रेज़ी में पूछें और सरल, सुरक्षित उत्तर पाएं।'
        : 'Ask follow-up questions connected to your uploaded reports in English or Hindi with built-in medical safety rules.',
    },
    {
      icon: Pill,
      title: isHi ? 'पर्चा व्याख्या (Prescription Explainer)' : 'Prescription Explainer',
      desc: isHi
        ? 'OD, BD, PC जैसे मेडिकल संक्षिप्त शब्दों को समझें — अस्पष्ट लिखावट पर अनुमान नहीं, स्पष्ट चेतावनी।'
        : 'Decode medical abbreviations and clearly legible instructions while flagging unclear handwriting for pharmacist review.',
    },
    {
      icon: Mic,
      title: isHi ? 'बहुभाषी और वॉइस सहायता' : 'Multilingual & Voice Assistance',
      desc: isHi
        ? 'बोलकर प्रश्न पूछें और रिपोर्ट या उत्तरों को अपनी भाषा (हिन्दी/अंग्रेज़ी) में सुनें।'
        : 'Speak your questions through a microphone and listen to simplified report summaries in English or Hindi.',
    },
    {
      icon: GitCompare,
      title: isHi ? 'रिपोर्ट तुलना और प्रगति' : 'Report Comparison & Progress',
      desc: isHi
        ? 'दो अलग तारीखों की रिपोर्ट की तुलना करें और सामान्य सीमा के सापेक्ष बदलाव देखें।'
        : 'Compare previous and latest lab reports against reference ranges to understand health progress clearly.',
    },
    {
      icon: HeartPulse,
      title: isHi ? 'आहार, जीवनशैली व डॉक्टर तैयारी' : 'Diet, Lifestyle & Doctor Prep',
      desc: isHi
        ? 'दैनिक व साप्ताहिक स्वस्थ दिनचर्या, मेडिकल शब्दकोश और डॉक्टर से पूछने योग्य प्रश्न तैयार करें।'
        : 'Receive supportive daily & weekly wellness plans, search medical terms, and organize questions before clinic visits.',
    },
  ];

  return (
    <div
      className="min-h-screen flex flex-col transition-colors duration-300"
      style={{ backgroundColor: 'var(--bg-canvas)', color: 'var(--text-ink)' }}
    >
      {/* Top Navbar */}
      <header
        className="sticky top-0 z-30 backdrop-blur-md border-b"
        style={{
          backgroundColor: 'var(--bg-header)',
          borderColor: 'var(--border-soft)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-xl text-white flex items-center justify-center shadow-sm"
              style={{
                background: isSkyPeach
                  ? 'linear-gradient(135deg, #463F6E, #8DB9F0)'
                  : 'var(--brand-accent)',
              }}
            >
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight leading-none">{t.appName}</div>
              <div className="text-[11px] font-semibold mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {t.tagline}
              </div>
            </div>
          </div>

          {/* Right Controls: Theme Switcher + Language + Login + Sign Up */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <ThemeSwitcher />

            <button
              onClick={() => cycleLanguage(false)}
              title="Switch Language: English / हिन्दी / Hinglish"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-pill)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-ink)',
              }}
            >
              <Globe className="h-3.5 w-3.5" style={{ color: 'var(--brand-accent)' }} />
              <span>{langLabel}</span>
            </button>

            <button
              onClick={onOpenLogin}
              className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-full border text-xs sm:text-sm font-semibold transition-colors cursor-pointer hover:opacity-90"
              style={{
                backgroundColor: 'var(--bg-pill)',
                borderColor: 'var(--brand-primary)',
                color: 'var(--brand-primary)',
              }}
            >
              <LogIn className="h-4 w-4" />
              <span>{isHi ? 'लॉग इन' : 'Login'}</span>
            </button>

            <button
              onClick={onOpenSignup}
              className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-semibold shadow-xs transition-opacity hover:opacity-95 cursor-pointer"
              style={{
                backgroundColor: 'var(--brand-primary)',
                color: 'var(--text-on-primary)',
              }}
            >
              <UserPlus className="h-4 w-4" />
              <span>{isHi ? 'साइन अप' : 'Sign Up'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero / Introduction Section */}
      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-12 sm:pt-12 sm:pb-16">
          <div
            className="rounded-[2rem] px-5 sm:px-10 py-12 sm:py-16 text-center shadow-lg border relative overflow-hidden"
            style={{
              background: 'var(--hero-gradient)',
              borderColor: 'var(--border-soft)',
            }}
          >
            {/* Soft warm sunset peach glow orb in lavender-blue theme */}
            {isSkyPeach && (
              <div
                className="pointer-events-none absolute -bottom-24 -right-20 h-72 w-72 rounded-full blur-3xl opacity-60"
                style={{ backgroundColor: '#F5B69E' }}
              />
            )}

            <div className="relative z-10">
              {/* Central Brand Emblem */}
              <div
                className="mx-auto h-20 w-20 rounded-3xl flex items-center justify-center shadow-xl mb-6 border-2 border-white/70"
                style={{
                  backgroundColor: isSkyPeach ? '#463F6E' : '#789575',
                  color: '#FFFFFF',
                }}
              >
                <Stethoscope className="h-10 w-10" />
              </div>

              <div
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold mb-5 shadow-xs border"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-soft)',
                  color: 'var(--brand-primary)',
                }}
              >
                <Sparkles className="h-3.5 w-3.5" style={{ color: isSkyPeach ? '#E08E70' : '#789575' }} />
                <span>
                  {isHi
                    ? 'डॉ. सेहत AI के साथ सरल, सुरक्षित स्वास्थ्य संवाद'
                    : 'AI-Powered Medical Communication Platform • Meet Dr. Sehat'}
                </span>
              </div>

              <h1
                className="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-3xl mx-auto leading-[1.14]"
                style={{ color: isSkyPeach ? '#24203F' : '#273A26' }}
              >
                {isHi
                  ? 'अपनी मेडिकल रिपोर्ट और पर्चे को सरल भाषा में समझें'
                  : 'Understand Your Medical Reports & Prescriptions in Simple Language'}
              </h1>

              <p
                className="mt-5 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed font-medium"
                style={{ color: isSkyPeach ? '#322E54' : '#3E533D' }}
              >
                {isHi
                  ? 'MedAi जटिल मेडिकल जानकारी को आसान हिन्दी और अंग्रेज़ी में समझाता है — वॉइस सहायता, रिपोर्ट तुलना, स्वास्थ्य अलर्ट और डॉ. सेहत चैटबॉट के साथ।'
                  : 'MedAi bridges the communication gap between patients and complex medical documents through clear AI explanations, Hindi & English voice support, health alerts, and Dr. Sehat.'}
              </p>

              {/* Primary Auth CTA Buttons */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
                <button
                  onClick={onOpenSignup}
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-sm sm:text-base shadow-md transition-opacity hover:opacity-95 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--brand-primary)',
                    color: 'var(--text-on-primary)',
                  }}
                >
                  <UserPlus className="h-4 w-4" />
                  <span>{isHi ? 'नया खाता बनाएं (Sign Up)' : 'Create Account (Sign Up)'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>

                <button
                  onClick={onOpenLogin}
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border-2 font-semibold text-sm sm:text-base transition-colors cursor-pointer bg-white/90 hover:bg-white"
                  style={{
                    borderColor: isSkyPeach ? '#F5B69E' : '#789575',
                    color: 'var(--brand-primary)',
                  }}
                >
                  <LogIn className="h-4 w-4" />
                  <span>{isHi ? 'लॉग इन करें (Login)' : 'Login to Your Account'}</span>
                </button>
              </div>

              {/* Optional Instant Demo shortcut */}
              <div className="mt-4">
                <button
                  onClick={onDemoLogin}
                  disabled={demoBusy}
                  className="text-xs sm:text-sm font-bold hover:underline cursor-pointer disabled:opacity-50"
                  style={{ color: 'var(--brand-primary)' }}
                >
                  {demoBusy
                    ? '...'
                    : isHi
                    ? 'या तुरंत डेमो मरीज़ के रूप में MedAi आज़माएं →'
                    : 'Or explore right away with Instant Demo Patient →'}
                </button>
              </div>
            </div>
          </div>

          {/* Safety Pill */}
          <div
            className="mt-6 max-w-4xl mx-auto rounded-2xl border px-4 py-3.5 flex items-start sm:items-center gap-3 text-left text-xs sm:text-sm shadow-xs"
            style={{
              backgroundColor: 'var(--brand-warm-soft)',
              borderColor: 'var(--brand-warm)',
              color: 'var(--text-ink)',
            }}
          >
            <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5 sm:mt-0" style={{ color: 'var(--brand-primary)' }} />
            <span>
              <strong>{isHi ? 'मेडिकल सुरक्षा नोट: ' : 'Medical Safety Note: '}</strong>
              {t.disclaimerBanner}
            </span>
          </div>
        </section>

        {/* Feature Overview Grid */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
          <div className="text-center mb-8">
            <h2 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-ink)' }}>
              {isHi ? 'MedAi आपकी कैसे मदद करता है' : 'Everything You Need to Understand Your Health'}
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {isHi
                ? 'सभी 13 मॉड्यूल एक सरल और सुरक्षित डैशबोर्ड में एकीकृत हैं'
                : 'All 13 patient communication modules unified in one calm, accessible platform'}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(({ icon: Icon, title, desc }, idx) => (
              <div
                key={title}
                className="med-card rounded-2xl border p-5 shadow-xs space-y-2.5"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-soft)',
                }}
              >
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center border"
                  style={{
                    backgroundColor:
                      isSkyPeach && idx % 2 === 1 ? '#FDECE5' : 'var(--bg-canvas)',
                    borderColor:
                      isSkyPeach && idx % 2 === 1 ? '#F5B69E' : 'var(--border-soft)',
                    color: 'var(--brand-primary)',
                  }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-sm sm:text-base" style={{ color: 'var(--text-ink)' }}>
                  {title}
                </h3>
                <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer
        className="border-t py-5 px-4"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-soft)',
        }}
      >
        <div
          className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4" style={{ color: 'var(--brand-accent)' }} />
            <span>MedAi — Private, patient-first medical information assistant</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={onOpenLogin} className="hover:underline font-semibold cursor-pointer">
              {isHi ? 'लॉग इन' : 'Login'}
            </button>
            <button onClick={onOpenSignup} className="hover:underline font-semibold cursor-pointer">
              {isHi ? 'साइन अप' : 'Sign Up'}
            </button>
            <span className="inline-flex items-center gap-1 font-semibold" style={{ color: 'var(--brand-primary)' }}>
              <BookOpen className="h-3.5 w-3.5" /> EN / हिन्दी
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
