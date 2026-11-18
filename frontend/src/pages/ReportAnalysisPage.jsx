import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  Download,
  FileUp,
  Info,
  Loader2,
  MessageCircleHeart,
  ShieldAlert,
  Sparkles,
  Square,
  Stethoscope,
  Volume2,
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { api } from '../services/api';
import { isSpeechSynthesisSupported, speakText, stopSpeaking } from '../services/speech';

function StatusBadge({ status }) {
  const s = (status || 'Unknown').toLowerCase();
  if (s === 'normal') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
        <CheckCircle2 className="h-3 w-3" />
        Normal
      </span>
    );
  }
  if (s === 'high') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
        High
      </span>
    );
  }
  if (s === 'low') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
        Low
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
      {status || 'Unknown'}
    </span>
  );
}

export default function ReportAnalysisPage({
  selectedReport,
  onReportSelected,
  onRefreshData,
  onAskDrSehat,
}) {
  const { language, t } = useSettings();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const res = await api.analyzeReport(file);
      onReportSelected(res.report);
      await onRefreshData();
    } catch (err) {
      setError(err.message || 'Could not analyze the uploaded file.');
    } finally {
      setUploading(false);
    }
  };

  const handleSample = async (variant) => {
    setError('');
    setUploading(true);
    try {
      const res = await api.createSampleReport(variant);
      onReportSelected(res.report);
      await onRefreshData();
    } catch (err) {
      setError(err.message || 'Could not load sample report.');
    } finally {
      setUploading(false);
    }
  };

  const analysis = selectedReport?.analysis || null;
  const isHi = language === 'hi';

  const summaryText = analysis ? (isHi ? analysis.summary_hi : analysis.summary_en) : '';
  const normalHighlights = analysis
    ? isHi
      ? analysis.normal_highlights_hi || []
      : analysis.normal_highlights_en || []
    : [];
  const attentionPoints = analysis
    ? isHi
      ? analysis.attention_points_hi || []
      : analysis.attention_points_en || []
    : [];
  const doctorPoints = analysis
    ? isHi
      ? analysis.doctor_discussion_points_hi || []
      : analysis.doctor_discussion_points_en || []
    : [];
  const alerts = analysis?.alerts || [];
  const tests = analysis?.tests || [];
  const terms = analysis?.simplified_terms || [];

  const handleListen = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const spokenParts = [
      selectedReport?.title || '',
      summaryText,
      attentionPoints.length
        ? `${t.reports.attentionPoints}: ${attentionPoints.join('. ')}`
        : '',
      doctorPoints.length
        ? `${t.reports.doctorPoints}: ${doctorPoints.join('. ')}`
        : '',
    ]
      .filter(Boolean)
      .join('. ');

    setSpeaking(true);
    speakText(spokenParts, language, () => setSpeaking(false));
  };

  const handleDownload = () => {
    if (!selectedReport || !analysis) return;
    const lines = [
      `MEDAI SIMPLIFIED MEDICAL REPORT SUMMARY`,
      `Report: ${selectedReport.title}`,
      `Date: ${selectedReport.report_date || new Date(selectedReport.created_at).toLocaleDateString()}`,
      `Lab: ${selectedReport.lab_name || 'N/A'}`,
      ``,
      `--- SUMMARY ---`,
      summaryText,
      ``,
      `--- STRUCTURED TEST RESULTS ---`,
      ...tests.map(
        (row) =>
          `- ${row.test_name}: ${row.result} ${row.unit || ''} (Normal: ${row.normal_range}) [${row.status}]`
      ),
      ``,
      `--- VALUES NEEDING ATTENTION ---`,
      ...(attentionPoints.length ? attentionPoints.map((p) => `* ${p}`) : ['None']),
      ``,
      `--- POINTS TO DISCUSS WITH YOUR DOCTOR ---`,
      ...doctorPoints.map((p) => `* ${p}`),
      ``,
      `DISCLAIMER: ${isHi ? analysis.disclaimer_hi : analysis.disclaimer_en}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(selectedReport.title || 'medai-report').replace(/[^a-z0-9-_]+/gi, '_')}_summary.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t.reports.title}</h1>
        <p className="text-sm text-slate-600 mt-1">{t.reports.subtitle}</p>
      </div>

      {/* Upload Dropzone Card */}
      <section className="med-card bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`rounded-2xl border-2 border-dashed p-7 text-center transition-colors cursor-pointer ${
            dragActive
              ? 'border-teal-500 bg-teal-50/70'
              : 'border-slate-300 hover:border-teal-400 bg-slate-50/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = '';
            }}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <Loader2 className="h-9 w-9 text-teal-700 animate-spin" />
              <p className="text-sm font-semibold text-teal-900">{t.reports.analyzing}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="h-12 w-12 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center">
                <FileUp className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-900">{t.reports.dropzoneTitle}</p>
              <p className="text-xs text-slate-500">{t.reports.dropzoneSub}</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => handleSample('standard')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-900 text-xs font-semibold cursor-pointer disabled:opacity-60"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {t.reports.sampleStandard}
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={() => handleSample('urgent_demo')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-semibold cursor-pointer disabled:opacity-60"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {t.reports.sampleUrgent}
            </button>
          </div>
          {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
        </div>
      </section>

      {/* Active Report Analysis */}
      {selectedReport && analysis && (
        <div className="space-y-6">
          {selectedReport.is_demo && (
            <div className="flex items-center gap-2.5 rounded-xl bg-sky-50 border border-sky-200 px-4 py-3 text-xs text-sky-900">
              <Info className="h-4 w-4 text-sky-700 shrink-0" />
              <span>{t.reports.demoNotice}</span>
            </div>
          )}

          {/* Header Actions */}
          <div className="med-card bg-white rounded-2xl border border-slate-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{selectedReport.title}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedReport.lab_name ? `${selectedReport.lab_name} • ` : ''}
                {selectedReport.report_date || new Date(selectedReport.created_at).toLocaleDateString()} •{' '}
                {selectedReport.file_name}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {isSpeechSynthesisSupported() && (
                <button
                  onClick={handleListen}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
                    speaking
                      ? 'bg-rose-50 border-rose-300 text-rose-800'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {speaking ? <Square className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                  {speaking ? t.reports.stopListening : t.reports.listen}
                </button>
              )}
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                {t.reports.download}
              </button>
              <button
                onClick={() => onAskDrSehat(selectedReport.id)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white cursor-pointer"
              >
                <MessageCircleHeart className="h-3.5 w-3.5" />
                {t.reports.askAboutReport}
              </button>
            </div>
          </div>

          {/* Module 13: Important Health Alerts */}
          <section className="med-card bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-teal-700" />
              <h3 className="text-base font-bold text-slate-900">{t.reports.alertsTitle}</h3>
            </div>
            {alerts.length === 0 ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                <span>{t.reports.noAlerts}</span>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map((al, idx) => {
                  const urgent = al.severity === 'urgent';
                  return (
                    <div
                      key={`${al.test_name}-${idx}`}
                      className={`rounded-xl border p-4 ${
                        urgent
                          ? 'bg-rose-50 border-rose-300 text-rose-950'
                          : 'bg-amber-50 border-amber-200 text-amber-950'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-bold text-sm flex items-center gap-2">
                          <AlertTriangle
                            className={`h-4 w-4 shrink-0 ${
                              urgent ? 'text-rose-700' : 'text-amber-700'
                            }`}
                          />
                          <span>{isHi ? al.title_hi : al.title_en}</span>
                        </div>
                        <span
                          className={`text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                            urgent
                              ? 'bg-rose-700 text-white'
                              : 'bg-amber-200 text-amber-900'
                          }`}
                        >
                          {urgent ? t.reports.urgentBadge : t.reports.attentionBadge}
                        </span>
                      </div>
                      <p className="text-xs mt-1.5 opacity-90 leading-relaxed">
                        {isHi ? al.message_hi : al.message_en}
                      </p>
                      <p className="text-[11px] mt-2 font-medium opacity-75">
                        {t.reports.colResult}: {al.value} • {t.reports.colRange}: {al.normal_range}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Module 2: Structured Results Table */}
          <section className="med-card bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">{t.reports.tableTitle}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">{t.reports.colTest}</th>
                    <th className="py-3 px-4">{t.reports.colResult}</th>
                    <th className="py-3 px-4">{t.reports.colRange}</th>
                    <th className="py-3 px-4">{t.reports.colStatus}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {tests.map((row, idx) => (
                    <tr
                      key={`${row.test_name}-${idx}`}
                      className={
                        row.alert_severity === 'urgent'
                          ? 'bg-rose-50/60'
                          : row.status === 'High' || row.status === 'Low'
                          ? 'bg-amber-50/30'
                          : ''
                      }
                    >
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-semibold text-slate-900">{row.test_name}</div>
                        <p className="text-xs text-slate-600 mt-1 max-w-md leading-relaxed">
                          {isHi ? row.explanation_hi : row.explanation_en}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 align-top font-semibold text-slate-900 whitespace-nowrap">
                        {row.result} {row.unit}
                      </td>
                      <td className="py-3.5 px-4 align-top text-slate-600 whitespace-nowrap">
                        {row.normal_range}
                      </td>
                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Module 3: Simplified Medical Report */}
          <section className="med-card bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-2">
              <BookOpenCheck className="h-5 w-5 text-teal-700" />
              <h3 className="text-base font-bold text-slate-900">{t.reports.simplifiedTitle}</h3>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed bg-teal-50/60 border border-teal-100 rounded-xl p-4">
              {summaryText}
            </p>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  {t.reports.normalHighlights}
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-700 list-disc pl-4">
                  {normalHighlights.length ? (
                    normalHighlights.map((item, i) => <li key={i}>{item}</li>)
                  ) : (
                    <li>—</li>
                  )}
                </ul>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800">
                  {t.reports.attentionPoints}
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-700 list-disc pl-4">
                  {attentionPoints.length ? (
                    attentionPoints.map((item, i) => <li key={i}>{item}</li>)
                  ) : (
                    <li>{isHi ? 'कोई असामान्य मान नहीं।' : 'No out-of-range values.'}</li>
                  )}
                </ul>
              </div>

              <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-sky-900 flex items-center gap-1">
                  <Stethoscope className="h-3.5 w-3.5" />
                  {t.reports.doctorPoints}
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-700 list-disc pl-4">
                  {doctorPoints.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            {terms.length > 0 && (
              <div className="pt-2 space-y-3">
                <h4 className="text-sm font-bold text-slate-900">{t.reports.termsTitle}</h4>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {terms.map((item, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5"
                    >
                      <div className="text-xs font-bold text-teal-800">{item.term}</div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {isHi ? item.simple_hi : item.simple_en}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

