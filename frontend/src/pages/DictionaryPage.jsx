import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  FileText,
  Loader2,
  Search,
  Square,
  Volume2,
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { api } from '../services/api';
import { isSpeechSynthesisSupported, speakText, stopSpeaking } from '../services/speech';

export default function DictionaryPage({ reports, onOpenReport }) {
  const { language } = useSettings();
  const isHi = language === 'hi';

  const [featured, setFeatured] = useState([]);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .featuredDictionaryTerms()
      .then((res) => setFeatured(res.terms || []))
      .catch(() => {});
    return () => stopSpeaking();
  }, []);

  const runSearch = async (termText) => {
    const q = (termText ?? query).trim();
    if (!q) return;
    setQuery(q);
    setError('');
    setLoading(true);
    try {
      const res = await api.searchDictionaryTerm(q);
      setResult(res);
    } catch (err) {
      setError(err.message || 'Lookup failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleListen = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    if (!result?.entry) return;
    const e = result.entry;
    const text = `${e.term}. ${isHi ? e.definition_hi : e.definition_en} ${
      isHi ? e.example_hi : e.example_en
    }`;
    setSpeaking(true);
    speakText(text, language, () => setSpeaking(false));
  };

  const openMatchingReport = (reportId) => {
    const rep = reports.find((r) => r.id === reportId);
    if (rep) onOpenReport(rep);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {isHi ? 'मेडिकल शब्दकोश (Medical Dictionary)' : 'Medical Dictionary'}
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          {isHi
            ? 'किसी भी मेडिकल शब्द, लैब टेस्ट या पर्चे के संक्षिप्त रूप को सरल हिन्दी और अंग्रेज़ी में समझें और अपनी रिपोर्ट से जोड़कर देखें।'
            : 'Search medical terms, lab tests, and prescription abbreviations for simple English & Hindi explanations linked to your reports.'}
        </p>
      </div>

      {/* Search Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(query);
        }}
        className="med-card bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-2.5 shadow-xs"
      >
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isHi
                ? 'शब्द खोजें (जैसे: HbA1c, Hemoglobin, TSH, Creatinine, BD, PC)...'
                : 'Search a medical term or abbreviation (e.g., HbA1c, Hemoglobin, TSH, BD)...'
            }
            className="w-full rounded-xl border border-slate-300 pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {isHi ? 'खोजें' : 'Search'}
        </button>
      </form>

      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

      {/* Active Lookup Result */}
      {result?.entry && (
        <section className="med-card bg-white rounded-2xl border-2 border-teal-200 p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800">
                {result.entry.category}
              </span>
              <h2 className="text-xl font-bold text-slate-900 mt-1.5">{result.entry.term}</h2>
            </div>
            {isSpeechSynthesisSupported() && (
              <button
                onClick={handleListen}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {speaking ? <Square className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                {speaking ? (isHi ? 'रोकें' : 'Stop') : isHi ? 'सुनें' : 'Listen'}
              </button>
            )}
          </div>

          <p className="text-sm text-slate-800 leading-relaxed">
            {isHi ? result.entry.definition_hi : result.entry.definition_en}
          </p>

          <div className="rounded-xl bg-teal-50/70 border border-teal-100 p-3.5 text-xs text-teal-950 leading-relaxed">
            <strong className="font-semibold">{isHi ? 'उदाहरण: ' : 'Example: '}</strong>
            {isHi ? result.entry.example_hi : result.entry.example_en}
          </div>

          {/* Connected Report Results */}
          {(result.related_report_tests || []).length > 0 && (
            <div className="pt-2 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-teal-700" />
                {isHi ? 'आपकी अपलोड की गई रिपोर्ट में यह टेस्ट' : 'Found in Your Uploaded Reports'}
              </h3>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {result.related_report_tests.map((m, idx) => (
                  <button
                    key={idx}
                    onClick={() => openMatchingReport(m.report_id)}
                    className="flex items-center justify-between gap-2 text-left rounded-xl border border-slate-200 hover:border-teal-400 bg-slate-50/70 hover:bg-teal-50/40 p-3 transition-colors cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        {m.test_name}: <span className="text-teal-800">{m.result}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {m.report_title} • {m.status} (Ref: {m.normal_range})
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-teal-700 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Featured Common Terms Grid */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-teal-700" />
          {isHi ? 'प्रमुख मेडिकल शब्द और संक्षिप्त रूप' : 'Common Lab Terms & Abbreviations'}
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {featured.map((item) => (
            <button
              key={item.term}
              onClick={() => runSearch(item.term)}
              className="med-card text-left bg-white rounded-2xl border border-slate-200 hover:border-teal-400 p-4 space-y-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">
                {item.category}
              </span>
              <div className="font-bold text-sm text-slate-900">{item.term}</div>
              <p className="text-xs text-slate-600 line-clamp-2">
                {isHi ? item.definition_hi : item.definition_en}
              </p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

