import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  Info,
  Loader2,
  Pill,
  ShieldAlert,
  Sparkles,
  Square,
  Trash2,
  Volume2,
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { api } from '../services/api';
import { isSpeechSynthesisSupported, speakText, stopSpeaking } from '../services/speech';

export default function PrescriptionsPage({ prescriptions, onRefreshData }) {
  const { language } = useSettings();
  const isHi = language === 'hi';
  const [selected, setSelected] = useState(prescriptions?.[0] || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!selected && prescriptions?.length > 0) {
      setSelected(prescriptions[0]);
    }
  }, [prescriptions, selected]);

  useEffect(() => () => stopSpeaking(), []);

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const res = await api.analyzePrescription(file);
      setSelected(res.prescription);
      await onRefreshData();
    } catch (err) {
      setError(err.message || 'Could not process prescription.');
    } finally {
      setUploading(false);
    }
  };

  const handleSample = async () => {
    setError('');
    setUploading(true);
    try {
      const res = await api.createSamplePrescription();
      setSelected(res.prescription);
      await onRefreshData();
    } catch (err) {
      setError(err.message || 'Could not load sample prescription.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(isHi ? 'क्या इस पर्चे को हटाएं?' : 'Delete this prescription record?')) return;
    await api.deletePrescription(id);
    if (selected?.id === id) setSelected(null);
    await onRefreshData();
  };

  const analysis = selected?.analysis || null;

  const handleListen = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    if (!analysis) return;
    const parts = (analysis.medicines || []).map(
      (m) => `${m.medicine_name}. ${isHi ? m.instructions_hi : m.instructions_en}`
    );
    setSpeaking(true);
    speakText(parts.join(' '), language, () => setSpeaking(false));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {isHi ? 'पर्चा व्याख्या (Prescription Explainer)' : 'Prescription Explainer'}
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          {isHi
            ? 'पर्चे की फ़ोटो या PDF अपलोड करें। स्पष्ट दवाइयों और संक्षिप्त शब्दों को सरल भाषा में समझें — अस्पष्ट लिखावट का अनुमान कभी नहीं लगाया जाता।'
            : 'Upload a prescription photo or PDF to decode medical abbreviations and clearly legible instructions. Unclear handwriting is highlighted for doctor/pharmacist confirmation — never guessed.'}
        </p>
      </div>

      {/* Upload Box */}
      <section className="med-card bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4 shadow-xs">
        <div
          onClick={() => !uploading && fileRef.current?.click()}
          className="rounded-2xl border-2 border-dashed border-slate-300 hover:border-teal-400 bg-slate-50/60 p-7 text-center cursor-pointer transition-colors"
        >
          <input
            ref={fileRef}
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = '';
            }}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <Loader2 className="h-8 w-8 text-teal-700 animate-spin" />
              <p className="text-sm font-semibold text-teal-900">
                {isHi ? 'पर्चा पढ़ा जा रहा है...' : 'Reading prescription carefully...'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="h-12 w-12 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center">
                <FileUp className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-900">
                {isHi ? 'पर्चे की फ़ोटो (JPG/PNG) या PDF चुनें' : 'Click to upload a prescription image (JPG/PNG) or PDF'}
              </p>
              <p className="text-xs text-slate-500">
                {isHi ? 'साफ़ और अच्छी रोशनी में ली गई फ़ोटो सबसे अच्छा परिणाम देती है' : 'Clear, well-lit photos give the most accurate legibility check'}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={uploading}
            onClick={handleSample}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-900 text-xs font-semibold cursor-pointer disabled:opacity-60"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {isHi ? 'नमूना पर्चा आज़माएं (स्पष्ट + अस्पष्ट उदाहरण)' : 'Try Sample Prescription (Clear + Unclear Demo)'}
          </button>
          {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
        </div>
      </section>

      {/* Saved Prescription Picker */}
      {prescriptions?.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {prescriptions.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                selected?.id === p.id
                  ? 'bg-teal-700 text-white border-teal-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {p.title}
            </button>
          ))}
        </div>
      )}

      {/* Analysis Display */}
      {selected && analysis && (
        <div className="space-y-5">
          {/* Header */}
          <div className="med-card bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <Pill className="h-5 w-5 text-teal-700" />
                <h2 className="text-lg font-bold text-slate-900">{selected.title}</h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {analysis.doctor_or_clinic ? `${analysis.doctor_or_clinic} • ` : ''}
                {analysis.prescription_date || new Date(selected.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isSpeechSynthesisSupported() && (
                <button
                  onClick={handleListen}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {speaking ? <Square className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                  {speaking ? (isHi ? 'रोकें' : 'Stop') : isHi ? 'सुनें' : 'Listen Aloud'}
                </button>
              )}
              <button
                onClick={() => handleDelete(selected.id)}
                className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Unclear Handwriting Safety Warning */}
          {selected.uncertain_count > 0 && (
            <div className="rounded-2xl bg-rose-50 border-2 border-rose-300 p-4 flex items-start gap-3 text-rose-950">
              <AlertTriangle className="h-5 w-5 text-rose-700 shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-bold">
                  {isHi
                    ? `${selected.uncertain_count} अस्पष्ट प्रविष्टि मिली — कृपया अनुमान न लगाएं`
                    : `${selected.uncertain_count} Uncertain / Unclear Entry Detected — Do Not Guess`}
                </div>
                <p className="text-xs mt-1 leading-relaxed">
                  {isHi
                    ? 'अस्पष्ट लिखावट या अनिश्चित दवाई के नाम नीचे लाल रंग में चिह्नित किए गए हैं। कोई भी दवाई लेने से पहले कृपया मूल पर्चा अपने डॉक्टर या फार्मासिस्ट से सत्यापित करवाएं।'
                    : 'Items with unclear handwriting or uncertain medicine names are highlighted in red below. Please confirm them directly with your prescribing doctor or pharmacist before taking any medication.'}
                </p>
              </div>
            </div>
          )}

          {/* Medicines List */}
          <section className="space-y-3">
            {(analysis.medicines || []).map((med, i) => {
              const uncertain = med.legibility_status !== 'clear';
              return (
                <div
                  key={i}
                  className={`med-card rounded-2xl border p-5 space-y-2.5 shadow-xs ${
                    uncertain
                      ? 'bg-rose-50/70 border-rose-300'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-base text-slate-900">{med.medicine_name}</h3>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {med.dosage_and_form}
                        {med.frequency_raw ? ` • Written: "${med.frequency_raw}"` : ''}
                      </p>
                    </div>
                    {uncertain ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-700 text-white text-xs font-bold">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {isHi ? 'पुष्टि आवश्यक (अस्पष्ट)' : 'Unclear — Confirm With Doctor/Pharmacist'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {isHi ? 'स्पष्ट रूप से पढ़ा गया' : 'Clearly Legible'}
                      </span>
                    )}
                  </div>

                  {uncertain && (med.uncertainty_reason_en || med.uncertainty_reason_hi) && (
                    <div className="text-xs font-semibold text-rose-800 bg-white/80 border border-rose-200 rounded-xl px-3 py-2">
                      {isHi ? med.uncertainty_reason_hi : med.uncertainty_reason_en}
                    </div>
                  )}

                  <p className="text-sm text-slate-800 leading-relaxed">
                    {isHi ? med.instructions_hi : med.instructions_en}
                  </p>
                  <p className="text-xs text-slate-600 flex items-start gap-1.5">
                    <Info className="h-3.5 w-3.5 text-teal-700 shrink-0 mt-0.5" />
                    <span>{isHi ? med.purpose_note_hi : med.purpose_note_en}</span>
                  </p>
                </div>
              );
            })}
          </section>

          {/* Abbreviations Decoded */}
          {(analysis.abbreviations_explained || []).length > 0 && (
            <section className="med-card bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-xs">
              <h3 className="text-base font-bold text-slate-900">
                {isHi ? 'पर्चे के मेडिकल संक्षिप्त शब्दों का अर्थ' : 'Prescription Abbreviations Explained'}
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {analysis.abbreviations_explained.map((ab, idx) => (
                  <div key={idx} className="rounded-xl bg-teal-50/60 border border-teal-200/80 p-3">
                    <div className="text-sm font-bold text-teal-900">{ab.code}</div>
                    <p className="text-xs text-slate-700 mt-1">
                      {isHi ? ab.meaning_hi : ab.meaning_en}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* General & Safety Notes */}
          <section className="grid md:grid-cols-2 gap-4">
            <div className="med-card bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
              <h3 className="text-sm font-bold text-slate-900">
                {isHi ? 'अन्य लिखित निर्देश' : 'Other Written Instructions'}
              </h3>
              <ul className="list-disc pl-4 space-y-1.5 text-xs text-slate-700">
                {(isHi ? analysis.general_instructions_hi : analysis.general_instructions_en || []).map(
                  (item, i) => (
                    <li key={i}>{item}</li>
                  )
                )}
              </ul>
            </div>

            <div className="med-card bg-amber-50/70 rounded-2xl border border-amber-200 p-5 space-y-2">
              <h3 className="text-sm font-bold text-amber-950 flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-amber-700" />
                {isHi ? 'महत्वपूर्ण सुरक्षा निर्देश' : 'Safety Reminders'}
              </h3>
              <ul className="list-disc pl-4 space-y-1.5 text-xs text-amber-900">
                {(isHi ? analysis.safety_reminders_hi : analysis.safety_reminders_en || []).map(
                  (item, i) => (
                    <li key={i}>{item}</li>
                  )
                )}
              </ul>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

