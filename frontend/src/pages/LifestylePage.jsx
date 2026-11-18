import React, { useEffect, useState } from 'react';
import {
  Activity,
  Apple,
  Ban,
  CalendarDays,
  Download,
  HeartPulse,
  Loader2,
  ShieldAlert,
  Sparkles,
  Sun,
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { api } from '../services/api';

const MANDATORY_DISCLAIMER_EN =
  'The diet, exercise and lifestyle recommendations provided by this application are intended to support your general health and well-being. These recommendations do NOT mean that you should stop taking, reduce, skip or replace any medicine prescribed by your doctor. Continue taking your prescribed medicines as directed by your healthcare professional. Do not change your medication or treatment without consulting your doctor. Lifestyle changes are supportive measures and are not a substitute for medical treatment.';

const MANDATORY_DISCLAIMER_HI =
  'इस एप्लिकेशन द्वारा दिए गए आहार, व्यायाम और जीवनशैली के सुझाव केवल आपके सामान्य स्वास्थ्य और कल्याण के सहयोग के लिए हैं। इन सुझावों का यह अर्थ बिल्कुल नहीं है कि आप अपने डॉक्टर द्वारा लिखी गई किसी भी दवाई को बंद करें, कम करें, छोड़ें या बदलें। कृपया अपने डॉक्टर के निर्देशानुसार निर्धारित दवाइयाँ नियमित रूप से लेते रहें। डॉक्टर से परामर्श किए बिना अपनी दवाई या उपचार में कोई बदलाव न करें। जीवनशैली में बदलाव सहायक उपाय हैं और चिकित्सा उपचार का विकल्प नहीं हैं।';

export default function LifestylePage({ reports, lifestylePlans, onRefreshData }) {
  const { language } = useSettings();
  const isHi = language === 'hi';

  const [age, setAge] = useState('34');
  const [dietPref, setDietPref] = useState('Vegetarian');
  const [allergies, setAllergies] = useState('');
  const [mobility, setMobility] = useState('');
  const [restrictions, setRestrictions] = useState('');
  const [reportId, setReportId] = useState(reports?.[0]?.id || '');

  const [activePlan, setActivePlan] = useState(lifestylePlans?.[0] || null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!activePlan && lifestylePlans?.length > 0) {
      setActivePlan(lifestylePlans[0]);
    }
  }, [lifestylePlans, activePlan]);

  useEffect(() => {
    if (!reportId && reports?.[0]?.id) {
      setReportId(reports[0].id);
    }
  }, [reports, reportId]);

  const handleGenerate = async (e) => {
    e.preventDefault();
    setError('');
    setGenerating(true);
    try {
      const res = await api.generateLifestylePlan({
        age,
        dietary_preference: dietPref,
        allergies,
        mobility_limitations: mobility,
        medical_restrictions: restrictions,
        report_id: reportId || null,
      });
      setActivePlan(res.lifestyle_plan);
      await onRefreshData();
    } catch (err) {
      setError(err.message || 'Could not generate lifestyle guide.');
    } finally {
      setGenerating(false);
    }
  };

  const plan = activePlan?.plan || null;

  const handleDownload = () => {
    if (!plan) return;
    const lines = [
      'MEDAI PERSONALIZED DIET & LIFESTYLE GUIDE',
      '',
      'IMPORTANT MEDICAL DISCLAIMER:',
      isHi ? MANDATORY_DISCLAIMER_HI : MANDATORY_DISCLAIMER_EN,
      '',
      'OVERVIEW:',
      isHi ? plan.overview_hi : plan.overview_en,
      '',
      '=== SECTION A: DAILY DIET & LIFESTYLE GUIDANCE ===',
      'Foods to Consume More:',
      ...(plan.foods_to_include || []).map(
        (f) => `- ${isHi ? f.item_hi : f.item_en}: ${isHi ? f.reason_hi : f.reason_en}`
      ),
      '',
      'Foods to Limit / Avoid:',
      ...(plan.foods_to_limit || []).map(
        (f) => `- ${isHi ? f.item_hi : f.item_en}: ${isHi ? f.reason_hi : f.reason_en}`
      ),
      '',
      '=== SECTION B: WEEKLY DIET & EXERCISE PLAN ===',
      ...(plan.weekly_plan || []).map(
        (d) =>
          `${d.day}: Breakfast: ${isHi ? d.breakfast_hi : d.breakfast_en} | Lunch: ${
            isHi ? d.lunch_hi : d.lunch_en
          } | Dinner: ${isHi ? d.dinner_hi : d.dinner_en} | Exercise: ${
            isHi ? d.exercise_hi : d.exercise_en
          }`
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'medai_diet_lifestyle_guide.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {isHi ? 'व्यक्तिगत आहार और जीवनशैली गाइड' : 'Personalized Diet & Lifestyle Guide'}
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          {isHi
            ? 'अपनी उम्र, भोजन की पसंद, एलर्जी और मेडिकल रिपोर्ट के आधार पर दैनिक और साप्ताहिक स्वस्थ दिनचर्या पाएं।'
            : 'General health-supportive daily diet, gentle exercise, and weekly routine personalized to your preferences and lab context.'}
        </p>
      </div>

      {/* Mandatory Medical Disclaimer (Always Visible) */}
      <section className="rounded-2xl bg-amber-50 border-2 border-amber-300 p-4 sm:p-5 flex items-start gap-3 text-amber-950 shadow-xs">
        <ShieldAlert className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-800">
            {isHi ? 'महत्वपूर्ण चिकित्सा अस्वीकरण (Important Medical Disclaimer)' : 'Important Medical Disclaimer'}
          </div>
          <p className="text-xs sm:text-sm leading-relaxed">
            {isHi ? MANDATORY_DISCLAIMER_HI : MANDATORY_DISCLAIMER_EN}
          </p>
        </div>
      </section>

      {/* Profile Input Form */}
      <form
        onSubmit={handleGenerate}
        className="med-card bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4 shadow-xs"
      >
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isHi ? 'उम्र (Age)' : 'Age'}
            </label>
            <input
              type="number"
              min="10"
              max="110"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isHi ? 'आहार की पसंद' : 'Dietary Preference'}
            </label>
            <select
              value={dietPref}
              onChange={(e) => setDietPref(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="Vegetarian">Vegetarian (शाकाहारी)</option>
              <option value="Eggetarian">Eggetarian</option>
              <option value="Non-Vegetarian">Non-Vegetarian</option>
              <option value="Vegan">Vegan</option>
              <option value="Low-Sodium / Heart Friendly">Low-Sodium / Heart Friendly</option>
              <option value="Low-Glycemic / Sugar Conscious">Low-Glycemic / Sugar Conscious</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isHi ? 'लैब रिपोर्ट जोड़ें (वैकल्पिक)' : 'Link Medical Report (Optional)'}
            </label>
            <select
              value={reportId}
              onChange={(e) => setReportId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">{isHi ? 'कोई रिपोर्ट नहीं' : 'General wellness (no report)'}</option>
              {reports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isHi ? 'खाद्य एलर्जी' : 'Food Allergies'}
            </label>
            <input
              type="text"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              placeholder={isHi ? 'जैसे: मूंगफली, लैक्टोज़' : 'e.g., Peanuts, dairy, gluten'}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isHi ? 'चलने-फिरने की सीमाएँ' : 'Mobility Limitations'}
            </label>
            <input
              type="text"
              value={mobility}
              onChange={(e) => setMobility(e.target.value)}
              placeholder={isHi ? 'जैसे: घुटनों में दर्द' : 'e.g., Knee pain, seated exercises preferred'}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isHi ? 'ज्ञात मेडिकल प्रतिबंध' : 'Known Medical Restrictions'}
            </label>
            <input
              type="text"
              value={restrictions}
              onChange={(e) => setRestrictions(e.target.value)}
              placeholder={isHi ? 'जैसे: कम नमक, डॉक्टर की सलाह' : 'e.g., Low potassium, doctor-advised limits'}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="submit"
            disabled={generating}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-semibold cursor-pointer"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isHi ? 'व्यक्तिगत गाइड बनाएं' : 'Generate Personalized Guide'}
          </button>
          {plan && (
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              {isHi ? 'योजना डाउनलोड करें' : 'Download Plan'}
            </button>
          )}
        </div>
        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
      </form>

      {/* Generated Two-Section Output */}
      {plan && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-teal-50/80 border border-teal-200 p-4 text-sm text-teal-950">
            {isHi ? plan.overview_hi : plan.overview_en}
          </div>

          {/* SECTION A: Daily Diet and Lifestyle Guidance */}
          <section className="med-card bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-5 shadow-xs">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <HeartPulse className="h-5 w-5 text-teal-700" />
              <h2 className="text-lg font-bold text-slate-900">
                {isHi ? 'भाग A: दैनिक आहार और जीवनशैली मार्गदर्शन' : 'Section A: Daily Diet and Lifestyle Guidance'}
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Foods to Consume More */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                <h3 className="text-sm font-bold text-emerald-900 flex items-center gap-1.5">
                  <Apple className="h-4 w-4 text-emerald-700" />
                  {isHi ? 'अधिक शामिल करने योग्य भोजन' : 'Foods to Consume More'}
                </h3>
                <div className="space-y-2.5">
                  {(plan.foods_to_include || []).map((f, i) => (
                    <div key={i} className="rounded-xl bg-white border border-emerald-100 p-3">
                      <div className="font-semibold text-xs text-slate-900">
                        {isHi ? f.item_hi : f.item_en}
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        {isHi ? f.reason_hi : f.reason_en}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Foods to Limit / Avoid */}
              <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 space-y-3">
                <h3 className="text-sm font-bold text-rose-900 flex items-center gap-1.5">
                  <Ban className="h-4 w-4 text-rose-700" />
                  {isHi ? 'सीमित करने या बचने योग्य भोजन' : 'Foods to Avoid or Limit'}
                </h3>
                <div className="space-y-2.5">
                  {(plan.foods_to_limit || []).map((f, i) => (
                    <div key={i} className="rounded-xl bg-white border border-rose-100 p-3">
                      <div className="font-semibold text-xs text-slate-900">
                        {isHi ? f.item_hi : f.item_en}
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        {isHi ? f.reason_hi : f.reason_en}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recommended Physical Activities */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-teal-700" />
                {isHi ? 'अनुशंसित शारीरिक गतिविधियाँ' : 'Recommended Physical Activities'}
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {(plan.physical_activities || []).map((act, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="font-bold text-sm text-slate-900">
                      {isHi ? act.activity_hi : act.activity_en}
                    </div>
                    <div className="text-xs font-semibold text-teal-700 mt-1">
                      {isHi ? act.duration_frequency_hi : act.duration_frequency_en}
                    </div>
                    <p className="text-xs text-slate-600 mt-1.5">
                      {isHi ? act.benefit_hi : act.benefit_en}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Daily Habits & Safe Home-Care */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-sky-900">
                  {isHi ? 'दैनिक स्वास्थ्य आदतें' : 'Daily Health Habits (Sleep, Hydration, Stress)'}
                </h3>
                <ul className="list-disc pl-4 space-y-1.5 text-xs text-slate-700">
                  {(isHi ? plan.daily_habits_hi : plan.daily_habits_en || []).map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-4 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-teal-900 flex items-center gap-1">
                  <Sun className="h-3.5 w-3.5" />
                  {isHi ? 'सुरक्षित घरेलू देखभाल सुझाव' : 'Safe, Evidence-Based Home-Care Suggestions'}
                </h3>
                <ul className="list-disc pl-4 space-y-1.5 text-xs text-slate-700">
                  {(isHi ? plan.home_care_hi : plan.home_care_en || []).map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* SECTION B: Weekly Diet and Exercise Plan */}
          <section className="med-card bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-teal-700" />
              <h2 className="text-lg font-bold text-slate-900">
                {isHi ? 'भाग B: साप्ताहिक आहार और व्यायाम योजना' : 'Section B: Weekly Diet and Exercise Plan'}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase">
                    <th className="py-3 px-3">{isHi ? 'दिन' : 'Day'}</th>
                    <th className="py-3 px-3">{isHi ? 'नाश्ता' : 'Breakfast'}</th>
                    <th className="py-3 px-3">{isHi ? 'दोपहर का भोजन' : 'Lunch'}</th>
                    <th className="py-3 px-3">{isHi ? 'शाम का नाश्ता' : 'Snack'}</th>
                    <th className="py-3 px-3">{isHi ? 'रात का भोजन' : 'Dinner'}</th>
                    <th className="py-3 px-3">{isHi ? 'व्यायाम व विश्राम' : 'Exercise & Rest'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(plan.weekly_plan || []).map((d) => (
                    <tr key={d.day} className="align-top hover:bg-slate-50/60">
                      <td className="py-3 px-3 font-bold text-teal-800 whitespace-nowrap">{d.day}</td>
                      <td className="py-3 px-3 text-slate-700">{isHi ? d.breakfast_hi : d.breakfast_en}</td>
                      <td className="py-3 px-3 text-slate-700">{isHi ? d.lunch_hi : d.lunch_en}</td>
                      <td className="py-3 px-3 text-slate-700">{isHi ? d.snack_hi : d.snack_en}</td>
                      <td className="py-3 px-3 text-slate-700">{isHi ? d.dinner_hi : d.dinner_en}</td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">
                          {isHi ? d.exercise_hi : d.exercise_en}
                        </div>
                        <div className="text-slate-500 mt-0.5">
                          {isHi ? d.rest_note_hi : d.rest_note_en}
                        </div>
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

