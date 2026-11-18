import React, { useState } from 'react';
import { Calendar, FileText, MessageCircleHeart, Pill, Trash2 } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { api } from '../services/api';

export default function HistoryPage({
  reports,
  sessions,
  prescriptions = [],
  onOpenReport,
  onOpenSession,
  onNavigate,
  onRefreshData,
}) {
  const { language, t } = useSettings();
  const isHi = language === 'hi';
  const [tab, setTab] = useState('reports');
  const [busyId, setBusyId] = useState(null);

  const handleDelete = async (type, id) => {
    if (!window.confirm(t.history.confirmDelete)) return;
    setBusyId(id);
    try {
      if (type === 'report') await api.deleteReport(id);
      if (type === 'chat') await api.deleteChatSession(id);
      if (type === 'rx') await api.deletePrescription(id);
      await onRefreshData();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t.history.title}</h1>
        <p className="text-sm text-slate-600 mt-1">{t.history.subtitle}</p>
      </div>

      <div className="inline-flex flex-wrap rounded-xl bg-white border border-slate-200 p-1 gap-1">
        <button
          onClick={() => setTab('reports')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
            tab === 'reports' ? 'bg-teal-700 text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t.history.reportsTab} ({reports.length})
        </button>
        <button
          onClick={() => setTab('prescriptions')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
            tab === 'prescriptions' ? 'bg-teal-700 text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t.nav.prescriptions} ({prescriptions.length})
        </button>
        <button
          onClick={() => setTab('chats')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
            tab === 'chats' ? 'bg-teal-700 text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t.history.chatsTab} ({sessions.length})
        </button>
      </div>

      {tab === 'reports' && (
        <div className="space-y-3">
          {reports.length === 0 ? (
            <div className="med-card bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
              {t.history.emptyReports}
            </div>
          ) : (
            reports.map((rep) => (
              <div
                key={rep.id}
                className="med-card bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-slate-900 truncate">{rep.title}</div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {rep.report_date || new Date(rep.created_at).toLocaleDateString()}
                      </span>
                      <span>•</span>
                      <span>{rep.file_name}</span>
                      {rep.urgent_count > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-semibold">
                          {rep.urgent_count} Urgent
                        </span>
                      )}
                      {rep.attention_count > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
                          {rep.attention_count} Attention
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onOpenReport(rep)}
                    className="px-3.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-900 text-xs font-semibold cursor-pointer"
                  >
                    {t.history.open}
                  </button>
                  <button
                    onClick={() => handleDelete('report', rep.id)}
                    disabled={busyId === rep.id}
                    className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 cursor-pointer disabled:opacity-50"
                    title={t.history.delete}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'prescriptions' && (
        <div className="space-y-3">
          {prescriptions.length === 0 ? (
            <div className="med-card bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
              {isHi ? 'अभी कोई पर्चा सहेजा नहीं गया है।' : 'No saved prescriptions yet.'}
            </div>
          ) : (
            prescriptions.map((rx) => (
              <div
                key={rx.id}
                className="med-card bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    <Pill className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-slate-900 truncate">{rx.title}</div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-2">
                      <span>{new Date(rx.created_at).toLocaleDateString()}</span>
                      {rx.uncertain_count > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-semibold">
                          {rx.uncertain_count} Unclear
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onNavigate?.('prescriptions')}
                    className="px-3.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-900 text-xs font-semibold cursor-pointer"
                  >
                    {t.history.open}
                  </button>
                  <button
                    onClick={() => handleDelete('rx', rx.id)}
                    disabled={busyId === rx.id}
                    className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-700 cursor-pointer disabled:opacity-50"
                    title={t.history.delete}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'chats' && (
        <div className="space-y-3">
          {sessions.length === 0 ? (
            <div className="med-card bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
              {t.history.emptyChats}
            </div>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                className="med-card bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
                    <MessageCircleHeart className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-slate-900 truncate">{s.title}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {new Date(s.updated_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onOpenSession(s.id)}
                    className="px-3.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-900 text-xs font-semibold cursor-pointer"
                  >
                    {t.history.open}
                  </button>
                  <button
                    onClick={() => handleDelete('chat', s.id)}
                    disabled={busyId === s.id}
                    className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 cursor-pointer disabled:opacity-50"
                    title={t.history.delete}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
