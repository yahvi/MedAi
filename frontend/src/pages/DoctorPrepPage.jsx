import React, { useEffect, useState } from 'react';
import {
  BookmarkPlus,
  Building2,
  CheckSquare,
  ClipboardList,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  LocateFixed,
  MapPin,
  Phone,
  Plus,
  Search,
  Sparkles,
  Stethoscope,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { api } from '../services/api';

const SPECIALTY_OPTIONS = [
  { value: 'all', labelEn: 'All Hospitals, Clinics & Doctors', labelHi: 'सभी अस्पताल, क्लिनिक और डॉक्टर' },
  { value: 'hospital', labelEn: 'Multi-Specialty Hospitals', labelHi: 'मल्टी-स्पेशलिटी अस्पताल' },
  { value: 'general', labelEn: 'General Physician / Internal Medicine', labelHi: 'जनरल फिजिशियन / इंटरनल मेडिसिन' },
  { value: 'cardiology', labelEn: 'Cardiologist (Heart)', labelHi: 'कार्डियोलॉजिस्ट (हृदय रोग)' },
  { value: 'endocrinology', labelEn: 'Endocrinologist (Diabetes / Thyroid)', labelHi: 'एंडोक्राइनोलॉजिस्ट (शुगर / थायरॉइड)' },
  { value: 'gynaecology', labelEn: 'Gynaecologist', labelHi: 'स्त्री रोग विशेषज्ञ' },
  { value: 'paediatrics', labelEn: 'Paediatrician (Child)', labelHi: 'बाल रोग विशेषज्ञ' },
  { value: 'orthopaedics', labelEn: 'Orthopaedics (Bones & Joints)', labelHi: 'हड्डी व जोड़ विशेषज्ञ' },
];

export default function DoctorPrepPage({ reports, doctorPreps, onRefreshData }) {
  const { language } = useSettings();
  const isHi = language === 'hi';

  // Visit Prep State
  const [reportId, setReportId] = useState(reports?.[0]?.id || '');
  const [visitGoal, setVisitGoal] = useState('');
  const [concernInput, setConcernInput] = useState('');
  const [concerns, setConcerns] = useState([]);
  const [activePrep, setActivePrep] = useState(doctorPreps?.[0] || null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  // Nearby Hospitals & Doctors State
  const [cityQuery, setCityQuery] = useState('');
  const [specialty, setSpecialty] = useState('all');
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState('');
  const [nearbyData, setNearbyData] = useState(null);
  const [savingPlaceId, setSavingPlaceId] = useState(null);

  // Saved Doctors Contact Book State
  const [savedDoctors, setSavedDoctors] = useState([]);
  const [showAddDoctor, setShowAddDoctor] = useState(false);
  const [docForm, setDocForm] = useState({
    doctor_name: '',
    specialty: 'General Physician',
    hospital_name: '',
    phone: '',
    address: '',
    notes: '',
  });
  const [savingDoc, setSavingDoc] = useState(false);

  useEffect(() => {
    if (!activePrep && doctorPreps?.length > 0) {
      setActivePrep(doctorPreps[0]);
    }
  }, [doctorPreps, activePrep]);

  useEffect(() => {
    if (!reportId && reports?.[0]?.id) {
      setReportId(reports[0].id);
    }
  }, [reports, reportId]);

  const loadSavedDoctors = async () => {
    try {
      const res = await api.listSavedDoctors();
      setSavedDoctors(res.doctors || []);
    } catch {
      // Ignore quietly
    }
  };

  useEffect(() => {
    loadSavedDoctors();
  }, []);

  const addConcern = () => {
    const c = concernInput.trim();
    if (!c) return;
    setConcerns((prev) => [...prev, c]);
    setConcernInput('');
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const allConcerns = concernInput.trim() ? [...concerns, concernInput.trim()] : concerns;
      const res = await api.generateDoctorPrep({
        report_id: reportId || null,
        visit_goal: visitGoal,
        concerns: allConcerns,
      });
      setActivePrep(res.doctor_prep);
      if (concernInput.trim()) {
        setConcerns(allConcerns);
        setConcernInput('');
      }
      await onRefreshData();
    } catch (err) {
      setError(err.message || 'Could not generate visit preparation.');
    } finally {
      setLoading(false);
    }
  };

  // Nearby search by city/pincode
  const handleNearbySearch = async (e) => {
    e?.preventDefault();
    if (!cityQuery.trim()) {
      setNearbyError(isHi ? 'कृपया शहर, क्षेत्र या पिनकोड दर्ज करें।' : 'Please enter a city, area, or pincode.');
      return;
    }
    setNearbyError('');
    setNearbyLoading(true);
    try {
      const res = await api.findNearbyHealthcare({
        city: cityQuery.trim(),
        specialty,
        radius_km: 8,
      });
      setNearbyData(res);
    } catch (err) {
      setNearbyError(err.message || 'Could not search nearby hospitals.');
    } finally {
      setNearbyLoading(false);
    }
  };

  // Nearby search using browser GPS
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setNearbyError(
        isHi
          ? 'आपके ब्राउज़र में GPS लोकेशन उपलब्ध नहीं है। कृपया शहर का नाम लिखें।'
          : 'Geolocation is not supported in your browser. Please type your city or pincode.'
      );
      return;
    }
    setNearbyError('');
    setNearbyLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await api.findNearbyHealthcare({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            specialty,
            radius_km: 8,
          });
          setNearbyData(res);
        } catch (err) {
          setNearbyError(err.message || 'Could not fetch nearby hospitals.');
        } finally {
          setNearbyLoading(false);
        }
      },
      () => {
        setNearbyLoading(false);
        setNearbyError(
          isHi
            ? 'लोकेशन अनुमति नहीं मिली। कृपया अपना शहर या पिनकोड लिखकर खोजें।'
            : 'Location permission was declined. Please type your city or pincode to search.'
        );
      },
      { timeout: 10000 }
    );
  };

  const handleSaveNearbyPlace = async (place) => {
    setSavingPlaceId(place.id);
    try {
      await api.saveDoctor({
        doctor_name: place.category === 'doctor' ? place.name : `${place.name} (Front Desk)`,
        specialty: place.specialty || 'Hospital / Clinic',
        hospital_name: place.name,
        phone: place.phone || '',
        address: place.address || '',
        notes: place.opening_hours ? `Hours: ${place.opening_hours}` : '',
      });
      await loadSavedDoctors();
    } finally {
      setSavingPlaceId(null);
    }
  };

  const handleAddDoctorSubmit = async (e) => {
    e.preventDefault();
    if (!docForm.doctor_name.trim() && !docForm.hospital_name.trim()) return;
    setSavingDoc(true);
    try {
      await api.saveDoctor(docForm);
      setDocForm({
        doctor_name: '',
        specialty: 'General Physician',
        hospital_name: '',
        phone: '',
        address: '',
        notes: '',
      });
      setShowAddDoctor(false);
      await loadSavedDoctors();
    } finally {
      setSavingDoc(false);
    }
  };

  const handleDeleteDoctor = async (id) => {
    await api.deleteDoctor(id);
    await loadSavedDoctors();
  };

  const prep = activePrep?.prep || null;

  const buildPlainText = () => {
    if (!prep) return '';
    const topics = isHi ? prep.key_topics_to_discuss_hi : prep.key_topics_to_discuss_en;
    const questions = isHi ? prep.suggested_questions_hi : prep.suggested_questions_en;
    const orgConcerns = isHi ? prep.organized_concerns_hi : prep.organized_concerns_en;
    const checklist = isHi ? prep.checklist_items_hi : prep.checklist_items_en;

    const savedDocLines = savedDoctors.length
      ? [
          '',
          'MY SAVED DOCTORS & HOSPITALS:',
          ...savedDoctors.map(
            (d) =>
              `- ${d.doctor_name} (${d.specialty})${d.hospital_name ? ` — ${d.hospital_name}` : ''}${
                d.phone ? ` | Phone: ${d.phone}` : ''
              }`
          ),
        ]
      : [];

    return [
      `MEDAI DOCTOR VISIT PREPARATION SUMMARY`,
      `Report: ${activePrep.report_title || 'General Visit'}`,
      ``,
      `SHORT SUMMARY:`,
      isHi ? prep.short_report_summary_hi : prep.short_report_summary_en,
      ``,
      `KEY TOPICS TO DISCUSS:`,
      ...(topics || []).map((t) => `- ${t}`),
      ``,
      `QUESTIONS FOR MY DOCTOR:`,
      ...(questions || []).map((q, i) => `${i + 1}. ${q}`),
      ``,
      `MY PERSONAL CONCERNS:`,
      ...(orgConcerns || []).map((c) => `- ${c}`),
      ``,
      `APPOINTMENT CHECKLIST:`,
      ...(checklist || []).map((c) => `[ ] ${c}`),
      ...savedDocLines,
    ].join('\n');
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(buildPlainText());
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    const blob = new Blob([buildPlainText()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'medai_doctor_visit_prep.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isHi ? 'डॉक्टर मुलाकात तैयारी व नज़दीकी अस्पताल' : 'Doctor Visit Preparation & Nearby Care'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {isHi
              ? 'नज़दीकी अस्पताल और डॉक्टर खोजें, अपने डॉक्टर का संपर्क सहेजें, और मुलाकात के लिए प्रश्न-सूची तैयार करें।'
              : 'Find nearby hospitals & clinics, keep your doctors’ contact info handy, and prepare prioritized questions before your appointment.'}
          </p>
        </div>
      </div>

      {/* =====================================================================
          NEARBY HOSPITALS, CLINICS & DOCTORS FINDER
          ===================================================================== */}
      <section className="med-card bg-white rounded-[1.75rem] border border-slate-200 p-5 sm:p-6 space-y-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {isHi ? 'नज़दीकी अस्पताल, क्लिनिक और डॉक्टर' : 'Nearby Hospitals, Clinics & Doctors'}
              </h2>
              <p className="text-xs text-slate-500">
                {isHi
                  ? 'वास्तविक नज़दीकी अस्पतालों, क्लिनिकों और संपर्क विवरण के लिए शहर/पिनकोड या अपनी लोकेशन का उपयोग करें।'
                  : 'Search real nearby hospitals and doctor practices via OpenStreetMap or open verified contacts on Google Maps.'}
              </p>
            </div>
          </div>

          {/* Verified Emergency Helplines */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { label: isHi ? 'आपातकाल' : 'Emergency', num: '112' },
              { label: isHi ? 'एम्बुलेंस' : 'Ambulance', num: '108' },
              { label: isHi ? 'स्वास्थ्य' : 'Health', num: '104' },
            ].map((h) => (
              <a
                key={h.num}
                href={`tel:${h.num}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-bold hover:bg-rose-100"
              >
                <Phone className="h-3 w-3" />
                {h.label}: {h.num}
              </a>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleNearbySearch} className="grid md:grid-cols-[1fr_240px_auto_auto] gap-2.5">
          <div className="relative">
            <MapPin className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              placeholder={
                isHi
                  ? 'शहर, इलाका या पिनकोड लिखें (जैसे: Jaipur, Pune, 110001)...'
                  : 'Enter city, neighborhood, or pincode (e.g., Delhi, Pune, 560001)...'
              }
              className="w-full rounded-xl border border-slate-300 pl-10 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <select
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {SPECIALTY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {isHi ? opt.labelHi : opt.labelEn}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={nearbyLoading}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-xs sm:text-sm font-semibold cursor-pointer"
          >
            {nearbyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span>{isHi ? 'खोजें' : 'Find Nearby'}</span>
          </button>

          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={nearbyLoading}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-teal-300 bg-teal-50 hover:bg-teal-100 text-teal-900 text-xs font-semibold cursor-pointer disabled:opacity-60"
          >
            <LocateFixed className="h-4 w-4" />
            <span>{isHi ? 'मेरी लोकेशन' : 'Use GPS'}</span>
          </button>
        </form>

        {nearbyError && <p className="text-xs font-medium text-rose-600">{nearbyError}</p>}

        {/* Nearby Results */}
        {nearbyData && (
          <div className="space-y-3 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-700">
                {isHi ? 'स्थान: ' : 'Showing results near: '}
                <span className="text-teal-800">{nearbyData.location_label}</span>
                {nearbyData.places?.length ? ` (${nearbyData.places.length} found)` : ''}
              </span>

              {nearbyData.maps_all_url && (
                <a
                  href={nearbyData.maps_all_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline"
                >
                  <span>
                    {isHi ? 'Google Maps पर डॉक्टर और नंबर देखें' : 'View Doctors & Verified Numbers on Google Maps'}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            {nearbyData.offline_notice && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900">
                {nearbyData.offline_notice}
              </div>
            )}

            {nearbyData.places?.length === 0 && !nearbyData.offline_notice && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600">
                {isHi
                  ? 'इस क्षेत्र में OpenStreetMap पर कोई परिणाम नहीं मिला। कृपया ऊपर दिए गए Google Maps लिंक का उपयोग करें।'
                  : 'No matching OpenStreetMap entries found within 8 km. Try a broader specialty or click the Google Maps link above.'}
              </div>
            )}

            {nearbyData.places?.length > 0 && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {nearbyData.places.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-sm text-slate-900 leading-snug">{p.name}</div>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-900 shrink-0">
                          {p.distance_km} km
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">
                          {p.specialty}
                        </span>
                        {p.emergency && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                            Emergency
                          </span>
                        )}
                      </div>

                      {p.address && (
                        <p className="text-xs text-slate-600 flex items-start gap-1.5 pt-0.5">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span>{p.address}</span>
                        </p>
                      )}

                      {p.opening_hours && (
                        <p className="text-xs text-slate-600 flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{p.opening_hours}</span>
                        </p>
                      )}

                      {p.phone ? (
                        <a
                          href={`tel:${p.phone}`}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 hover:underline pt-0.5"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          <span>{p.phone}</span>
                        </a>
                      ) : (
                        <a
                          href={p.doctors_search_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline pt-0.5"
                        >
                          <Phone className="h-3 w-3" />
                          <span>{isHi ? 'डॉक्टर व फ़ोन नंबर Maps पर देखें' : 'See Doctors & Phone on Maps'}</span>
                        </a>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
                      <a
                        href={p.maps_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-teal-800"
                      >
                        <span>{isHi ? 'दिशा-निर्देश' : 'Directions'}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>

                      <button
                        type="button"
                        onClick={() => handleSaveNearbyPlace(p)}
                        disabled={savingPlaceId === p.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:border-teal-500 text-[11px] font-semibold text-slate-800 cursor-pointer disabled:opacity-50"
                      >
                        <BookmarkPlus className="h-3.5 w-3.5 text-teal-700" />
                        <span>{isHi ? 'सहेजें' : 'Save Contact'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =====================================================================
            MY SAVED DOCTORS & PREFERRED HOSPITALS CONTACT BOOK
            ===================================================================== */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <UserRound className="h-4 w-4 text-teal-700" />
              <span>
                {isHi ? 'मेरे सहेजे गए डॉक्टर और संपर्क विवरण' : 'My Saved Doctors & Hospital Contacts'} ({savedDoctors.length})
              </span>
            </h3>
            <button
              type="button"
              onClick={() => setShowAddDoctor((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-900 text-xs font-semibold cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{isHi ? 'नया डॉक्टर जोड़ें' : 'Add Doctor Contact'}</span>
            </button>
          </div>

          {showAddDoctor && (
            <form
              onSubmit={handleAddDoctorSubmit}
              className="rounded-2xl border border-teal-200 bg-teal-50/40 p-4 space-y-3"
            >
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={docForm.doctor_name}
                  onChange={(e) => setDocForm({ ...docForm, doctor_name: e.target.value })}
                  placeholder={isHi ? 'डॉक्टर का नाम (जैसे: डॉ. अनिल मेहता)' : 'Doctor Name (e.g., Dr. Anil Mehta)'}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <input
                  type="text"
                  value={docForm.specialty}
                  onChange={(e) => setDocForm({ ...docForm, specialty: e.target.value })}
                  placeholder={isHi ? 'विशेषज्ञता (जैसे: जनरल फिजिशियन)' : 'Specialty (e.g., General Physician)'}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <input
                  type="text"
                  value={docForm.hospital_name}
                  onChange={(e) => setDocForm({ ...docForm, hospital_name: e.target.value })}
                  placeholder={isHi ? 'अस्पताल / क्लिनिक का नाम' : 'Hospital / Clinic Name'}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <input
                  type="tel"
                  value={docForm.phone}
                  onChange={(e) => setDocForm({ ...docForm, phone: e.target.value })}
                  placeholder={isHi ? 'फ़ोन नंबर (जैसे: +91 98XXXXXXXX)' : 'Phone Number (e.g., +91 98XXXXXXXX)'}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <input
                  type="text"
                  value={docForm.address}
                  onChange={(e) => setDocForm({ ...docForm, address: e.target.value })}
                  placeholder={isHi ? 'पता / क्लिनिक का समय' : 'Clinic Address / Timings'}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 sm:col-span-2"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={savingDoc}
                  className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold cursor-pointer"
                >
                  {savingDoc ? '...' : isHi ? 'संपर्क सहेजें' : 'Save Doctor'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddDoctor(false)}
                  className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  {isHi ? 'रद्द करें' : 'Cancel'}
                </button>
              </div>
            </form>
          )}

          {savedDoctors.length === 0 ? (
            <p className="text-xs text-slate-500">
              {isHi
                ? 'अभी कोई डॉक्टर सहेजा नहीं गया है। ऊपर से अपने डॉक्टर का नाम व नंबर जोड़ें या नज़दीकी अस्पताल से "सहेजें" पर क्लिक करें।'
                : 'No saved doctors yet. Add your doctor’s name & phone above or click "Save Contact" on any nearby hospital.'}
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {savedDoctors.map((doc) => (
                <div
                  key={doc.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col justify-between gap-2 shadow-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-sm text-slate-900">{doc.doctor_name}</div>
                        <div className="text-[11px] font-semibold text-teal-700">{doc.specialty}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteDoctor(doc.id)}
                        className="p-1 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                        title="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {doc.hospital_name && (
                      <div className="text-xs text-slate-700 flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{doc.hospital_name}</span>
                      </div>
                    )}
                    {doc.address && (
                      <div className="text-xs text-slate-500 flex items-start gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span>{doc.address}</span>
                      </div>
                    )}
                  </div>
                  {doc.phone && (
                    <a
                      href={`tel:${doc.phone}`}
                      className="inline-flex items-center justify-center gap-1.5 mt-1 py-1.5 px-3 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-900 text-xs font-bold"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      <span>{doc.phone}</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* =====================================================================
          VISIT PREPARATION SHEET BUILDER (EXISTING MODULE 12)
          ===================================================================== */}
      <form
        onSubmit={handleGenerate}
        className="med-card bg-white rounded-[1.75rem] border border-slate-200 p-5 sm:p-6 space-y-4 shadow-xs"
      >
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-teal-700" />
          <h2 className="text-base font-bold text-slate-900">
            {isHi ? 'डॉक्टर विज़िट प्रश्न-सूची और सारांश तैयार करें' : 'Build Your Doctor Visit Preparation Sheet'}
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isHi ? 'समीक्षा के लिए रिपोर्ट चुनें' : 'Select Medical Report to Review'}
            </label>
            <select
              value={reportId}
              onChange={(e) => setReportId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">{isHi ? 'सामान्य परामर्श (बिना रिपोर्ट)' : 'General consultation (no report)'}</option>
              {reports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title} ({r.report_date || new Date(r.created_at).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isHi ? 'मुलाकात का मुख्य उद्देश्य' : 'Main Goal for This Visit'}
            </label>
            <input
              type="text"
              value={visitGoal}
              onChange={(e) => setVisitGoal(e.target.value)}
              placeholder={
                isHi ? 'जैसे: वार्षिक स्वास्थ्य जांच की समीक्षा' : 'e.g., Review recent blood work & fatigue'
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Add Personal Concerns */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {isHi ? 'अपने लक्षण या व्यक्तिगत चिंताएँ जोड़ें' : 'Add Personal Concerns or Symptoms'}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={concernInput}
              onChange={(e) => setConcernInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addConcern();
                }
              }}
              placeholder={
                isHi ? 'जैसे: पिछले 2 सप्ताह से दोपहर में थकान' : 'e.g., Feeling tired in the afternoons for 2 weeks'
              }
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              type="button"
              onClick={addConcern}
              className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border border-teal-300 bg-teal-50 hover:bg-teal-100 text-teal-900 text-xs font-semibold cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              {isHi ? 'जोड़ें' : 'Add'}
            </button>
          </div>
          {concerns.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2.5">
              {concerns.map((c, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-medium"
                >
                  {c}
                  <button
                    type="button"
                    onClick={() => setConcerns((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-slate-500 hover:text-rose-600 cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-semibold cursor-pointer"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {isHi ? 'डॉक्टर विज़िट शीट तैयार करें' : 'Build Doctor Visit Sheet'}
        </button>
        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
      </form>

      {activePrep && prep && (
        <section className="med-card bg-white rounded-[1.75rem] border border-slate-200 p-5 sm:p-6 space-y-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-teal-700" />
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {activePrep.report_title || (isHi ? 'डॉक्टर विज़िट सारांश' : 'Doctor Visit Summary')}
                </h2>
                <p className="text-xs text-slate-500">
                  {new Date(activePrep.created_at).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? (isHi ? 'कॉपी हुआ!' : 'Copied!') : isHi ? 'कॉपी करें' : 'Copy to Share'}
              </button>
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                {isHi ? 'डाउनलोड करें' : 'Download'}
              </button>
            </div>
          </div>

          <p className="text-sm text-slate-700 bg-teal-50/70 border border-teal-100 rounded-xl p-4 leading-relaxed">
            {isHi ? prep.short_report_summary_hi : prep.short_report_summary_en}
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4 space-y-2.5">
              <h3 className="text-sm font-bold text-sky-950 flex items-center gap-1.5">
                <Stethoscope className="h-4 w-4 text-sky-700" />
                {isHi ? 'डॉक्टर से पूछने योग्य प्रश्न' : 'Questions to Ask Your Doctor'}
              </h3>
              <ol className="list-decimal pl-5 space-y-1.5 text-xs text-slate-800">
                {(isHi ? prep.suggested_questions_hi : prep.suggested_questions_en || []).map(
                  (q, i) => (
                    <li key={i}>{q}</li>
                  )
                )}
              </ol>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-2.5">
              <h3 className="text-sm font-bold text-amber-950">
                {isHi ? 'चर्चा करने योग्य मुख्य परिणाम / विषय' : 'Key Report Topics to Discuss'}
              </h3>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-800">
                {(isHi ? prep.key_topics_to_discuss_hi : prep.key_topics_to_discuss_en || []).map(
                  (topic, i) => (
                    <li key={i}>{topic}</li>
                  )
                )}
              </ul>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {isHi ? 'आपकी व्यवस्थित चिंताएँ' : 'Your Organized Concerns'}
              </h3>
              <ul className="list-disc pl-4 space-y-1 text-xs text-slate-700">
                {(isHi ? prep.organized_concerns_hi : prep.organized_concerns_en || []).map(
                  (c, i) => (
                    <li key={i}>{c}</li>
                  )
                )}
              </ul>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                <CheckSquare className="h-3.5 w-3.5" />
                {isHi ? 'मुलाकात चेकलिस्ट' : 'Visit Checklist'}
              </h3>
              <ul className="space-y-1.5 text-xs text-slate-700">
                {(isHi ? prep.checklist_items_hi : prep.checklist_items_en || []).map((c, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <input type="checkbox" className="mt-0.5 accent-teal-700" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
