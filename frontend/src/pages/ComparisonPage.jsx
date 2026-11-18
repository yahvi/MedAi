import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  GitCompare,
  HelpCircle,
  Loader2,
  MinusCircle,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { api } from '../services/api';

function IndicatorBadge({ code, label }) {
  if (code === 'improved') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
        <TrendingUp className="h-3.5 w-3.5" />
        {label}
      </span>
    );
  }
  if (code === 'needs_attention') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900">
        <AlertTriangle className="h-3.5 w-3.5" />
        {label}
      </span>
    );
  }
  if (code === 'stable') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-800">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
      <HelpCircle className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

export default function ComparisonPage({ reports, comparisons, onRefreshData }) {
  const { language } = useSettings();
  const isHi = language === 'hi';
  const [prevId, setPrevId] = useState(reports?.[1]?.id || '');
  const [latestId, setLatestId] = useState(reports?.[0]?.id || '');
  const [activeComparison, setActiveComparison] = useState(comparisons?.[0] || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!latestId && reports?.[0]?.id) setLatestId(reports[0].id);
    if (!prevId && reports?.[1]?.id) setPrevId(reports[1].id);
  }, [reports, latestId, prevId]);

  const handleCompare = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await api.compareReports(prevId, latestId);
      setActiveComparison(res.comparison);
      await onRefreshData();
    } catch (err) {
      setError(err.message || 'Could not compare reports.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoPair = async () => {
    setError('');
    setLoading(true);
    try {
      let currentReports = [...reports];
      if (currentReports.length === 0) {
        const latestRes = await api.createSampleReport('standard');
        currentReports.unshift(latestRes.report);
      }
      const baseRes = await api.createSampleBaselineReport();
      const earlier = baseRes.report;
      const latest = currentReports[0];

      setPrevId(earlier.id);
      setLatestId(latest.id);
      const compRes = await api.compareReports(earlier.id, latest.id);
      setActiveComparison(compRes.comparison);
      await onRefreshData();
    } catch (err) {
      setError(err.message || 'Could not create sample comparison.');
    } finally {
      setLoading(false);
    }
  };

  const comp = activeComparison?.comparison || null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {isHi ? 'मेडिकल रिपोर्ट तुलना और स्वास्थ्य प्रगति' : 'Medical Report Comparison & Health Progress'}
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          {isHi
            ? 'दो अलग-अलग तारीखों की रिपोर्ट की तुलना करें और संदर्भ सीमा के सापेक्ष अपने बदलाव स्पष्ट रूप से समझें।'
            : 'Select two uploaded reports to compare matching tests relative to their reference ranges and clinical context.'}
        </p>
      </div>

      {/* Selector Card */}
      <section className="med-card bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {isHi ? 'पिछली रिपोर्ट (Previous Report)' : 'Previous Report (Earlier)'}
            </label>
            <select
              value={prevId}
              onChange={(e) => setPrevId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">{isHi ? '-- रिपोर्ट चुनें --' : '-- Select earlier report --'}</option>
              {reports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title} ({r.report_date || new Date(r.created_at).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {isHi ? 'नवीनतम रिपोर्ट (Latest Report)' : 'Latest Report (Recent)'}
            </label>
            <select
              value={latestId}
              onChange={(e) => setLatestId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">{isHi ? '-- रिपोर्ट चुनें --' : '-- Select latest report --'}</option>
              {reports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title} ({r.report_date || new Date(r.created_at).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleCompare}
            disabled={loading || !prevId || !latestId}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCompare className="h-4 w-4" />}
            {isHi ? 'रिपोर्ट तुलना करें' : 'Compare Reports'}
          </button>

          <button
            type="button"
            onClick={handleQuickDemoPair}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-900 text-xs font-semibold cursor-pointer disabled:opacity-60"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {isHi ? 'डेमो बेसलाइन रिपोर्ट बनाएं और तुलना देखें' : 'Load Baseline Demo & Compare'}
          </button>

          {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
        </div>
      </section>

      {/* Active Comparison Results */}
      {activeComparison && comp && (
        <div className="space-y-5">
          {/* Progress Summary */}
          <section className="med-card bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900">
                {activeComparison.previous_title} → {activeComparison.latest_title}
              </h2>
            </div>

            <p className="text-sm text-slate-700 bg-teal-50/70 border border-teal-100 rounded-xl p-4 leading-relaxed">
              {isHi ? comp.summary_hi : comp.summary_en}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center">
                <div className="text-2xl font-bold text-emerald-800">{comp.counts?.improved || 0}</div>
                <div className="text-[11px] font-semibold text-emerald-700 mt-0.5">
                  {isHi ? 'सीमा के सापेक्ष सुधार' : 'Improved'}
                </div>
              </div>
              <div className="rounded-xl bg-sky-50 border border-sky-200 p-3 text-center">
                <div className="text-2xl font-bold text-sky-800">{comp.counts?.stable || 0}</div>
                <div className="text-[11px] font-semibold text-sky-700 mt-0.5">
                  {isHi ? 'स्थिर (सामान्य)' : 'Stable'}
                </div>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center">
                <div className="text-2xl font-bold text-amber-800">{comp.counts?.needs_attention || 0}</div>
                <div className="text-[11px] font-semibold text-amber-700 mt-0.5">
                  {isHi ? 'ध्यान देने योग्य' : 'Needs Attention'}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                <div className="text-2xl font-bold text-slate-700">{comp.counts?.insufficient || 0}</div>
                <div className="text-[11px] font-semibold text-slate-600 mt-0.5">
                  {isHi ? 'पर्याप्त डेटा नहीं' : 'Insufficient Data'}
                </div>
              </div>
            </div>
          </section>

          {/* Structured Output Table: Test | Previous Report | Latest Report | Change */}
          <section className="med-card bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">{isHi ? 'टेस्ट' : 'Test'}</th>
                    <th className="py-3 px-4">{isHi ? 'पिछली रिपोर्ट' : 'Previous Report'}</th>
                    <th className="py-3 px-4">{isHi ? 'नवीनतम रिपोर्ट' : 'Latest Report'}</th>
                    <th className="py-3 px-4">{isHi ? 'बदलाव व व्याख्या' : 'Change'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {(comp.rows || []).map((row, idx) => (
                    <tr key={idx}>
                      <td className="py-3.5 px-4 align-top font-semibold text-slate-900">
                        <div>{row.test_name}</div>
                        <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                          Ref: {row.latest_range || row.previous_range}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 align-top text-slate-700 whitespace-nowrap">
                        {row.previous_value}
                      </td>
                      <td className="py-3.5 px-4 align-top font-semibold text-slate-900 whitespace-nowrap">
                        {row.latest_value}
                      </td>
                      <td className="py-3.5 px-4 align-top space-y-1.5">
                        <IndicatorBadge code={row.indicator_code} label={row.indicator} />
                        <p className="text-xs text-slate-600 leading-relaxed max-w-md">
                          {isHi ? row.explanation_hi : row.explanation_en}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

