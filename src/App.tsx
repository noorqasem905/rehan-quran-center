// The application is a legacy single-file UI; runtime validation remains covered by the Vite build.
// @ts-nocheck
import { useState, useMemo, useEffect } from 'react';
import {
  BookOpen,
  Award,
  Users,
  Calendar,
  CheckCircle2,
  Clock,
  Shield,
  Plus,
  Trash2,
  AlertCircle,
  Layers,
  ChevronRight,
  ChevronLeft,
  X,
  UserPlus,
  Edit2,
  FileText,
  RotateCcw,
  Sparkles,
  Trophy,
  BarChart3,
  DollarSign,
  Bookmark,
  LogOut,
  LogIn,
  Menu,
  Stamp,
  CheckCheck,
  BookmarkCheck,
  Compass,
  HeartHandshake,
  Sun,
  PenTool,
  Eye,
  EyeOff,
  XCircle,
  Bell
} from 'lucide-react';
import { supabase } from './lib/supabaseClient';

const ROLES = {
  GENERAL_SUPERVISOR: 'general_supervisor',
  CLASS_SUPERVISOR: 'class_supervisor',
  IT_ADMIN: 'it_admin'
};

const ALL_WEEK_DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
const DEFAULT_CENTER_DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء'];
const DAYS_OF_WEEK = DEFAULT_CENTER_DAYS;
const DEFAULT_WELCOME_DUA = 'اللهم افتح لنا أبواب العلم والبركة، ووفقنا لخدمة كتابك وتعليم أبنائنا ما ينفعهم.';

function formatLiveDates(date = new Date()) {
  return {
    hijri: new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date),
    gregorian: new Intl.DateTimeFormat('ar-JO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date)
  };
}

function formatSectionPeriod(startDate, endDate) {
  if (!startDate) return 'الفترة غير محددة';
  const start = new Date(`${startDate}T00:00:00`);
  const end = endDate ? new Date(`${endDate}T00:00:00`) : start;
  return `الفترة: ${start.getDate()} - ${end.getDate()} / ${start.getMonth() + 1}`;
}

function normalizeCenterDays(days) {
  if (!Array.isArray(days)) return null;
  const normalizedDays = ALL_WEEK_DAYS.filter(day => days.includes(day));
  return normalizedDays.length > 0 ? normalizedDays : null;
}

const PRAYERS_LIST = [
  { key: 'fajr', label: 'الفجر' },
  { key: 'dhuhr', label: 'الظهر' },
  { key: 'asr', label: 'العصر' },
  { key: 'maghrib', label: 'المغرب' },
  { key: 'isha', label: 'العشاء' }
];
const PRAYER_TIME_FIELDS = [
  { key: 'fajr', label: 'الفجر' },
  { key: 'sunrise', label: 'الشروق' },
  { key: 'dhuhr', label: 'الظهر' },
  { key: 'asr', label: 'العصر' },
  { key: 'maghrib', label: 'المغرب' },
  { key: 'isha', label: 'العشاء' }
];

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function mapScheduleRow(row) {
  return {
    id: row.id,
    classId: row.class_id || row.classId,
    date: row.schedule_date || row.date,
    startTime: row.start_time || row.startTime || '',
    endTime: row.end_time || row.endTime || '',
    tasks: Array.isArray(row.tasks) ? row.tasks : []
  };
}

function mapPrayerTimeRow(row) {
  return {
    id: row.id,
    date: row.prayer_date || row.date,
    ...PRAYER_TIME_FIELDS.reduce((times, prayer) => {
      times[prayer.key] = row[prayer.key] || '';
      return times;
    }, {})
  };
}

function parsePrayerScheduleText(input) {
  const entries = [];
  const datePattern = /(\d{1,2})\/(\d{1,2})\/(\d{4})/g;
  let dateMatch;
  while ((dateMatch = datePattern.exec(String(input || ''))) !== null) {
    const [, day, month, year] = dateMatch;
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const remainder = String(input).slice(datePattern.lastIndex);
    const nextDateIndex = remainder.search(/\d{1,2}\/\d{1,2}\/\d{4}/);
    const segment = nextDateIndex >= 0 ? remainder.slice(0, nextDateIndex) : remainder;
    const compactDigits = segment.replace(/\D/g, '');
    const compactTimes = [];
    for (let index = 0; index + 6 <= compactDigits.length && compactTimes.length < PRAYER_TIME_FIELDS.length; index += 6) {
      const hours = compactDigits.slice(index, index + 2);
      const minutes = compactDigits.slice(index + 2, index + 4);
      if (Number(hours) > 23 || Number(minutes) > 59) break;
      compactTimes.push(`${hours}:${minutes}`);
    }
    const times = compactTimes.length === PRAYER_TIME_FIELDS.length
      ? compactTimes
      : [...segment.matchAll(/(?:^|[^\d])(\d{1,2}):?(\d{2})(?::?(\d{2}))?/g)]
        .map(match => `${String(match[1]).padStart(2, '0')}:${match[2]}`)
        .slice(0, PRAYER_TIME_FIELDS.length);
    if (times.length === PRAYER_TIME_FIELDS.length) {
      entries.push({
        prayer_date: date,
        ...PRAYER_TIME_FIELDS.reduce((values, prayer, index) => {
          values[prayer.key] = times[index];
          return values;
        }, {})
      });
    }
    if (nextDateIndex >= 0) datePattern.lastIndex += nextDateIndex;
  }
  return entries;
}

function PrayerTimesCards({ prayerTimes = [] }) {
  const today = getLocalDateKey();
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const dates = [today, getLocalDateKey(tomorrowDate)];
  const visibleTimes = dates.map(date => prayerTimes.find(item => item.date === date)).filter(Boolean);
  return (
    <section className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs">
      <div className="flex items-center gap-2 mb-4">
        <Sun className="w-5 h-5 text-amber-500" />
        <h2 className="font-black text-slate-900">مواقيت الصلاة</h2>
        <span className="text-xs text-slate-500">اليوم والغد</span>
      </div>
      {visibleTimes.length === 0 ? (
        <p className="text-sm text-slate-500">لم تُحفظ مواقيت اليوم أو الغد بعد.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visibleTimes.map(item => (
            <div key={item.date} className="rounded-2xl bg-emerald-50 border border-emerald-100 p-3">
              <p className="text-xs font-black text-emerald-900 mb-2">{item.date}</p>
              <div className="grid grid-cols-2 gap-2">
                {PRAYER_TIME_FIELDS.map(prayer => (
                  <div key={prayer.key} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">{prayer.label}</span>
                    <b className="text-emerald-800" dir="ltr">{item[prayer.key] || '--:--'}</b>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AzkariView({ schedules, prayerTimes, classes, currentUser, isGeneralSupervisor, onSaveSchedule }) {
  const today = getLocalDateKey();
  const ownClassId = isGeneralSupervisor ? null : currentUser?.assignedClassId;
  const visibleClasses = isGeneralSupervisor ? classes : classes.filter(item => String(item.id) === String(ownClassId));
  const [selectedClassId, setSelectedClassId] = useState(ownClassId || visibleClasses[0]?.id || '');
  const [selectedDate, setSelectedDate] = useState(today);
  const [form, setForm] = useState({ startTime: '16:00', endTime: '19:00', tasks: [] });
  const [task, setTask] = useState({ title: '', startTime: '', endTime: '', silent: false });
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const currentSchedule = schedules.find(item => String(item.classId) === String(selectedClassId) && item.date === selectedDate);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const source = currentSchedule || { startTime: '16:00', endTime: '19:00', tasks: [] };
    setForm({ startTime: source.startTime, endTime: source.endTime, tasks: source.tasks || [] });
  }, [selectedClassId, selectedDate, currentSchedule?.id]);

  const addTask = () => {
    if (!task.title || !task.startTime || !task.endTime) return;
    setForm(previous => ({ ...previous, tasks: [...previous.tasks, task] }));
    setTask({ title: '', startTime: '', endTime: '', silent: false });
  };
  const displaySchedule = currentSchedule || { ...form, tasks: form.tasks };
  const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const activeTask = displaySchedule.tasks.find(item => {
    const [startHour, startMinute] = item.startTime.split(':').map(Number);
    const [endHour, endMinute] = item.endTime.split(':').map(Number);
    return nowMinutes >= startHour * 60 + startMinute && nowMinutes < endHour * 60 + endMinute;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-black text-slate-900">جدول الشعب</h1><p className="text-sm text-slate-500">مهام وتذكيرات الشُعب اليومية</p></div>
        <Clock className="w-8 h-8 text-emerald-700" />
      </div>
      {activeTask && (
        <div className={`rounded-2xl border px-4 py-3 ${activeTask.silent ? 'bg-slate-50 border-slate-200' : 'bg-amber-50 border-amber-200'}`}>
          <p className="font-black text-slate-900">⏰ المهمة الحالية: {activeTask.title}</p>
          <p className="text-xs text-slate-600 mt-1">{activeTask.startTime} - {activeTask.endTime}{activeTask.silent ? ' · تذكير صامت' : ''}</p>
        </div>
      )}
      {isGeneralSupervisor && (
        <section className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h2 className="font-black text-slate-900">إعداد جدول الشُعبة</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select value={selectedClassId} onChange={event => setSelectedClassId(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2">
              <option value="">اختر الشُعبة</option>{visibleClasses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <input type="date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
            <div className="flex gap-2"><input type="time" value={form.startTime} onChange={event => setForm({ ...form, startTime: event.target.value })} className="w-full rounded-xl border border-slate-200 px-2 py-2" /><input type="time" value={form.endTime} onChange={event => setForm({ ...form, endTime: event.target.value })} className="w-full rounded-xl border border-slate-200 px-2 py-2" /></div>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <input placeholder="اسم المهمة" value={task.title} onChange={event => setTask({ ...task, title: event.target.value })} className="flex-1 min-w-40 rounded-xl border border-slate-200 px-3 py-2" />
            <input type="time" value={task.startTime} onChange={event => setTask({ ...task, startTime: event.target.value })} className="rounded-xl border border-slate-200 px-2 py-2" />
            <input type="time" value={task.endTime} onChange={event => setTask({ ...task, endTime: event.target.value })} className="rounded-xl border border-slate-200 px-2 py-2" />
            <label className="text-xs flex items-center gap-1 py-2"><input type="checkbox" checked={task.silent} onChange={event => setTask({ ...task, silent: event.target.checked })} /> تذكير صامت</label>
            <button type="button" onClick={addTask} className="rounded-xl bg-slate-100 px-3 py-2 font-bold">إضافة مهمة</button>
          </div>
          <div className="space-y-2">{form.tasks.map((item, index) => <div key={`${item.title}-${index}`} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm"><span>{item.startTime} - {item.endTime} · {item.title}{item.silent ? ' · صامت' : ''}</span><button type="button" onClick={() => setForm({ ...form, tasks: form.tasks.filter((_, taskIndex) => taskIndex !== index) })} className="text-rose-600" aria-label="حذف المهمة"><X className="w-4 h-4" /></button></div>)}</div>
          <button type="button" disabled={!selectedClassId} onClick={() => onSaveSchedule({ classId: selectedClassId, date: selectedDate, ...form })} className="rounded-xl bg-emerald-800 px-4 py-2 text-white font-black disabled:opacity-50">حفظ جدول الشُعبة</button>
        </section>
      )}
      <section className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs">
        <h2 className="font-black text-slate-900 mb-3">جدول اليوم</h2>
        {visibleClasses.length === 0 ? <p className="text-sm text-slate-500">لا توجد شُعبة مسندة لهذا المستخدم.</p> : (
          <div className="space-y-2">{displaySchedule.tasks.length ? displaySchedule.tasks.map((item, index) => <div key={`${item.title}-${index}`} className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3"><span className="font-bold">{item.title}</span><span className="text-xs text-emerald-700" dir="ltr">{item.startTime} - {item.endTime}</span></div>) : <p className="text-sm text-slate-500">لم تُحدد مهام لهذا اليوم.</p>}</div>
        )}
      </section>
      <PrayerTimesCards prayerTimes={prayerTimes} />
    </div>
  );
}

function QuranPrayerView({ prayerTimes, isGeneralSupervisor, onSavePrayerTimes }) {
  const [rawText, setRawText] = useState('');
  const [parseMessage, setParseMessage] = useState('');
  const handleParse = async () => {
    const entries = parsePrayerScheduleText(rawText);
    if (!entries.length) { setParseMessage('تعذر تحليل النص. تأكد من وجود تاريخ وستة أوقات لكل يوم.'); return; }
    await onSavePrayerTimes(entries);
    setParseMessage(`تم تحليل وحفظ ${entries.length} يوماً بنجاح.`);
    setRawText('');
  };
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-black text-slate-900">الأذكار والقرآن ومواقيت الصلاة</h1><p className="text-sm text-slate-500">ورد يومي وأوقات الصلاة لليوم والغد</p></div>
      {isGeneralSupervisor && <section className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-3"><h2 className="font-black">تحليل جدول مواقيت الصلاة</h2><textarea value={rawText} onChange={event => setRawText(event.target.value)} rows={4} placeholder="23/11/202605:46:0007:05:00..." className="w-full rounded-2xl border border-slate-200 p-3 text-left" dir="ltr" /><button type="button" onClick={handleParse} className="rounded-xl bg-emerald-800 px-4 py-2 text-white font-black">تحليل وحفظ جدول الصلاة</button>{parseMessage && <p className="text-sm text-emerald-700">{parseMessage}</p>}</section>}
      <PrayerTimesCards prayerTimes={prayerTimes} />
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {['أذكار الصباح والمساء', 'ورد القرآن اليومي', 'أدعية مختارة'].map((title, index) => <article key={title} className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs"><h2 className="font-black text-emerald-900">{title}</h2><p className="text-sm text-slate-600 leading-7 mt-3">{index === 0 ? 'سبحان الله وبحمده، سبحان الله العظيم.' : index === 1 ? 'اقرأ وردك اليومي بتدبر وثبات، ولو آيات يسيرة.' : 'اللهم أعنا على ذكرك وشكرك وحسن عبادتك.'}</p><div className="flex gap-2 mt-4"><button type="button" className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">تم الإنجاز ✓</button><button type="button" className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">التالي</button></div></article>)}
      </section>
    </div>
  );
}

function mapClassRow(row) {
  return {
    id: row.id,
    name: row.name,
    room: row.room,
    capacity: row.capacity,
    level: row.level,
    curriculumJuz: row.curriculum_juz || '',
    sectionsCount: Number(row.sections_count) || 3,
    supervisorId: row.supervisor_id || row.supervisorId,
    isDeleted: row.is_deleted || false,
    deletedAt: row.deleted_at || null
  };
}

function mapSupervisorRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    role: row.role,
    roleTitle: row.role_title,
    assignedClassId: row.assigned_class_id,
    phone: row.phone || '',
    nationalId: row.national_id || '',
    qualification: row.qualification || '',
    specialty: row.specialty || '',
    isDeleted: row.is_deleted || false,
    deletedAt: row.deleted_at || null,
    hireDate: row.created_at?.split('T')[0] || ''
  };
}

function normalizePrayerRow(row, day) {
  return {
    fajr: 0,
    dhuhr: 0,
    asr: 0,
    maghrib: 0,
    isha: 0,
    sunnah: false,
    adhkar: false,
    salawat: false,
    guardianSignature: false,
    ...row,
    day
  };
}

function normalizePassport(passport) {
  if (!passport?.sections) return passport;

  return {
    ...passport,
    sections: passport.sections.map(section => ({
      ...section,
      pages: (section.pages || []).map(page => {
        if (page.type !== 'prayer_tracking') return page;
        const rowsByDay = new Map((page.prayerData || []).map(row => [row.day, row]));
        return {
          ...page,
          prayerData: ALL_WEEK_DAYS.map(day => normalizePrayerRow(rowsByDay.get(day), day))
        };
      })
    }))
  };
}

function mapStudentRow(row) {
  return {
    id: row.id,
    name: row.name,
    classId: row.class_id,
    status: row.status || 'approved',
    juzMemorized: row.juz_memorized ?? 0,
    guardianPhone: row.guardian_phone ?? '',
    tuitionPaid: row.tuition_paid ?? false,
    tuitionAmount: row.tuition_amount ?? 0,
    attendanceRecords: row.attendance_records ?? {},
    passport: normalizePassport(row.passport_data ?? null)
  };
}

function mapShiftRow(row, supervisors) {
  return {
    id: row.id,
    supervisorId: row.supervisor_id,
    supervisorName: supervisors.find(sup => sup.id === row.supervisor_id)?.name || 'مشرف غير معروف',
    date: row.shift_date,
    startTime: row.start_time?.slice(0, 5) || '',
    endTime: row.end_time?.slice(0, 5) || null,
    durationMinutes: row.duration_minutes,
    approved: row.approved || false
  };
}

const RUBRIC_LIMITS = {
  attendance: 10,
  recitation: 20,
  prayerFollowup: 10,
  lesson: 10,
  excellence: 10
};

function clampRubricValue(fieldKey: string, value: unknown): number {
  if (!(fieldKey in RUBRIC_LIMITS)) return 0;
  const max = RUBRIC_LIMITS[fieldKey as keyof typeof RUBRIC_LIMITS];
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.min(max, Math.max(0, Math.trunc(numericValue)));
}

function scopeStudentForRole(
  student,
  currentUser,
  isGeneralSupervisor: boolean
) {
  if (isGeneralSupervisor) return student;
  if (String(student.classId) !== String(currentUser?.assignedClassId)) return null;
  if (!['approved', 'pending_approval'].includes(student.status)) return null;

  return { ...student };
}

function createInitialRubric() {
  return DAYS_OF_WEEK.map((day) => ({
    day,
    attendance: 10,
    recitation: 18,
    prayerFollowup: 10,
    lesson: 9,
    excellence: 9,
    notes: 'ممتاز ومواظب'
  }));
}

function createDefaultRubricRecord(day) {
  return {
    day,
    attendance: 0,
    recitation: 0,
    prayerFollowup: 0,
    lesson: 0,
    excellence: 0,
    notes: ''
  };
}

function CenterDaysControl({ activeCenterDays, onToggle }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
      <span className="text-xs font-bold text-slate-700">تحديد أيام الدوام الرسمي للمركز:</span>
      {ALL_WEEK_DAYS.map(day => {
        const isActive = activeCenterDays.includes(day);
        return (
          <button
            key={day}
            type="button"
            onClick={() => onToggle(day)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              isActive
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
            aria-pressed={isActive}
          >
            {day}
          </button>
        );
      })}
    </div>
  );
}

function createInitialPassport(sectionCount = 3) {
  const passport = {
    sections: [
      {
        id: 'sec_1',
        title: 'القسم الأول (جزء عم)',
        pages: [
          {
            pageNumber: 1,
            type: 'prayer_tracking',
            prayerData: ALL_WEEK_DAYS.map((day) => ({
              day,
              fajr: 1,
              dhuhr: 1,
              asr: 2,
              maghrib: 1,
              isha: 1,
              sunnah: true,
              adhkar: true,
              salawat: day === 'الجمعة' || day === 'الأربعاء',
              guardianSignature: true
            }))
          },
          {
            pageNumber: 2,
            type: 'supervisor_rubric',
            title: 'تقييم الأسبوع الأول',
            records: createInitialRubric()
          },
          {
            pageNumber: 3,
            type: 'supervisor_rubric',
            title: 'تقييم الأسبوع الثاني',
            records: createInitialRubric()
          }
        ]
      },
      {
        id: 'sec_2',
        title: 'القسم الثاني (جزء تبارك)',
        pages: [
          {
            pageNumber: 4,
            type: 'prayer_tracking',
            prayerData: ALL_WEEK_DAYS.map((day) => ({
              day,
              fajr: 1,
              dhuhr: 2,
              asr: 1,
              maghrib: 1,
              isha: 2,
              sunnah: true,
              adhkar: false,
              salawat: false,
              guardianSignature: true
            }))
          },
          {
            pageNumber: 5,
            type: 'supervisor_rubric',
            title: 'تقييم الأسبوع الأول',
            records: createInitialRubric()
          },
          {
            pageNumber: 6,
            type: 'supervisor_rubric',
            title: 'تقييم الأسبوع الثاني',
            records: createInitialRubric()
          }
        ]
      },
      {
        id: 'sec_3',
        title: 'القسم الثالث (جزء قد سمع)',
        pages: [
          {
            pageNumber: 7,
            type: 'prayer_tracking',
            prayerData: ALL_WEEK_DAYS.map((day) => ({
              day,
              fajr: 2,
              dhuhr: 2,
              asr: 2,
              maghrib: 1,
              isha: 1,
              sunnah: false,
              adhkar: true,
              salawat: false,
              guardianSignature: false
            }))
          },
          {
            pageNumber: 8,
            type: 'supervisor_rubric',
            title: 'تقييم الأسبوع الأول',
            records: createInitialRubric()
          },
          {
            pageNumber: 9,
            type: 'supervisor_rubric',
            title: 'تقييم الأسبوع الثاني',
            records: createInitialRubric()
          }
        ]
      }
    ]
  };
  const targetCount = Math.max(1, Number(sectionCount) || 3);
  while (passport.sections.length < targetCount) {
    const index = passport.sections.length;
    const previous = passport.sections[index - 1];
    passport.sections.push({
      ...JSON.parse(JSON.stringify(previous)),
      id: `sec_${index + 1}`,
      title: `القسم ${index + 1}`,
      pages: previous.pages.map((page, pageIndex) => ({
        ...JSON.parse(JSON.stringify(page)),
        pageNumber: index * 3 + pageIndex + 1
      }))
    });
  }
  passport.sections = passport.sections.slice(0, targetCount);
  return passport;
}

// ==========================================
// Component: ClassesManagementView
// ==========================================
function ClassesManagementView({ classes, students, currentUser, onAddClass, onUpdateClass, onEditStudent, onDeleteStudent, onDeleteClass, isGeneralSupervisor }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const visibleClasses = useMemo(
    () => isGeneralSupervisor
      ? classes
      : classes.filter(cls => String(cls.id) === String(currentUser?.assignedClassId)),
    [classes, currentUser?.assignedClassId, isGeneralSupervisor]
  );
  const [selectedClassForView, setSelectedClassForView] = useState(
    isGeneralSupervisor ? classes[0]?.id || null : currentUser?.assignedClassId || null
  );

  useEffect(() => {
    setSelectedClassForView(isGeneralSupervisor ? visibleClasses[0]?.id || null : currentUser?.assignedClassId || null);
  }, [visibleClasses, currentUser?.assignedClassId, isGeneralSupervisor]);

  const [form, setForm] = useState({ name: '', room: '', capacity: 15, level: 'تأسيسي', curriculumJuz: '', sectionsCount: 3 });
  const [editForm, setEditForm] = useState({ name: '', room: '', capacity: 15, level: 'تأسيسي', curriculumJuz: '', sectionsCount: 3 });

  const activeClassStudents = useMemo(() => {
    return students.filter(s => s.classId === selectedClassForView && s.status === 'approved');
  }, [students, selectedClassForView]);

  const handleOpenEdit = (c, e) => {
    e.stopPropagation();
    setEditingClass(c);
    setEditForm({ name: c.name, room: c.room, capacity: c.capacity, level: c.level, curriculumJuz: c.curriculumJuz, sectionsCount: c.sectionsCount });
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editingClass) return;
    onUpdateClass({ ...editingClass, ...editForm, capacity: Number(editForm.capacity), sectionsCount: Number(editForm.sectionsCount) });
    setEditingClass(null);
  };

  const handleSubmitNew = (e) => {
    e.preventDefault();
    onAddClass({ ...form, capacity: Number(form.capacity), sectionsCount: Number(form.sectionsCount) });
    setForm({ name: '', room: '', capacity: 15, level: 'تأسيسي', curriculumJuz: '', sectionsCount: 3 });
    setIsOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-800" />
            <span>إدارة الشُعب والحلقات القرآنية</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            استعراض الشُعب، طاقتها الاستيعابية، وتوزيع الطلاب عليها مع إمكانية تعديلها.
          </p>
        </div>

        {isGeneralSupervisor && (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="px-4 py-2 rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء شُعبة جديدة</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {visibleClasses.map((cls) => {
          const classStudents = students.filter(s => s.classId === cls.id && s.status === 'approved');
          const isSelected = selectedClassForView === cls.id;
          const isFull = classStudents.length >= cls.capacity;

          return (
            <div
              key={cls.id}
              onClick={() => setSelectedClassForView(cls.id)}
              className={`p-5 rounded-3xl border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-emerald-50/50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                  : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                    {cls.level}
                  </span>
                  <h3 className="text-base font-black text-slate-900 mt-2">{cls.name}</h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{cls.room}</p>
                </div>

                {isGeneralSupervisor && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => handleOpenEdit(cls, e)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-emerald-800 hover:bg-slate-100 transition-colors"
                      title="تعديل بيانات الشعبة"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteClass(cls);
                      }}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                      title="نقل الشعبة إلى سلة المهملات"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">الطاقة الاستيعابية:</span>
                <span className={`font-bold font-mono ${isFull ? 'text-rose-600' : 'text-slate-700'}`}>
                  {classStudents.length} / {cls.capacity} طالب
                </span>
              </div>
              <p className="text-[11px] text-emerald-800 font-bold mt-2">المنهج: {cls.curriculumJuz || 'غير محدد'} · الأقسام: {cls.sectionsCount}</p>
            </div>
          );
        })}
      </div>

      {selectedClassForView && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-800" />
              <h3 className="text-sm font-black text-slate-900">
                طلاب: {classes.find(c => c.id === selectedClassForView)?.name} ({activeClassStudents.length})
              </h3>
            </div>
          </div>

          <div className="w-full overflow-x-auto -webkit-overflow-scrolling-touch">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100/80 text-slate-600 font-bold">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">اسم الطالب</th>
                  <th className="py-2.5 px-3 text-center">أجزاء الحفظ</th>
                  <th className="py-2.5 px-3 text-center">رقم ولي الأمر</th>
                  {isGeneralSupervisor && <th className="py-2.5 px-3 text-center">حالة الرسوم</th>}
                  {isGeneralSupervisor && <th className="py-2.5 px-3 text-center">الإجراء</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeClassStudents.map((st, idx) => (
                  <tr key={st.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{st.name}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-emerald-800">{st.juzMemorized} أجزاء</td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-700">{st.guardianPhone}</td>
                    {isGeneralSupervisor && <td className="py-2.5 px-3 text-center">
                      {st.tuitionPaid ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-bold">
                          مسدد (15 د.أ) ✓
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                          غير مسدد
                        </span>
                      )}

                      {(isOpen || editingClass) && (
                        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
                          <form
                            onSubmit={editingClass ? handleSaveEdit : handleSubmitNew}
                            className="bg-white rounded-3xl p-6 w-full max-w-md space-y-3"
                          >
                            <h3 className="font-black text-slate-900">{editingClass ? 'تعديل بيانات الشعبة' : 'إنشاء شعبة جديدة'}</h3>
                            {(editingClass ? editForm : form) && ['name', 'room', 'curriculumJuz'].map(field => (
                              <input
                                key={field}
                                required={field === 'name'}
                                placeholder={{ name: 'اسم الشعبة', room: 'الغرفة', curriculumJuz: 'المنهج / الأجزاء المقررة للشعبة' }[field]}
                                value={(editingClass ? editForm : form)[field]}
                                onChange={e => (editingClass ? setEditForm : setForm)(prev => ({ ...prev, [field]: e.target.value }))}
                                className="w-full px-3 py-2 border rounded-xl"
                              />
                            ))}
                            <div className="grid grid-cols-2 gap-3">
                              <input type="number" min="1" placeholder="السعة" value={(editingClass ? editForm : form).capacity} onChange={e => (editingClass ? setEditForm : setForm)(prev => ({ ...prev, capacity: e.target.value }))} className="px-3 py-2 border rounded-xl" />
                              <input type="number" min="1" placeholder="عدد الأقسام" value={(editingClass ? editForm : form).sectionsCount} onChange={e => (editingClass ? setEditForm : setForm)(prev => ({ ...prev, sectionsCount: e.target.value }))} className="px-3 py-2 border rounded-xl" />
                            </div>
                            <select value={(editingClass ? editForm : form).level} onChange={e => (editingClass ? setEditForm : setForm)(prev => ({ ...prev, level: e.target.value }))} className="w-full px-3 py-2 border rounded-xl">
                              <option>تأسيسي</option><option>متوسط</option><option>متقدم</option>
                            </select>
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => { setIsOpen(false); setEditingClass(null); }} className="px-4 py-2 rounded-xl bg-slate-100 font-bold">إلغاء</button>
                              <button type="submit" className="px-4 py-2 rounded-xl bg-emerald-800 text-white font-bold">حفظ</button>
                            </div>
                          </form>
                        </div>
                      )}
                    </td>}
                    {isGeneralSupervisor && <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onEditStudent(st)}
                          className="px-2 py-1 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 transition-all text-[11px] font-bold inline-flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>تعديل</span>
                        </button>
                        {isGeneralSupervisor && (
                          <button
                            type="button"
                            onClick={() => onDeleteStudent(st)}
                            className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-all"
                            title="حذف الطالب وإرساله لسلة المهملات"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>}
                  </tr>
                ))}
                {activeClassStudents.length === 0 && (
                  <tr>
                    <td colSpan={isGeneralSupervisor ? 6 : 4} className="py-8 text-center text-slate-400">
                      لا يوجد طلاب مقيدين في هذه الشُعبة حالياً.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editingClass && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-black text-slate-900 text-sm">تعديل بيانات الشُعبة</h3>
              <button type="button" onClick={() => setEditingClass(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">اسم الشُعبة</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">القاعة / الرقم</label>
                  <input
                    type="text"
                    required
                    value={editForm.room}
                    onChange={(e) => setEditForm({ ...editForm, room: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">السعة القصوى</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={editForm.capacity}
                    onChange={(e) => setEditForm({ ...editForm, capacity: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-600 font-bold mb-1">المستوى التعليمي</label>
                <select
                  value={editForm.level}
                  onChange={(e) => setEditForm({ ...editForm, level: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl bg-white"
                >
                  <option value="تأسيسي">تأسيسي</option>
                  <option value="متوسط">متوسط</option>
                  <option value="متقدم">متقدم</option>
                  <option value="إجازة وسند">إجازة وسند</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingClass(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-800 text-white hover:bg-emerald-900 font-bold"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-black text-slate-900 text-sm">إنشاء حلقة / شُعبة جديدة</h3>
              <button type="button" onClick={() => setIsOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitNew} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">اسم الشُعبة</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: شعبة الإمام الكسائي"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">القاعة / الرقم</label>
                  <input
                    type="text"
                    required
                    placeholder="قاعة 104"
                    value={form.room}
                    onChange={(e) => setForm({ ...form, room: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">السعة (عدد الطلاب)</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-600 font-bold mb-1">المستوى</label>
                <select
                  value={form.level}
                  onChange={(e) => setForm({ ...form, level: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl bg-white"
                >
                  <option value="تأسيسي">تأسيسي</option>
                  <option value="متوسط">متوسط</option>
                  <option value="متقدم">متقدم</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-800 text-white hover:bg-emerald-900 font-bold"
                >
                  إنشاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// Component: SupervisorsManagementView
// ==========================================
function SupervisorsManagementView({
  supervisors,
  classes,
  shifts,
  onAddSupervisor,
  onUpdateSupervisor,
  onDeleteSupervisor,
  onApproveShift,
  onUpdateShift
}) {
  const [activeSubTab, setActiveSubTab] = useState('list');
  const [isAddSupervisorOpen, setIsAddSupervisorOpen] = useState(false);
  const [editingSupervisor, setEditingSupervisor] = useState(null);
  const [editingShift, setEditingShift] = useState(null);

  const [supForm, setSupForm] = useState({
    name: '',
    username: '',
    password: '',
    showPassword: false,
    role: ROLES.CLASS_SUPERVISOR,
    assignedClassId: classes[0]?.id || '',
    phone: '',
    nationalId: '',
    qualification: '',
    specialty: ''
  });

  const [editSupForm, setEditSupForm] = useState({
    name: '',
    role: ROLES.CLASS_SUPERVISOR,
    assignedClassId: '',
    phone: '',
    nationalId: '',
    qualification: '',
    specialty: ''
  });

  const [shiftEditForm, setShiftEditForm] = useState({
    date: '',
    startTime: '',
    endTime: '',
    approved: true
  });

  const handleOpenEditSupervisor = (sup) => {
    setEditingSupervisor(sup);
    setEditSupForm({
      name: sup.name,
      role: sup.role,
      assignedClassId: sup.assignedClassId || '',
      phone: sup.phone || '',
      nationalId: sup.nationalId || '',
      qualification: sup.qualification || '',
      specialty: sup.specialty || ''
    });
  };

  const handleSaveEditSupervisor = (e) => {
    e.preventDefault();
    if (!editingSupervisor) return;
    onUpdateSupervisor({
      ...editingSupervisor,
      ...editSupForm,
      roleTitle: editSupForm.role === ROLES.GENERAL_SUPERVISOR ? 'المشرف العام' : 'مشرف شُعبة'
    });
    setEditingSupervisor(null);
  };

  const handleCreateSupervisor = async (e) => {
    e.preventDefault();
    const created = await onAddSupervisor({
      ...supForm,
      roleTitle: supForm.role === ROLES.GENERAL_SUPERVISOR ? 'المشرف العام' : 'مشرف شُعبة',
      hireDate: new Date().toISOString().split('T')[0]
    });
    if (created) {
      setIsAddSupervisorOpen(false);
      setSupForm({
        name: '',
        username: '',
        password: '',
        showPassword: false,
        role: ROLES.CLASS_SUPERVISOR,
        assignedClassId: classes[0]?.id || '',
        phone: '',
        nationalId: '',
        qualification: '',
        specialty: ''
      });
    }
  };

  const handleOpenEditShift = (shift) => {
    setEditingShift(shift);
    setShiftEditForm({
      date: shift.date,
      startTime: shift.startTime,
      endTime: shift.endTime || '',
      approved: shift.approved
    });
  };

  const handleSaveEditShift = (e) => {
    e.preventDefault();
    if (!editingShift) return;
    onUpdateShift({
      ...editingShift,
      date: shiftEditForm.date,
      startTime: shiftEditForm.startTime,
      endTime: shiftEditForm.endTime,
      approved: shiftEditForm.approved
    });
    setEditingShift(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-800" />
            <span>شؤون المشرفين ودوام الكادر التعليمي</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            إدارة بيانات المشرفين ومراجعة سجلات الدوام واعتمادها إدارياً.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveSubTab('list')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeSubTab === 'list' ? 'bg-white text-emerald-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              قائمة الكادر ({supervisors.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('shifts')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeSubTab === 'shifts' ? 'bg-white text-emerald-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              سجلات الدوام الفعلي ({shifts.length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setSupForm(prev => ({
                ...prev,
                assignedClassId: classes[classes.length - 1]?.id || prev.assignedClassId || ''
              }));
              setIsAddSupervisorOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            <span>إضافة مشرف جديد</span>
          </button>
        </div>
      </div>

      {activeSubTab === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {supervisors.map((sup) => (
            <div key={sup.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    sup.role === ROLES.GENERAL_SUPERVISOR ? 'bg-amber-100 text-amber-950' : 'bg-emerald-100 text-emerald-900'
                  }`}
                >
                  {sup.roleTitle}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenEditSupervisor(sup)}
                    className="p-1 rounded-lg text-slate-400 hover:text-emerald-800 hover:bg-slate-100 transition-colors"
                    title="تعديل بيانات المشرف"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {sup.role === ROLES.GENERAL_SUPERVISOR || sup.roleTitle === 'المشرف العام' ? (
                    <span
                      className="p-1 rounded-lg text-slate-300 cursor-not-allowed"
                      title="المشرف العام محمي ولا يمكن حذفه"
                      aria-label="المشرف العام محمي ولا يمكن حذفه"
                    >
                      <Shield className="w-3.5 h-3.5" />
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onDeleteSupervisor(sup)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="نقل المشرف لسلة المهملات"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-base font-black text-slate-900">{sup.name}</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{sup.phone || 'لا يوجد هاتف'}</p>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-2xl text-[11px] text-slate-600 space-y-1">
                <div>
                  <span className="text-slate-400">التخصص: </span>
                  <span className="font-bold">{sup.specialty || 'توجيه قرآني'}</span>
                </div>
                <div>
                  <span className="text-slate-400">المؤهل: </span>
                  <span>{sup.qualification || 'سند متصل'}</span>
                </div>
                {sup.assignedClassId && (
                  <div>
                    <span className="text-slate-400">الشعبة المسندة: </span>
                    <span className="font-bold text-emerald-800">
                      {classes.find(c => c.id === sup.assignedClassId)?.name}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeSubTab === 'shifts' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-900">سجلات الحضور والانصراف للكادر</h3>
          </div>
          <div className="w-full overflow-x-auto -webkit-overflow-scrolling-touch">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100/80 text-slate-600 font-bold">
                <tr>
                  <th className="py-2.5 px-3">المشرف</th>
                  <th className="py-2.5 px-3 text-center">التاريخ</th>
                  <th className="py-2.5 px-3 text-center">وقت الحضور</th>
                  <th className="py-2.5 px-3 text-center">وقت الانصراف</th>
                  <th className="py-2.5 px-3 text-center">المدة</th>
                  <th className="py-2.5 px-3 text-center">حالة الاعتماد</th>
                  <th className="py-2.5 px-3 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shifts.map((sh) => (
                  <tr key={sh.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-900">{sh.supervisorName}</td>
                    <td className="py-2.5 px-3 text-center font-mono">{sh.date}</td>
                    <td className="py-2.5 px-3 text-center font-mono text-emerald-800 font-bold">{sh.startTime}</td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-600">{sh.endTime || 'دوام جارٍ...'}</td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold">{sh.durationMinutes ? `${sh.durationMinutes} دقيقة` : '-'}</td>
                    <td className="py-2.5 px-3 text-center">
                      {sh.approved ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-bold">
                          معتمد إدارياً ✓
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-950 text-[10px] font-bold">
                          بانتظار الاعتماد
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {!sh.approved && (
                          <button
                            type="button"
                            onClick={() => onApproveShift(sh.id)}
                            className="px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-300"
                          >
                            اعتماد ✓
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenEditShift(sh)}
                          className="p-1 rounded-lg text-slate-400 hover:text-emerald-800 hover:bg-slate-100"
                          title="تعديل سجل الدوام"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editingShift && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-black text-slate-900 text-sm">تعديل سجل الدوام</h3>
              <button type="button" onClick={() => setEditingShift(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEditShift} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">التاريخ</label>
                <input
                  type="date"
                  required
                  value={shiftEditForm.date}
                  onChange={(e) => setShiftEditForm({ ...shiftEditForm, date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">وقت الحضور</label>
                  <input
                    type="time"
                    required
                    value={shiftEditForm.startTime}
                    onChange={(e) => setShiftEditForm({ ...shiftEditForm, startTime: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">وقت الانصراف</label>
                  <input
                    type="time"
                    value={shiftEditForm.endTime}
                    onChange={(e) => setShiftEditForm({ ...shiftEditForm, endTime: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={shiftEditForm.approved}
                  onChange={(e) => setShiftEditForm({ ...shiftEditForm, approved: e.target.checked })}
                  className="rounded text-emerald-800"
                />
                <span className="font-bold text-slate-700">اعتماد هذا الدوام إدارياً</span>
              </label>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingShift(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-800 text-white hover:bg-emerald-900 font-bold"
                >
                  حفظ السجل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingSupervisor && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-black text-slate-900 text-sm">تعديل بيانات المشرف</h3>
              <button type="button" onClick={() => setEditingSupervisor(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEditSupervisor} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">الاسم الرباعي</label>
                <input
                  type="text"
                  required
                  value={editSupForm.name}
                  onChange={(e) => setEditSupForm({ ...editSupForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">رقم الهاتف</label>
                  <input
                    type="tel"
                    required
                    value={editSupForm.phone}
                    onChange={(e) => setEditSupForm({ ...editSupForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">الرقم الوطني</label>
                  <input
                    type="text"
                    value={editSupForm.nationalId}
                    onChange={(e) => setEditSupForm({ ...editSupForm, nationalId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">الدور الإداري</label>
                  <select
                    value={editSupForm.role}
                    onChange={(e) => setEditSupForm({ ...editSupForm, role: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl bg-white"
                  >
                    <option value={ROLES.CLASS_SUPERVISOR}>مشرف شُعبة</option>
                    <option value={ROLES.GENERAL_SUPERVISOR}>المشرف العام</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">الشعبة المسندة</label>
                  <select
                    value={editSupForm.assignedClassId}
                    onChange={(e) => setEditSupForm({ ...editSupForm, assignedClassId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl bg-white"
                  >
                    <option value="">(بدون إسناد)</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-600 font-bold mb-1">المؤهل والتخصص</label>
                <input
                  type="text"
                  value={editSupForm.qualification}
                  onChange={(e) => setEditSupForm({ ...editSupForm, qualification: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl"
                  placeholder="المؤهل الشرعي"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingSupervisor(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-800 text-white hover:bg-emerald-900 font-bold"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddSupervisorOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-black text-slate-900 text-sm">إضافة مشرف جديد للكادر</h3>
              <button type="button" onClick={() => setIsAddSupervisorOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSupervisor} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">اسم المستخدم للدخول</label>
                  <input
                    type="text"
                    required
                    title="استخدم أحرفاً إنجليزية وأرقاماً و . _ - فقط"
                    placeholder="omar.kurd"
                    value={supForm.username}
                    onChange={(e) => setSupForm({
                      ...supForm,
                      username: e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, '')
                    })}
                    className="w-full px-3 py-2 border rounded-xl text-left"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">كلمة المرور للدخول</label>
                  <div className="relative">
                    <input
                      type={supForm.showPassword ? 'text' : 'password'}
                      required
                      minLength="8"
                      value={supForm.password}
                      onChange={(e) => setSupForm({ ...supForm, password: e.target.value })}
                      className="w-full px-3 py-2 pl-10 border rounded-xl text-left"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setSupForm({ ...supForm, showPassword: !supForm.showPassword })}
                      className="absolute left-0 top-0 min-h-10 min-w-10 text-slate-500"
                      aria-label={supForm.showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    >
                      {supForm.showPassword
                        ? <EyeOff className="mx-auto w-4 h-4" />
                        : <Eye className="mx-auto w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-slate-600 font-bold mb-1">الاسم الرباعي</label>
                <input
                  type="text"
                  required
                  placeholder="الاسم الكامل"
                  value={supForm.name}
                  onChange={(e) => setSupForm({ ...supForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">رقم الهاتف</label>
                  <input
                    type="tel"
                    required
                    placeholder="07xxxxxxxx"
                    value={supForm.phone}
                    onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">الرقم الوطني</label>
                  <input
                    type="text"
                    placeholder="الرقم الوطني"
                    value={supForm.nationalId}
                    onChange={(e) => setSupForm({ ...supForm, nationalId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">الصفة الإدارية</label>
                  <select
                    value={supForm.role}
                    onChange={(e) => setSupForm({ ...supForm, role: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl bg-white"
                  >
                    <option value={ROLES.CLASS_SUPERVISOR}>مشرف شُعبة</option>
                    <option value={ROLES.GENERAL_SUPERVISOR}>المشرف العام</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">الشعبة المسندة</label>
                  <select
                    value={supForm.assignedClassId}
                    onChange={(e) => setSupForm({ ...supForm, assignedClassId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl bg-white"
                  >
                    <option value="">(بدون إسناد)</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">المؤهل الشرعي</label>
                  <input
                    type="text"
                    required
                    placeholder="بكالوريوس شريعة أو إجازة قرآنية"
                    value={supForm.qualification}
                    onChange={(e) => setSupForm({ ...supForm, qualification: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">التخصص</label>
                  <input
                    type="text"
                    required
                    placeholder="التجويد والتلقين"
                    value={supForm.specialty}
                    onChange={(e) => setSupForm({ ...supForm, specialty: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddSupervisorOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-800 text-white hover:bg-emerald-900 font-bold"
                >
                  إضافة المشرف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// Component: StudentEditModal
// ==========================================
function StudentEditModal({ student, classes, onClose, onSave }) {
  const [name, setName] = useState(student.name);
  const [classId, setClassId] = useState(student.classId);
  const [juzMemorized, setJuzMemorized] = useState(student.juzMemorized);
  const [guardianPhone, setGuardianPhone] = useState(student.guardianPhone);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...student,
      name,
      classId,
      juzMemorized: Number(juzMemorized),
      guardianPhone
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b pb-3 border-slate-100">
          <h3 className="font-black text-slate-900 text-sm">تعديل بيانات الطالب</h3>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-600 font-bold mb-1">اسم الطالب الرباعي</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 font-bold mb-1">الشُعبة</label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl bg-white"
              >
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-600 font-bold mb-1">الأجزاء المحفوظة</label>
              <input
                type="number"
                min="0"
                max="30"
                required
                value={juzMemorized}
                onChange={(e) => setJuzMemorized(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>
          </div>
          <div>
            <label className="block text-slate-600 font-bold mb-1">هاتف ولي الأمر</label>
            <input
              type="tel"
              required
              value={guardianPhone}
              onChange={(e) => setGuardianPhone(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-800 text-white hover:bg-emerald-900 font-bold"
            >
              حفظ التعديلات
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// Component: StudentEnrollModal
// ==========================================
function StudentEnrollModal({ classes, currentUser, onClose, onEnroll }) {
  const isGeneral = currentUser?.role === ROLES.GENERAL_SUPERVISOR || currentUser?.role === ROLES.IT_ADMIN;
  const defaultClass = isGeneral ? classes[0]?.id : (currentUser?.assignedClassId || classes[0]?.id);

  const [name, setName] = useState('');
  const [classId, setClassId] = useState(defaultClass);
  const [juzMemorized, setJuzMemorized] = useState(1);
  const [guardianPhone, setGuardianPhone] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!isGeneral) {
      setClassId(currentUser?.assignedClassId || '');
    }
  }, [isGeneral, currentUser?.assignedClassId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isGeneral && !currentUser?.assignedClassId) {
      setFormError('لم يتم إسناد شُعبة لحسابك بعد، يرجى مراجعة المشرف العام');
      return;
    }
    setFormError('');
    onEnroll({
      name,
      classId: isGeneral ? classId : currentUser.assignedClassId,
      juzMemorized: Number(juzMemorized),
      guardianPhone
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b pb-3 border-slate-100">
          <h3 className="font-black text-slate-900 text-sm">تسجيل طالب جديد</h3>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isGeneral && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900">
            <p className="font-bold">تنبيه لمشرف الشُعبة:</p>
            <p className="text-[11px] mt-0.5">
              سيتم إدراج الطالب بحالة "بانتظار اعتماد المشرف العام"، ولن يُنشأ له دفتر جواز سفر حتى يتم اعتماده رسمياً.
            </p>
          </div>
        )}
        {formError && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-xs text-rose-800 font-bold">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-600 font-bold mb-1">اسم الطالب الرباعي</label>
            <input
              type="text"
              required
              placeholder="مثال: عبد الله أحمد حسن"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 font-bold mb-1">الشُعبة</label>
              <select
                disabled={!isGeneral}
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl bg-white disabled:bg-slate-100"
              >
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-600 font-bold mb-1">الأجزاء المحفوظة</label>
              <input
                type="number"
                min="0"
                max="30"
                required
                value={juzMemorized}
                onChange={(e) => setJuzMemorized(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl"
              />
            </div>
          </div>
          <div>
            <label className="block text-slate-600 font-bold mb-1">رقم هاتف ولي الأمر</label>
            <input
              type="tel"
              required
              placeholder="07xxxxxxxx"
              value={guardianPhone}
              onChange={(e) => setGuardianPhone(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-800 text-white hover:bg-emerald-900 font-bold"
            >
              تسجيل الطالب
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// Component: StudentPassportView (Fixed Indexing & Rubric Update)
// ==========================================
function StudentPassportView({
  students,
  classes,
  currentUser,
  activeStudentId,
  onSelectStudent,
  onUpdatePassport,
  isGeneralSupervisor,
  activeCenterDays,
  onToggleCenterDay
}) {
  // Multi-class filter state
  const [selectedClassIds, setSelectedClassIds] = useState(
    isGeneralSupervisor ? ['all'] : (currentUser?.assignedClassId ? [currentUser.assignedClassId] : [])
  );

  // Sync class filter if role changes
  useEffect(() => {
    if (isGeneralSupervisor) {
      setSelectedClassIds(['all']);
    } else {
      setSelectedClassIds(currentUser?.assignedClassId ? [currentUser.assignedClassId] : []);
    }
  }, [isGeneralSupervisor, currentUser?.assignedClassId]);

  const toggleClassFilter = (classId) => {
    if (classId === 'all') {
      setSelectedClassIds(['all']);
      return;
    }
    let updated = selectedClassIds.filter(id => id !== 'all');
    if (updated.includes(classId)) {
      updated = updated.filter(id => id !== classId);
      if (updated.length === 0) updated = ['all'];
    } else {
      updated.push(classId);
    }
    setSelectedClassIds(updated);
  };

  const eligibleStudents = useMemo(() => {
    const visibleStudents = students.filter(s => ['approved', 'pending_approval'].includes(s.status));
    if (selectedClassIds.includes('all')) {
      return isGeneralSupervisor
        ? visibleStudents
        : visibleStudents.filter(s => String(s.classId) === String(currentUser?.assignedClassId));
    }
    return visibleStudents.filter(s => selectedClassIds.some(id => String(id) === String(s.classId)));
  }, [students, selectedClassIds, isGeneralSupervisor, currentUser]);

  const activeStudent = useMemo(() => {
    const approvedStudents = eligibleStudents.filter(s => s.status === 'approved' && s.passport);
    const found = approvedStudents.find(s => s.id === activeStudentId);
    return found || approvedStudents[0] || null;
  }, [eligibleStudents, activeStudentId]);

  const [activeGlobalPageIndex, setActiveGlobalPageIndex] = useState(0);

  useEffect(() => {
    setActiveGlobalPageIndex(0);
  }, [activeStudent?.id]);

  // Accurate flatten mapping containing both sectionIndex and pageIndexInSec
  const flatPages = useMemo(() => {
    if (!activeStudent?.passport?.sections) return [];
    const list = [];
    activeStudent.passport.sections.forEach((sec, secIdx) => {
      sec.pages.forEach((p, pIdx) => {
        list.push({
          sectionIndex: secIdx,
          pageIndexInSec: pIdx,
          sectionTitle: sec.title,
          pageNumber: (secIdx * 3) + (pIdx + 1),
          type: p.type,
          pageData: p
        });
      });
    });
    return list;
  }, [activeStudent]);

  const currentPage = flatPages[activeGlobalPageIndex] || flatPages[0];
  const displayedRubricRecords = useMemo(() => {
    if (currentPage?.type !== 'supervisor_rubric') return [];
    const recordsByDay = new Map((currentPage.pageData.records || []).map(record => [record.day, record]));
    return activeCenterDays.map(day => recordsByDay.get(day) || createDefaultRubricRecord(day));
  }, [currentPage, activeCenterDays]);

  const handleNextPage = () => {
    if (activeGlobalPageIndex < flatPages.length - 1) {
      setActiveGlobalPageIndex(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (activeGlobalPageIndex > 0) {
      setActiveGlobalPageIndex(prev => prev - 1);
    }
  };

  const handlePrayerChange = (dayIdx, prayerKey, val) => {
    if (!activeStudent || !currentPage) return;
    const newPassport = JSON.parse(JSON.stringify(activeStudent.passport));
    const page = newPassport.sections[currentPage.sectionIndex]?.pages[currentPage.pageIndexInSec];
    if (page?.prayerData) {
      page.prayerData[dayIdx][prayerKey] = val;
      onUpdatePassport(activeStudent.id, newPassport);
    }
  };

  const handlePrayerCheckboxChange = (dayIdx, fieldKey, val) => {
    if (!activeStudent || !currentPage) return;
    const newPassport = JSON.parse(JSON.stringify(activeStudent.passport));
    const page = newPassport.sections[currentPage.sectionIndex]?.pages[currentPage.pageIndexInSec];
    if (page?.prayerData) {
      page.prayerData[dayIdx][fieldKey] = val;
      onUpdatePassport(activeStudent.id, newPassport);
    }
  };

  const handleRubricChange = (day, fieldKey, val) => {
    if (!activeStudent || !currentPage) return;
    const newPassport = JSON.parse(JSON.stringify(activeStudent.passport));
    const page = newPassport.sections[currentPage.sectionIndex]?.pages[currentPage.pageIndexInSec];
    if (page?.records) {
      let record = page.records.find(item => item.day === day);
      if (!record) {
        record = createDefaultRubricRecord(day);
        page.records.push(record);
      }
      record[fieldKey] = fieldKey in RUBRIC_LIMITS
        ? clampRubricValue(fieldKey, val)
        : String(val).slice(0, 500);
      onUpdatePassport(activeStudent.id, newPassport);
    }
  };

  const handleSetFullRubric = (day) => {
    if (!activeStudent || !currentPage) return;
    const newPassport = JSON.parse(JSON.stringify(activeStudent.passport));
    const page = newPassport.sections[currentPage.sectionIndex]?.pages[currentPage.pageIndexInSec];
    if (page?.records) {
      let record = page.records.find(item => item.day === day);
      if (!record) {
        record = createDefaultRubricRecord(day);
        page.records.push(record);
      }
      record.attendance = 10;
      record.recitation = 20;
      record.prayerFollowup = 10;
      record.lesson = 10;
      record.excellence = 10;
      onUpdatePassport(activeStudent.id, newPassport);
    }
  };

  // Calculate passport page statistics
  const currentTotalRubricScore = useMemo(() => {
    if (currentPage?.type !== 'supervisor_rubric') return 0;
    return displayedRubricRecords.reduce((acc, curr) => {
      return acc + (Number(curr.attendance) || 0) +
        (Number(curr.recitation) || 0) +
        (Number(curr.prayerFollowup) || 0) +
        (Number(curr.lesson) || 0) +
        (Number(curr.excellence) || 0);
    }, 0);
  }, [currentPage, displayedRubricRecords]);

  const activeStudentClass = useMemo(() => {
    return classes.find(c => c.id === activeStudent?.classId);
  }, [classes, activeStudent]);

  const updatePassportSection = (sectionIndex, changes) => {
    if (!activeStudent) return;
    const newPassport = JSON.parse(JSON.stringify(activeStudent.passport));
    newPassport.sections[sectionIndex] = { ...newPassport.sections[sectionIndex], ...changes };
    onUpdatePassport(activeStudent.id, newPassport);
  };

  const handleSectionCountChange = (delta) => {
    if (!isGeneralSupervisor || !activeStudent) return;
    const newPassport = JSON.parse(JSON.stringify(activeStudent.passport));
    if (delta > 0) {
      const index = newPassport.sections.length;
      newPassport.sections.push({
        id: `sec_${Date.now()}`,
        title: `القسم ${index + 1}${activeStudentClass?.curriculumJuz ? ` (${activeStudentClass.curriculumJuz})` : ''}`,
        pages: [
          { pageNumber: index * 3 + 1, type: 'prayer_tracking', prayerData: ALL_WEEK_DAYS.map(day => normalizePrayerRow(null, day)) },
          { pageNumber: index * 3 + 2, type: 'supervisor_rubric', title: 'تقييم الأسبوع الأول', records: createInitialRubric() },
          { pageNumber: index * 3 + 3, type: 'supervisor_rubric', title: 'تقييم الأسبوع الثاني', records: createInitialRubric() }
        ]
      });
    } else if (newPassport.sections.length > 1) {
      newPassport.sections.pop();
      setActiveGlobalPageIndex(Math.min(activeGlobalPageIndex, newPassport.sections.length * 3 - 1));
    }
    onUpdatePassport(activeStudent.id, newPassport);
  };

  return (
    <div className="space-y-6">
      {/* Class Selector & Multiple Filter Bar */}
      <div className="bg-white/95 backdrop-blur-md p-5 rounded-3xl border border-emerald-900/10 shadow-sm space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-900 text-amber-300 flex items-center justify-center shadow-xs">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-black text-slate-800 block">
                تصفية الشُعب القرآنية لعرض جوازات السفر
              </span>
              <span className="text-[10px] text-slate-400">انقر لتحديد شُعبة أو عدة شُعب لعرض دفاتر طلابها</span>
            </div>
          </div>
          <span className="text-xs text-emerald-900 font-bold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/60 font-mono">
            {eligibleStudents.length} طلاب مؤهلين
          </span>
        </div>

        {/* Multi-Select Pills for Classes */}
        <div className="flex flex-wrap items-center gap-2">
          {isGeneralSupervisor && (
            <button
              type="button"
              onClick={() => toggleClassFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedClassIds.includes('all')
                  ? 'bg-emerald-900 text-amber-300 shadow-md ring-2 ring-emerald-800/40'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              كل الشُعب ({classes.length})
            </button>
          )}

          {classes.map((cls) => {
            const isAssigned = isGeneralSupervisor || cls.id === currentUser?.assignedClassId;
            if (!isAssigned) return null;
            const isSelected = selectedClassIds.includes(cls.id) || (selectedClassIds.includes('all') && isGeneralSupervisor);
            const count = students.filter(s => s.classId === cls.id && s.status === 'approved').length;

            return (
              <button
                key={cls.id}
                type="button"
                onClick={() => isGeneralSupervisor && toggleClassFilter(cls.id)}
                disabled={!isGeneralSupervisor}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  isSelected && !selectedClassIds.includes('all')
                    ? 'bg-emerald-900 text-amber-300 shadow-md ring-2 ring-amber-400/30'
                    : selectedClassIds.includes('all')
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100/70'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{cls.name}</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                  isSelected && !selectedClassIds.includes('all') ? 'bg-emerald-950 text-amber-300' : 'bg-slate-200/90 text-slate-700'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Student Selection Chips (Quick Multi-Switch) */}
        {eligibleStudents.length > 0 && (
          <div className="pt-2.5 border-t border-slate-100">
            <span className="text-[11px] text-slate-400 font-bold block mb-2">اختر طالباً لتصفح جوازه:</span>
            <div className="flex flex-wrap items-center gap-1.5 max-h-36 overflow-y-auto pr-0.5">
              {eligibleStudents.map((st) => {
                const isActive = activeStudent?.id === st.id;
                const studentClass = classes.find(c => c.id === st.classId);
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => onSelectStudent(st.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                      isActive
                        ? 'bg-amber-400 text-emerald-950 ring-2 ring-amber-500/50 shadow-md font-black scale-[1.02]'
                        : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-900'
                    }`}
                  >
                    <span>{st.name}</span>
                    {st.status === 'pending_approval' && (
                      <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">
                        بانتظار اعتماد المشرف العام
                      </span>
                    )}
                    <span className="text-[10px] opacity-75 font-normal font-mono">({studentClass?.name.replace('شعبة الإمام ', '')})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {!activeStudent ? (
        <div className="bg-white p-16 rounded-3xl border border-slate-200 text-center text-slate-400">
          لا يوجد طلاب معتمدين مسجلين في الشُعب المحددة حالياً.
        </div>
      ) : (
        /* Real Book Passport Container */
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-b from-[#0d2a1d] via-[#092016] to-[#04120c] p-3 sm:p-7 shadow-2xl border-4 border-amber-500/30">
          {/* Islamic Decorative Corners */}
          <div className="absolute top-2 right-2 text-amber-400/20 pointer-events-none select-none text-2xl">❖</div>
          <div className="absolute top-2 left-2 text-amber-400/20 pointer-events-none select-none text-2xl">❖</div>
          <div className="absolute bottom-2 right-2 text-amber-400/20 pointer-events-none select-none text-2xl">❖</div>
          <div className="absolute bottom-2 left-2 text-amber-400/20 pointer-events-none select-none text-2xl">❖</div>

          {/* Top Passport Header (Leather Book Style) */}
          <div className="relative z-10 bg-gradient-to-r from-emerald-900/90 via-emerald-800/95 to-emerald-900/90 border border-amber-400/40 rounded-2xl p-4 sm:p-5 text-amber-100 shadow-lg mb-6 backdrop-blur-md">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-right">
                <div className="w-14 h-14 rounded-2xl bg-amber-400 text-emerald-950 flex items-center justify-center font-black shadow-md border-2 border-amber-300">
                  <BookOpen className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] tracking-widest uppercase bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30">
                      جواز سفر قرآني رسمي
                    </span>
                    <span className="text-[10px] text-emerald-300 font-mono">رقم القيد: #{activeStudent.id.toUpperCase()}</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-amber-200 mt-1">{activeStudent.name}</h2>
                  <p className="text-xs text-emerald-200 flex items-center gap-2 mt-0.5">
                    <span>{activeStudentClass?.name}</span>
                    <span>•</span>
                    <span className="font-mono">{activeStudentClass?.room}</span>
                  </p>
                </div>
              </div>

              {/* Passport Official Badge Details */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-emerald-950/60 p-2.5 rounded-xl border border-amber-400/25">
                <div className="text-center px-3 py-1 bg-emerald-900/80 rounded-lg border border-emerald-700/50">
                  <span className="text-[10px] text-emerald-300 block">المحفوظ</span>
                  <span className="text-sm font-black font-mono text-amber-300">{activeStudent.juzMemorized} أجزاء</span>
                </div>
                <div className="text-center px-3 py-1 bg-emerald-900/80 rounded-lg border border-emerald-700/50">
                  <span className="text-[10px] text-emerald-300 block">حالة الاشتراك</span>
                  <span className={`text-[11px] font-bold ${activeStudent.tuitionPaid ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {activeStudent.tuitionPaid ? 'مسدد ✓' : 'غير مسدد'}
                  </span>
                </div>
                <div className="text-center px-3 py-1 bg-emerald-900/80 rounded-lg border border-emerald-700/50">
                  <span className="text-[10px] text-emerald-300 block">ولي الأمر</span>
                  <span className="text-[11px] font-mono text-slate-200">{activeStudent.guardianPhone}</span>
                </div>
                <div className="hidden sm:flex items-center justify-center p-2 text-amber-400" title="الختم الرقمي المعتمد">
                  <Stamp className="w-6 h-6 opacity-80" />
                </div>
              </div>
            </div>
          </div>

          {/* Booklet Navigation Controls Bar */}
          <div className="relative z-10 bg-emerald-950/90 border border-emerald-800/80 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-lg mb-6 backdrop-blur-md">
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={activeGlobalPageIndex === 0}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-900/90 hover:bg-amber-400 hover:text-emerald-950 text-emerald-100 disabled:opacity-30 disabled:hover:bg-emerald-900 disabled:hover:text-emerald-100 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all shadow-sm"
            >
              <ChevronRight className="w-4 h-4" />
              <span>الصفحة السابقة</span>
            </button>

            {/* Sections Booklet Tabs (Pages 1-3, 4-6, 7-9) */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {isGeneralSupervisor && (
                <div className="flex gap-1">
                  <button type="button" onClick={() => handleSectionCountChange(1)} className="px-2 py-1 rounded-xl bg-amber-400 text-emerald-950 text-[10px] font-black">+ إضافة قسم جديد</button>
                  <button type="button" onClick={() => handleSectionCountChange(-1)} disabled={activeStudent.passport.sections.length <= 1} className="px-2 py-1 rounded-xl bg-rose-100 text-rose-800 text-[10px] font-black disabled:opacity-40">- تقليص آخر قسم</button>
                </div>
              )}
              {activeStudent.passport?.sections.map((sec, secIdx) => {
                const startPage = secIdx * 3 + 1;
                const isCurrentSection = Math.floor(activeGlobalPageIndex / 3) === secIdx;

                return (
                  <div
                    key={sec.id}
                    className={`flex items-center gap-1.5 p-1 rounded-xl border transition-all ${
                      isCurrentSection
                        ? 'bg-emerald-900/90 border-amber-400/50 shadow-sm'
                        : 'bg-emerald-950/60 border-emerald-800/40 opacity-75 hover:opacity-100'
                    }`}
                  >
                    <span className="text-[10px] text-amber-300 font-bold px-1.5 hidden sm:inline">{sec.title}:</span>
                    {[0, 1, 2].map((offset) => {
                      const pNum = startPage + offset;
                      const idx = (secIdx * 3) + offset;
                      const isActive = activeGlobalPageIndex === idx;
                      return (
                        <button
                          key={pNum}
                          type="button"
                          onClick={() => setActiveGlobalPageIndex(idx)}
                          className={`w-7 h-7 rounded-lg text-xs font-bold font-mono transition-all flex items-center justify-center ${
                            isActive
                              ? 'bg-amber-400 text-emerald-950 font-black shadow-md ring-2 ring-amber-300/50 scale-105'
                              : 'bg-emerald-900/70 text-emerald-200 hover:bg-emerald-800 hover:text-white'
                          }`}
                        >
                          {pNum}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleNextPage}
              disabled={activeGlobalPageIndex >= flatPages.length - 1}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-900/90 hover:bg-amber-400 hover:text-emerald-950 text-emerald-100 disabled:opacity-30 disabled:hover:bg-emerald-900 disabled:hover:text-emerald-100 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all shadow-sm"
            >
              <span>الصفحة التالية</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Current Page Content Paper (Realistic Parchment / Islamic Page Theme) */}
          {currentPage && (
            <div className="relative z-10 bg-[#fdfbf7] rounded-3xl border-2 border-amber-300/70 shadow-2xl overflow-hidden text-slate-800">
              {/* Paper Watermark / Header Motif */}
              <div className="bg-gradient-to-r from-amber-50 via-emerald-50/50 to-amber-50 px-6 py-4 border-b border-amber-200/80 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-900 text-amber-300 flex items-center justify-center font-black text-xs font-mono shadow-sm">
                    {currentPage.pageNumber}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-emerald-950 flex items-center gap-2">
                      {isGeneralSupervisor ? (
                        <input
                          value={activeStudent.passport.sections[currentPage.sectionIndex]?.title || ''}
                          onChange={e => updatePassportSection(currentPage.sectionIndex, { title: e.target.value })}
                          className="bg-transparent border-b border-emerald-300/50 outline-none font-black w-40"
                        />
                      ) : <span>{activeStudentClass?.curriculumJuz || currentPage.sectionTitle}</span>}
                      <span className="text-amber-600 font-normal">•</span>
                      <span className="text-emerald-800">
                        {currentPage.type === 'prayer_tracking' ? 'سجل متابعة الصلاة والأذكار الأسبوعي' : currentPage.pageData.title}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {currentPage.type === 'prayer_tracking'
                        ? 'متابعة أداء الصلوات في المسجد أو في وقتها مع السنن اليومية'
                        : 'معايير التقييم اليومي المعتمدة من المشرف (المجموع: 60 نقطة)'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-[10px] font-bold text-emerald-900">
                    <div className="flex items-center gap-1">
                      <span>البداية</span>
                      <input type="date" value={activeStudent.passport.sections[currentPage.sectionIndex]?.startDate || ''} onChange={e => {
                        const startDate = e.target.value;
                        const end = new Date(`${startDate}T00:00:00`);
                        end.setDate(end.getDate() + 7);
                        updatePassportSection(currentPage.sectionIndex, { startDate, endDate: end.toISOString().split('T')[0] });
                      }} className="px-1 py-1 rounded-lg border border-amber-200 bg-white" />
                      <span>النهاية</span>
                      <input type="date" value={activeStudent.passport.sections[currentPage.sectionIndex]?.endDate || ''} onChange={e => updatePassportSection(currentPage.sectionIndex, { endDate: e.target.value })} className="px-1 py-1 rounded-lg border border-amber-200 bg-white" />
                    </div>
                    <span>{formatSectionPeriod(activeStudent.passport.sections[currentPage.sectionIndex]?.startDate, activeStudent.passport.sections[currentPage.sectionIndex]?.endDate)}</span>
                  </div>
                </div>

                {currentPage.type === 'supervisor_rubric' && (
                  <div className="flex items-center gap-2 bg-emerald-900 text-amber-200 px-3.5 py-1.5 rounded-xl text-xs font-bold border border-amber-400/40 shadow-xs">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span>مجموع نقاط الصفحة:</span>
                    <span className="font-mono text-sm text-white font-black">{currentTotalRubricScore} / {activeCenterDays.length * 60}</span>
                  </div>
                )}
              </div>

              {/* Inside Page Content */}
              <div className="p-5 sm:p-6">
                {/* Page 1, 4, 7: Prayer Tracking */}
                {currentPage.type === 'prayer_tracking' && (
                  <div className="space-y-4">
                    {/* Guidance / Legend Bar */}
                    <div className="text-xs bg-amber-50/90 p-3.5 rounded-2xl border border-amber-200 flex flex-wrap items-center justify-between gap-3 text-amber-950 shadow-xs">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="font-black text-amber-900">دليل خيارات تسجيل الصلاة:</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1.5 bg-emerald-600 text-white font-bold px-2.5 py-1 rounded-xl shadow-xs">
                          <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">①</span>
                          <span>المسجد (جماعة)</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 bg-blue-600 text-white font-bold px-2.5 py-1 rounded-xl shadow-xs">
                          <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">②</span>
                          <span>على وقتها بالبيت</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 bg-rose-600 text-white font-bold px-2.5 py-1 rounded-xl shadow-xs">
                          <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">③</span>
                          <span>فائتة / قضاء</span>
                        </span>
                      </div>
                    </div>

                    <div className="w-full overflow-x-auto -webkit-overflow-scrolling-touch rounded-2xl border border-amber-200/80 shadow-xs">
                      <table className="w-full text-center text-xs">
                        <thead className="bg-[#f5ede0] text-emerald-950 font-black border-b border-amber-200">
                          <tr>
                            <th className="py-3 px-3 text-right">اليوم</th>
                            {PRAYERS_LIST.map(p => (
                              <th key={p.key} className="py-3 px-2 min-w-[105px]">{p.label}</th>
                            ))}
                            <th className="py-3 px-2 min-w-[90px]">السنن (10-12)</th>
                            <th className="py-3 px-2 min-w-[90px]">الأذكار</th>
                            <th className="py-3 px-2 min-w-[110px]">الصلاة على النبي ﷺ</th>
                            <th className="py-3 px-2 min-w-[110px]">توقيع ولي الأمر</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100/90 bg-white">
                          {currentPage.pageData.prayerData.map((row, dIdx) => (
                            <tr key={row.day} className="hover:bg-amber-50/50 transition-colors">
                              <td className="py-3.5 px-3 text-right font-black text-emerald-950 text-sm whitespace-nowrap">
                                {row.day}
                              </td>
                              {PRAYERS_LIST.map(p => {
                                const val = row[p.key] || 0;
                                return (
                                  <td key={p.key} className="py-2.5 px-1.5">
                                    <div className="inline-flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/90 shadow-2xs gap-0.5">
                                      <button
                                        type="button"
                                        onClick={() => handlePrayerChange(dIdx, p.key, 1)}
                                        className={`px-2 py-1 rounded-xl font-bold transition-all flex items-center gap-1 text-[11px] ${
                                          val === 1
                                            ? 'bg-emerald-600 text-white shadow-xs font-black scale-105'
                                            : 'text-slate-600 hover:text-emerald-700 hover:bg-slate-200/70'
                                        }`}
                                        title="في المسجد جماعة"
                                      >
                                        <span>مسجد</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handlePrayerChange(dIdx, p.key, 2)}
                                        className={`px-2 py-1 rounded-xl font-bold transition-all flex items-center gap-1 text-[11px] ${
                                          val === 2
                                            ? 'bg-blue-600 text-white shadow-xs font-black scale-105'
                                            : 'text-slate-600 hover:text-blue-700 hover:bg-slate-200/70'
                                        }`}
                                        title="على وقتها في البيت"
                                      >
                                        <span>وقتها</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handlePrayerChange(dIdx, p.key, 3)}
                                        className={`w-6 h-6 rounded-xl font-bold transition-all flex items-center justify-center text-[11px] ${
                                          val === 3
                                            ? 'bg-rose-600 text-white shadow-xs font-black scale-105'
                                            : 'text-slate-400 hover:text-rose-700 hover:bg-rose-50'
                                        }`}
                                        title="فائتة أو قضاء"
                                      >
                                        <span>✕</span>
                                      </button>
                                    </div>
                                  </td>
                                );
                              })}
                              {/* Sunnah Toggle Button */}
                              <td className="py-2.5 px-2">
                                <button
                                  type="button"
                                  onClick={() => handlePrayerCheckboxChange(dIdx, 'sunnah', !row.sunnah)}
                                  className={`w-full py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all flex items-center justify-center gap-1 shadow-2xs ${
                                    row.sunnah
                                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300 ring-1 ring-emerald-400/50'
                                      : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  <Sun className={`w-3.5 h-3.5 ${row.sunnah ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
                                  <span>{row.sunnah ? 'أُدّيت ✓' : 'لم تؤدَّ'}</span>
                                </button>
                              </td>
                              {/* Adhkar Toggle Button */}
                              <td className="py-2.5 px-2">
                                <button
                                  type="button"
                                  onClick={() => handlePrayerCheckboxChange(dIdx, 'adhkar', !row.adhkar)}
                                  className={`w-full py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all flex items-center justify-center gap-1 shadow-2xs ${
                                    row.adhkar
                                      ? 'bg-teal-100 text-teal-900 border-teal-300 ring-1 ring-teal-400/50'
                                      : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  <BookmarkCheck className={`w-3.5 h-3.5 ${row.adhkar ? 'text-teal-600' : 'text-slate-400'}`} />
                                  <span>{row.adhkar ? 'مواظب ✓' : 'متروكة'}</span>
                                </button>
                              </td>
                              {/* Salawat Toggle Button */}
                              <td className="py-2.5 px-2">
                                <button
                                  type="button"
                                  onClick={() => handlePrayerCheckboxChange(dIdx, 'salawat', !row.salawat)}
                                  className={`w-full py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all flex items-center justify-center gap-1 shadow-2xs ${
                                    row.salawat
                                      ? 'bg-amber-100 text-amber-950 border-amber-300 ring-1 ring-amber-400/50'
                                      : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  <HeartHandshake className={`w-3.5 h-3.5 ${row.salawat ? 'text-amber-600' : 'text-slate-400'}`} />
                                  <span>{row.salawat ? '200 صلاة ✓' : 'لم تُنجز'}</span>
                                </button>
                              </td>
                              {/* Guardian Signature Toggle Button */}
                              <td className="py-2.5 px-2">
                                <button
                                  type="button"
                                  onClick={() => handlePrayerCheckboxChange(dIdx, 'guardianSignature', !row.guardianSignature)}
                                  className={`w-full py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all flex items-center justify-center gap-1 shadow-2xs ${
                                    row.guardianSignature
                                      ? 'bg-purple-100 text-purple-950 border-purple-300 ring-1 ring-purple-400/50'
                                      : 'bg-slate-50 text-slate-400 border-dashed border-slate-300 hover:bg-purple-50 hover:text-purple-700'
                                  }`}
                                >
                                  <PenTool className={`w-3.5 h-3.5 ${row.guardianSignature ? 'text-purple-600' : 'text-slate-400'}`} />
                                  <span>{row.guardianSignature ? 'تم التوقيع ✓' : 'بانتظار الولي'}</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Pages 2, 3, 5, 6, 8, 9: Supervisor Evaluation Rubric */}
                {currentPage.type === 'supervisor_rubric' && (
                  <div className="space-y-4">
                    {isGeneralSupervisor && (
                      <CenterDaysControl
                        activeCenterDays={activeCenterDays}
                        onToggle={onToggleCenterDay}
                      />
                    )}
                    <div className="w-full overflow-x-auto -webkit-overflow-scrolling-touch rounded-2xl border border-amber-200/80 shadow-xs">
                      <table className="w-full text-center text-xs">
                        <thead className="bg-[#f5ede0] text-emerald-950 font-black border-b border-amber-200">
                          <tr>
                            <th className="py-3 px-3 text-right">اليوم</th>
                            <th className="py-3 px-2">الحضور (10)</th>
                            <th className="py-3 px-2">التسميع (20)</th>
                            <th className="py-3 px-2">الصلاة (10)</th>
                            <th className="py-3 px-2">الدرس (10)</th>
                            <th className="py-3 px-2">التميز (10)</th>
                            <th className="py-3 px-2">المجموع (60)</th>
                            <th className="py-3 px-3 text-right">ملاحظات وتوجيه المشرف</th>
                            <th className="py-3 px-2">اعتماد سريع</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100/90 bg-white">
                          {displayedRubricRecords.map((rec) => {
                            const dayTotal = (Number(rec.attendance) || 0) +
                              (Number(rec.recitation) || 0) +
                              (Number(rec.prayerFollowup) || 0) +
                              (Number(rec.lesson) || 0) +
                              (Number(rec.excellence) || 0);

                            return (
                              <tr key={rec.day} className="hover:bg-amber-50/60 transition-colors">
                                <td className="py-3 px-3 text-right font-black text-emerald-950 text-sm whitespace-nowrap">
                                  {rec.day}
                                </td>
                                <td className="py-2.5 px-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={rec.attendance}
                                    onChange={(e) => handleRubricChange(rec.day, 'attendance', e.target.value)}
                                    className="w-14 px-1.5 py-1.5 text-center font-bold font-mono bg-white text-slate-900 border border-amber-300/80 rounded-xl focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden shadow-2xs"
                                  />
                                </td>
                                <td className="py-2.5 px-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max="20"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={rec.recitation}
                                    onChange={(e) => handleRubricChange(rec.day, 'recitation', e.target.value)}
                                    className="w-14 px-1.5 py-1.5 text-center font-bold font-mono bg-white text-slate-900 border border-amber-300/80 rounded-xl focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden shadow-2xs"
                                  />
                                </td>
                                <td className="py-2.5 px-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={rec.prayerFollowup}
                                    onChange={(e) => handleRubricChange(rec.day, 'prayerFollowup', e.target.value)}
                                    className="w-14 px-1.5 py-1.5 text-center font-bold font-mono bg-white text-slate-900 border border-amber-300/80 rounded-xl focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden shadow-2xs"
                                  />
                                </td>
                                <td className="py-2.5 px-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={rec.lesson}
                                    onChange={(e) => handleRubricChange(rec.day, 'lesson', e.target.value)}
                                    className="w-14 px-1.5 py-1.5 text-center font-bold font-mono bg-white text-slate-900 border border-amber-300/80 rounded-xl focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden shadow-2xs"
                                  />
                                </td>
                                <td className="py-2.5 px-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={rec.excellence}
                                    onChange={(e) => handleRubricChange(rec.day, 'excellence', e.target.value)}
                                    className="w-14 px-1.5 py-1.5 text-center font-bold font-mono bg-white text-slate-900 border border-amber-300/80 rounded-xl focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden shadow-2xs"
                                  />
                                </td>
                                <td className="py-2.5 px-2">
                                  <span className={`inline-block px-2.5 py-1 rounded-xl font-black font-mono text-sm shadow-2xs ${
                                    dayTotal >= 55
                                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 ring-1 ring-emerald-400/40'
                                      : dayTotal >= 40
                                      ? 'bg-amber-100 text-amber-950 border border-amber-300'
                                      : 'bg-rose-100 text-rose-900'
                                  }`}>
                                    {dayTotal}
                                  </span>
                                </td>
                                <td className="py-2.5 px-2 text-right">
                                  <input
                                    type="text"
                                    value={rec.notes || ''}
                                    onChange={(e) => handleRubricChange(rec.day, 'notes', e.target.value)}
                                    placeholder="ملاحظة أو توجيه المشرف..."
                                    className="w-full px-3 py-1.5 text-xs font-medium bg-white text-slate-900 placeholder:text-slate-400 border border-amber-300/80 rounded-xl focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden shadow-2xs"
                                  />
                                </td>
                                <td className="py-2.5 px-2">
                                  <button
                                    type="button"
                                    onClick={() => handleSetFullRubric(rec.day)}
                                    className="px-2.5 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-amber-300 text-[11px] font-bold shadow-xs transition-all flex items-center justify-center gap-1 mx-auto hover:scale-105 active:scale-95"
                                    title="منح الدرجة الكاملة 60"
                                  >
                                    <CheckCheck className="w-3.5 h-3.5" />
                                    <span>كاملة 60</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Rubric Criteria Notes at the Bottom */}
                    <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-4 text-xs text-slate-700 space-y-2 shadow-2xs">
                      <div className="flex items-center gap-2 text-emerald-950 font-black">
                        <Bookmark className="w-4 h-4 text-emerald-800" />
                        <span>ملاحظات وإرشادات توزيع درجات التقييم اليومي (المجموع اليومي: 60 نقطة):</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-[11px] pt-1">
                        <div className="bg-white p-2.5 rounded-xl border border-amber-200/60 shadow-2xs">
                          <span className="font-bold text-emerald-900 block">1. الحضور والانضباط:</span>
                          <span className="text-slate-500 font-mono">10 درجات</span>
                          <p className="text-[10px] text-slate-400 mt-0.5">الحضور المبكر والالتزام بالوقت</p>
                        </div>
                        <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200/80 shadow-2xs">
                          <span className="font-black text-emerald-950 block">2. التسميع والإتقان:</span>
                          <span className="text-emerald-800 font-mono font-bold">20 درجة</span>
                          <p className="text-[10px] text-emerald-700/80 mt-0.5">جودة الحفظ وأحكام التجويد</p>
                        </div>
                        <div className="bg-white p-2.5 rounded-xl border border-amber-200/60 shadow-2xs">
                          <span className="font-bold text-emerald-900 block">3. متابعة الصلاة:</span>
                          <span className="text-slate-500 font-mono">10 درجات</span>
                          <p className="text-[10px] text-slate-400 mt-0.5">الصلوات الموثقة في الدفتر</p>
                        </div>
                        <div className="bg-white p-2.5 rounded-xl border border-amber-200/60 shadow-2xs">
                          <span className="font-bold text-emerald-900 block">4. الدرس والتفسير:</span>
                          <span className="text-slate-500 font-mono">10 درجات</span>
                          <p className="text-[10px] text-slate-400 mt-0.5">المشاركة والتفاعل التربوي</p>
                        </div>
                        <div className="bg-white p-2.5 rounded-xl border border-amber-200/60 shadow-2xs">
                          <span className="font-bold text-emerald-900 block">5. التميز والأدب:</span>
                          <span className="text-slate-500 font-mono">10 درجات</span>
                          <p className="text-[10px] text-slate-400 mt-0.5">حسن الخلق والهمة القرآنية</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Passport Certificate & Stamp Footer */}
              <div className="bg-[#f5ede0] border-t border-amber-200 px-6 py-3 flex flex-wrap items-center justify-between text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Stamp className="w-4 h-4 text-emerald-800" />
                  <span className="font-bold text-emerald-950">توثيق مركز ريحان القرآني</span>
                  <span className="text-slate-400">•</span>
                  <span>الختم والتوقيع إلكتروني معتمد</span>
                </div>
                <div className="flex items-center gap-3 font-mono text-[11px] text-slate-500">
                  <span>الصفحة {currentPage.pageNumber} من 9</span>
                  <span>•</span>
                  <span>تاريخ التوليد: 2026/11</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==========================================
// Component: PassportAnalyticsView (With Multi-Class Filters)
// ==========================================
function PassportAnalyticsView({ students, classes, currentUser, isGeneralSupervisor, activeCenterDays }) {
  const [selectedClassIds, setSelectedClassIds] = useState(
    isGeneralSupervisor ? ['all'] : (currentUser?.assignedClassId ? [currentUser.assignedClassId] : [])
  );

  useEffect(() => {
    if (isGeneralSupervisor) {
      setSelectedClassIds(['all']);
    } else {
      setSelectedClassIds(currentUser?.assignedClassId ? [currentUser.assignedClassId] : []);
    }
  }, [isGeneralSupervisor, currentUser?.assignedClassId]);

  const toggleClassFilter = (classId) => {
    if (classId === 'all') {
      setSelectedClassIds(['all']);
      return;
    }
    let updated = selectedClassIds.filter(id => id !== 'all');
    if (updated.includes(classId)) {
      updated = updated.filter(id => id !== classId);
      if (updated.length === 0) updated = ['all'];
    } else {
      updated.push(classId);
    }
    setSelectedClassIds(updated);
  };

  const visibleStudents = useMemo(() => {
    const scopedStudents = students.filter(s => ['approved', 'pending_approval'].includes(s.status));
    if (selectedClassIds.includes('all')) {
      return isGeneralSupervisor
        ? scopedStudents
        : scopedStudents.filter(s => String(s.classId) === String(currentUser?.assignedClassId));
    }
    return scopedStudents.filter(s => selectedClassIds.some(id => String(id) === String(s.classId)));
  }, [students, selectedClassIds, isGeneralSupervisor, currentUser]);

  const [selectedStudentId, setSelectedStudentId] = useState(visibleStudents[0]?.id || null);

  useEffect(() => {
    if (visibleStudents.length > 0 && !visibleStudents.some(s => s.id === selectedStudentId)) {
      setSelectedStudentId(visibleStudents[0].id);
    }
  }, [visibleStudents, selectedStudentId]);

  const studentStatsList = useMemo(() => {
    return visibleStudents.map(st => {
      let mosqueCount = 0;
      let onTimeCount = 0;
      let missedCount = 0;
      let prayerPoints = 0;
      let rubricPoints = 0;

      if (st.passport?.sections) {
        st.passport.sections.forEach(sec => {
          sec.pages.forEach(p => {
            if (p.type === 'prayer_tracking' && p.prayerData) {
              p.prayerData.forEach(d => {
                PRAYERS_LIST.forEach(pr => {
                  if (d[pr.key] === 1) {
                    mosqueCount++;
                    prayerPoints += 2;
                  } else if (d[pr.key] === 2) {
                    onTimeCount++;
                    prayerPoints += 1;
                  } else if (d[pr.key] === 3) {
                    missedCount++;
                  }
                });
                prayerPoints += [d.sunnah, d.adhkar, d.salawat].filter(Boolean).length;
              });
            }
            if (p.type === 'supervisor_rubric' && p.records) {
              p.records.filter(r => activeCenterDays.includes(r.day)).forEach(r => {
                rubricPoints += (Number(r.attendance) || 0) +
                  (Number(r.recitation) || 0) +
                  (Number(r.prayerFollowup) || 0) +
                  (Number(r.lesson) || 0) +
                  (Number(r.excellence) || 0);
              });
            }
          });
        });
      }

      const totalPrayers = mosqueCount + onTimeCount + missedCount;
      const mosqueRate = totalPrayers > 0 ? Math.round((mosqueCount / totalPrayers) * 100) : 0;
      const totalPoints = rubricPoints + prayerPoints;

      return {
        ...st,
        mosqueCount,
        onTimeCount,
        missedCount,
        totalPrayers,
        mosqueRate,
        rubricPoints,
        prayerPoints,
        totalPoints
      };
    }).sort((a, b) =>
      (b.totalPoints - a.totalPoints)
      || (b.mosqueRate - a.mosqueRate)
      || (b.mosqueCount - a.mosqueCount)
      || (b.juzMemorized - a.juzMemorized)
    );
  }, [visibleStudents, activeCenterDays]);

  const activeStudentStats = studentStatsList.find(s => s.id === selectedStudentId) || studentStatsList[0];

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-800" />
              <span>لوحة الإحصائيات وترتيب الطلاب</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {isGeneralSupervisor
                ? 'متابعة أداء الطلاب وترتيبهم، مع إمكانية التصفية واختيار شُعب متعددة.'
                : `إحصائيات وترتيب طلاب شُعبتك (${classes.find(c => c.id === currentUser?.assignedClassId)?.name || ''}).`}
            </p>
          </div>

          {studentStatsList.length > 0 && (
            <select
              value={activeStudentStats?.id || ''}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="px-3.5 py-2 rounded-2xl border border-slate-200 text-xs font-bold bg-white text-slate-700"
            >
              {studentStatsList.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.totalPoints} نقطة)</option>
              ))}
            </select>
          )}
        </div>

        {/* Multi-Select Pills for Classes in Analytics */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-700 ml-2">الشُعب المعروضة:</span>
          {isGeneralSupervisor && (
            <button
              type="button"
              onClick={() => toggleClassFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedClassIds.includes('all')
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              كل الشُعب
            </button>
          )}

          {classes.map((cls) => {
            const isAssigned = isGeneralSupervisor || cls.id === currentUser?.assignedClassId;
            if (!isAssigned) return null;
            const isSelected = selectedClassIds.includes(cls.id) || (selectedClassIds.includes('all') && isGeneralSupervisor);

            return (
              <button
                key={cls.id}
                type="button"
                onClick={() => isGeneralSupervisor && toggleClassFilter(cls.id)}
                disabled={!isGeneralSupervisor}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isSelected && !selectedClassIds.includes('all')
                    ? 'bg-emerald-800 text-white shadow-xs ring-2 ring-emerald-600/30'
                    : selectedClassIds.includes('all')
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cls.name}
              </button>
            );
          })}
        </div>
      </div>

      {activeStudentStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
            <span className="text-xs text-slate-400 font-bold">مجموع النقاط</span>
            <div className="text-2xl font-black font-mono text-emerald-800 mt-1">
              {activeStudentStats.totalPoints}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">من تقييمات الحفظ والسلوك</p>
            <p className="text-[11px] text-slate-600 mt-1">
              حلقات {activeStudentStats.rubricPoints} + صلاة {activeStudentStats.prayerPoints}
            </p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
            <span className="text-xs text-slate-400 font-bold">صلوات المسجد</span>
            <div className="text-2xl font-black font-mono text-blue-600 mt-1">
              {activeStudentStats.mosqueCount}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">صلاة في جماعة المسجد</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
            <span className="text-xs text-slate-400 font-bold">نسبة صلاة المسجد</span>
            <div className="text-2xl font-black font-mono text-amber-600 mt-1">
              {activeStudentStats.mosqueRate}%
            </div>
            <p className="text-[11px] text-slate-500 mt-1">من إجمالي الصلوات المؤداة</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
            <span className="text-xs text-slate-400 font-bold">الترتيب في القائمة</span>
            <div className="text-2xl font-black font-mono text-purple-600 mt-1">
              #{studentStatsList.findIndex(s => s.id === activeStudentStats.id) + 1}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">من بين {studentStatsList.length} طالباً</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-black text-slate-900">لوحة الشرف وترتيب الطلاب حسب النقاط ({studentStatsList.length})</h3>
          </div>
        </div>

        <div className="w-full overflow-x-auto -webkit-overflow-scrolling-touch">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100/80 text-slate-600 font-bold">
              <tr>
                <th className="py-2.5 px-3 text-center">الترتيب</th>
                <th className="py-2.5 px-3">اسم الطالب</th>
                <th className="py-2.5 px-3 text-center">الشعبة</th>
                <th className="py-2.5 px-3 text-center">صلوات المسجد</th>
                <th className="py-2.5 px-3 text-center">نسبة المسجد</th>
                <th className="py-2.5 px-3 text-center">مجموع النقاط</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {studentStatsList.map((st, idx) => (
                <tr key={st.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-3 text-center font-bold">
                    {idx === 0 ? '🥇 الأول' : idx === 1 ? '🥈 الثاني' : idx === 2 ? '🥉 الثالث' : `#${idx + 1}`}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">{st.name}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-slate-600">
                    {classes.find(c => c.id === st.classId)?.name}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-blue-700 font-bold">{st.mosqueCount}</td>
                  <td className="py-2.5 px-3 text-center font-mono">{st.mosqueRate}%</td>
                  <td className="py-2.5 px-3 text-center font-mono font-black text-emerald-800 text-sm">
                    <span>{st.totalPoints}</span>
                    <span className="block text-[10px] font-normal text-slate-500">
                      حلقات {st.rubricPoints} + صلاة {st.prayerPoints}
                    </span>
                  </td>
                </tr>
              ))}
              {studentStatsList.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    لا يوجد طلاب مطابقين للتصفية المحددة.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Component: AttendanceRegister (With Multi-Class Filters)
// ==========================================
function AttendanceRegister({ students, classes, currentUser, isGeneralSupervisor, onToggleAttendance, activeCenterDays, onToggleCenterDay }) {
  const [selectedDay, setSelectedDay] = useState(activeCenterDays[0]);
  const [selectedClassIds, setSelectedClassIds] = useState(
    isGeneralSupervisor ? ['all'] : [currentUser?.assignedClassId || classes[0]?.id]
  );

  useEffect(() => {
    if (!activeCenterDays.includes(selectedDay)) setSelectedDay(activeCenterDays[0]);
  }, [activeCenterDays, selectedDay]);

  useEffect(() => {
    if (isGeneralSupervisor) {
      setSelectedClassIds(['all']);
    } else {
      setSelectedClassIds(currentUser?.assignedClassId ? [currentUser.assignedClassId] : []);
    }
  }, [isGeneralSupervisor, currentUser?.assignedClassId]);

  const toggleClassFilter = (classId) => {
    if (classId === 'all') {
      setSelectedClassIds(['all']);
      return;
    }
    let updated = selectedClassIds.filter(id => id !== 'all');
    if (updated.includes(classId)) {
      updated = updated.filter(id => id !== classId);
      if (updated.length === 0) updated = ['all'];
    } else {
      updated.push(classId);
    }
    setSelectedClassIds(updated);
  };

  const filteredStudents = useMemo(() => {
    const approved = students.filter(s => s.status === 'approved');
    if (selectedClassIds.includes('all')) {
      return isGeneralSupervisor
        ? approved
        : approved.filter(s => String(s.classId) === String(currentUser?.assignedClassId));
    }
    return approved.filter(s => selectedClassIds.some(id => String(id) === String(s.classId)));
  }, [students, selectedClassIds, isGeneralSupervisor, currentUser]);

  const attendanceStats = useMemo(() => {
    const counts = { present: 0, absent: 0, excused: 0, late: 0 };
    filteredStudents.forEach((student) => {
      const status = student.attendanceRecords?.[selectedDay] || 'absent';
      counts[status] = (counts[status] || 0) + 1;
    });
    return {
      ...counts,
      rate: filteredStudents.length
        ? Math.round(((counts.present + counts.late) / filteredStudents.length) * 100)
        : 0
    };
  }, [filteredStudents, selectedDay]);

  const markAll = (status) => {
    filteredStudents.forEach((student) => onToggleAttendance(student.id, selectedDay, status));
  };

  const statusMeta = {
    present: { label: 'حاضر ✓', className: 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200' },
    absent: { label: 'غائب ✗', className: 'bg-rose-100 text-rose-800 hover:bg-rose-200' },
    excused: { label: 'مستأذن بعذر', className: 'bg-amber-100 text-amber-900 hover:bg-amber-200' },
    late: { label: 'متأخر ⏱', className: 'bg-sky-100 text-sky-900 hover:bg-sky-200' }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-800" />
              <span>سجل دوام وحضور الطلاب الأسبوعي</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">تسجيل حضور وغياب الطلاب مع إمكانية التحديد المتعدد للشُعب.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-2xl">
              عدد الطلاب المعروضين: {filteredStudents.length}
            </span>
            <button type="button" onClick={() => window.print()} className="px-3 py-1.5 rounded-2xl bg-slate-800 text-white hover:bg-slate-700">
              طباعة الكشف
            </button>
          </div>
        </div>

        {isGeneralSupervisor && (
          <CenterDaysControl
            activeCenterDays={activeCenterDays}
            onToggle={onToggleCenterDay}
          />
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <span className="text-xs font-bold text-slate-700">اليوم المحدد:</span>
          {activeCenterDays.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold ${selectedDay === day ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {day}
            </button>
          ))}
          <button type="button" onClick={() => markAll('present')} className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-900 hover:bg-emerald-100 text-xs font-bold">
            تحضير الكل حاضر ✓
          </button>
          <button type="button" onClick={() => markAll('absent')} className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-800 hover:bg-rose-100 text-xs font-bold">
            تحديد الكل غائب
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 border-t border-slate-100 pt-3 text-center text-xs">
          {[
            ['حاضر', attendanceStats.present, 'text-emerald-800'],
            ['غائب', attendanceStats.absent, 'text-rose-700'],
            ['بعذر', attendanceStats.excused, 'text-amber-800'],
            ['متأخر', attendanceStats.late, 'text-sky-800'],
            ['نسبة الحضور', `${attendanceStats.rate}%`, 'text-slate-800']
          ].map(([label, value, color]) => (
            <div key={label} className="rounded-xl bg-slate-50 p-2">
              <div className={`font-black ${color}`}>{value}</div>
              <div className="text-slate-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Multi-Select Pills for Classes in Attendance */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-700 ml-2">تصفية الشُعب:</span>
          {isGeneralSupervisor && (
            <button
              type="button"
              onClick={() => toggleClassFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedClassIds.includes('all')
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              كل الشُعب
            </button>
          )}

          {classes.map((cls) => {
            const isAssigned = isGeneralSupervisor || cls.id === currentUser?.assignedClassId;
            if (!isAssigned) return null;
            const isSelected = selectedClassIds.includes(cls.id) || (selectedClassIds.includes('all') && isGeneralSupervisor);
            const count = students.filter(s => s.classId === cls.id && s.status === 'approved').length;

            return (
              <button
                key={cls.id}
                type="button"
                onClick={() => isGeneralSupervisor && toggleClassFilter(cls.id)}
                disabled={!isGeneralSupervisor}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  isSelected && !selectedClassIds.includes('all')
                    ? 'bg-emerald-800 text-white shadow-xs ring-2 ring-emerald-600/30'
                    : selectedClassIds.includes('all')
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{cls.name}</span>
                <span className="text-[10px] font-mono opacity-80">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="w-full overflow-x-auto -webkit-overflow-scrolling-touch">
          <table className="w-full text-center text-xs">
            <thead className="bg-slate-100/80 text-slate-600 font-bold">
              <tr>
                <th className="py-2.5 px-3 text-right">اسم الطالب</th>
                <th className="py-2.5 px-3 text-right">الشعبة</th>
                {activeCenterDays.map(d => (
                  <th key={d} className="py-2.5 px-2">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.map(st => (
                <tr key={st.id} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900">{st.name}</td>
                  <td className="py-2.5 px-3 text-right text-slate-600">
                    {classes.find(c => c.id === st.classId)?.name}
                  </td>
                  {activeCenterDays.map(day => {
                    const status = st.attendanceRecords?.[day] || 'absent';
                    const meta = statusMeta[status] || statusMeta.absent;
                    return (
                      <td key={day} className="py-2.5 px-2">
                        <button
                          type="button"
                          onClick={() => onToggleAttendance(st.id, day)}
                          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${meta.className}`}
                        >
                          {meta.label}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={activeCenterDays.length + 2} className="py-8 text-center text-slate-400">
                    لا يوجد طلاب في الشُعب المختارة حالياً.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Component: TuitionManagementView
// ==========================================
function TuitionManagementView({ students, classes, onToggleTuition }) {
  const approvedStudents = useMemo(() => students.filter(s => s.status === 'approved'), [students]);

  const stats = useMemo(() => {
    const totalDue = approvedStudents.length * 15;
    const paidStudents = approvedStudents.filter(s => s.tuitionPaid);
    const totalCollected = paidStudents.length * 15;
    return { totalDue, totalCollected, paidCount: paidStudents.length };
  }, [approvedStudents]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-800" />
            <span>الرسوم الشهرية وسندات القبض (15 د.أ شهرياً)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">خاص بالمشرف العام لمتابعة تحصيل الاشتراكات وإصدار الإيصالات.</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-bold font-mono">
          <div className="bg-emerald-50 text-emerald-900 px-3 py-1.5 rounded-2xl border border-emerald-200">
            المحصل: {stats.totalCollected} د.أ ({stats.paidCount} طالب)
          </div>
          <div className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-2xl">
            المتوقع: {stats.totalDue} د.أ
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="w-full overflow-x-auto -webkit-overflow-scrolling-touch">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold">
              <tr>
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">اسم الطالب</th>
                <th className="py-2.5 px-3 text-center">الشعبة</th>
                <th className="py-2.5 px-3 text-center">الرسم الشهري</th>
                <th className="py-2.5 px-3 text-center">حالة السداد</th>
                <th className="py-2.5 px-3 text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {approvedStudents.map((st, idx) => (
                <tr key={st.id} className="hover:bg-slate-50/60">
                  <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">{st.name}</td>
                  <td className="py-2.5 px-3 text-center font-bold text-slate-600">
                    {classes.find(c => c.id === st.classId)?.name}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold">15 دينار أردني</td>
                  <td className="py-2.5 px-3 text-center">
                    {st.tuitionPaid ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-bold text-[10px]">
                        مسدد بالكامل ✓
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">
                        ذمة غير مسددة
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => onToggleTuition(st.id)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                        st.tuitionPaid
                          ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          : 'bg-emerald-800 text-white hover:bg-emerald-900'
                      }`}
                    >
                      {st.tuitionPaid ? 'إلغاء التوريد' : 'قبض الرسوم 15 د.أ'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Component: StaffSelfAttendanceView
// ==========================================
function DashboardView({ students, classes, shifts, announcements, supervisors, currentUser, isGeneralSupervisor, activeCenterDays, setActiveTab, onCreateAnnouncement, onDeleteAnnouncement, onMarkAnnouncementRead, readAnnouncementIds, onSaveWelcomeDua, welcomeDua, onStartShift, onEndShift }) {
  const dates = formatLiveDates();
  const today = new Date().toISOString().split('T')[0];
  const weekday = new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(new Date());
  const approved = students.filter(student => student.status === 'approved');
  const shift = shifts.find(item => String(item.supervisorId) === String(currentUser?.supervisorId) && item.date === today);
  const sessionDay = activeCenterDays.includes(weekday) ? weekday : activeCenterDays[activeCenterDays.length - 1];
  const presentStudents = approved.filter(student => ['present', 'late'].includes(student.attendanceRecords?.[sessionDay]));
  const absentStudents = approved.filter(student => student.attendanceRecords?.[sessionDay] === 'absent');
  const collectedAmount = approved.reduce((sum, student) => sum + (student.tuitionPaid ? Number(student.tuitionAmount) || 15 : 0), 0);
  const averageMemorized = approved.length
    ? (approved.reduce((sum, student) => sum + (Number(student.juzMemorized) || 0), 0) / approved.length).toFixed(1)
    : '0.0';
  const consecutiveAbsentStudents = approved.map(student => {
    let longest = 0;
    let current = 0;
    activeCenterDays.forEach(day => {
      current = student.attendanceRecords?.[day] === 'absent' ? current + 1 : 0;
      longest = Math.max(longest, current);
    });
    return { ...student, consecutiveAbsences: longest };
  }).filter(student => student.consecutiveAbsences >= 3);
  const quickCards = [
    { id: 'attendance', label: 'سجل حضور وغياب الحلقة', description: 'رصد الحضور بنقرة واحدة، جدول أيام الدوام، والتبديل بين الشُعب.', icon: Calendar },
    { id: 'passport', label: 'جواز سفر الطالب والتقييم', description: 'متابعة الصلوات للأسبوع كاملاً، التسميع اليومي، وتحديد تواريخ الأقسام.', icon: BookOpen },
    isGeneralSupervisor
      ? { id: 'tuition', label: 'إدارة الرسوم والاشتراكات', description: 'متابعة التحصيل وإدارة الاشتراكات بالدينار الأردني.', icon: DollarSign }
      : { id: 'analytics', label: 'لوحة الإحصائيات والترتيب', description: 'تحليل أداء الطلاب ومتابعة لوحة الشرف.', icon: BarChart3 }
  ];
  if (isGeneralSupervisor) quickCards.push({ id: 'supervisors', label: 'شؤون الكادر ودوام المشرفين', description: 'إدارة المشرفين ومراجعة سجلات الدوام.', icon: Shield });
  const visible = announcements.filter(item => item.target_type === 'all' || (item.target_type === 'personal' && String(item.target_supervisor_id) === String(currentUser?.supervisorId)));
  const [form, setForm] = useState({ title: '', content: '', targetType: 'all', targetSupervisorId: '', priority: 'normal' });
  const [isDuaEditing, setIsDuaEditing] = useState(false);
  const [draftDua, setDraftDua] = useState(welcomeDua);
  const submit = async event => {
    event.preventDefault();
    await onCreateAnnouncement(form);
    setForm({ title: '', content: '', targetType: 'all', targetSupervisorId: '', priority: 'normal' });
  };
  return (
    <div className="space-y-6">
      <section className="bg-gradient-to-l from-emerald-950 via-emerald-900 to-teal-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
        <div className="space-y-4">
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-400/15 border border-amber-300/30 px-3 py-1 text-xs font-bold text-amber-200"><Sparkles className="w-4 h-4" />{isGeneralSupervisor ? 'المشرف العام' : 'مشرف الحلقة'}</span>
          <h2 className="text-2xl sm:text-3xl font-black">أهلاً وسهلاً بك، {currentUser?.name}</h2>
          <p className="max-w-2xl text-sm leading-7 text-emerald-100">مرحباً بك في لوحة القيادة لمركز ريحان القرآني. يمكنك متابعة رصد الحضور، إدارة الاشتراكات بالدينار الأردني بدقة، وتعديل وتحديث الشُعب والكادر.</p>
          <div className="text-xs font-bold text-amber-200">{dates.hijri} · {dates.gregorian}</div>
        </div>
        <div className="bg-emerald-950/60 border border-emerald-700/60 rounded-2xl p-4 min-w-[280px] space-y-3">
          <div className="flex items-center justify-between text-sm font-black"><span className="flex items-center gap-2"><Clock className="w-4 h-4 text-amber-300" />إثبات دوام المشرف اليوم</span><span className="text-[11px] text-emerald-200">{today}</span></div>
          {!shift && <button type="button" onClick={onStartShift} className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black py-3 flex items-center justify-center gap-2"><CheckCircle2 className="w-5 h-5" />بدء الدوام (تسجيل الحضور)</button>}
          {shift && !shift.endTime && <><p className="text-xs text-emerald-100">بدأ الدوام في <strong className="text-white font-mono">{shift.startTime}</strong></p><button type="button" onClick={() => onEndShift(shift.id)} className="w-full rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black py-3 flex items-center justify-center gap-2"><LogOut className="w-5 h-5" />إنهاء الدوام والانصراف</button></>}
          {shift?.endTime && <div className="rounded-xl bg-emerald-800/80 px-3 py-3 text-center text-sm font-bold text-emerald-100">تم إثبات دوام اليوم بنجاح ✓</div>}
        </div>
      </section>
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          [Users, isGeneralSupervisor ? 'إجمالي طلاب المركز' : 'طلاب الشُعبة', `${approved.length} طالب`, `موزعين على ${isGeneralSupervisor ? classes.length : 1} شُعب`, 'text-emerald-800'],
          [CheckCircle2, 'حضور جلسة اليوم', `${presentStudents.length} طالب`, `جلسة ${sessionDay} (${today.slice(8, 10)}/${today.slice(5, 7)})`, 'text-emerald-600'],
          [XCircle, 'غياب جلسة اليوم', `${absentStudents.length} طالب`, `${absentStudents.length} طلاب في سجل الغياب`, 'text-rose-600'],
          [isGeneralSupervisor ? DollarSign : BookOpen, isGeneralSupervisor ? 'الاشتراكات المحصلة' : 'متوسط أجزاء الحفظ في الشُعبة', isGeneralSupervisor ? `${collectedAmount} د.أ` : `${averageMemorized} جزء`, isGeneralSupervisor ? 'الرسم الثابت 15 د.أ شهرياً' : 'متوسط الأجزاء المحفوظة للطلاب', isGeneralSupervisor ? 'text-amber-600' : 'text-blue-600']
        ].map(([Icon, label, value, note, color]) => <div key={label} className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs flex items-start gap-3"><div className={`rounded-2xl bg-slate-50 p-3 ${color}`}><Icon className="w-6 h-6" /></div><div><p className="text-xs text-slate-500 font-bold">{label}</p><strong className="block text-2xl font-black text-slate-900 mt-1">{value}</strong><span className="text-[11px] text-emerald-700 font-bold">{note}</span></div></div>)}
      </section>
      {consecutiveAbsentStudents.length > 0 && <section className="bg-rose-50/90 border border-rose-200 rounded-3xl p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-base font-black text-rose-900 flex items-center gap-2"><AlertCircle className="w-5 h-5" />تنبيه عاجل: طلاب تجاوزوا 3 أيام غياب متصل</h3><span className="rounded-full bg-rose-600 text-white px-3 py-1.5 text-xs font-black">{consecutiveAbsentStudents.length} طلاب بحاجة لمتابعة ولي الأمر</span></div><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">{consecutiveAbsentStudents.map(student => <div key={student.id} className="bg-white rounded-2xl p-3 border border-rose-100 flex items-center justify-between gap-2"><div><p className="font-black text-slate-900 text-sm">{student.name}</p><p className="text-[11px] text-slate-500 mt-1">هاتف: {student.guardianPhone || 'غير مسجل'}</p></div><span className="rounded-full bg-rose-100 text-rose-800 px-2 py-1 text-[11px] font-black">{student.consecutiveAbsences} أيام</span></div>)}</div></section>}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">{quickCards.map(card => { const Icon = card.icon; return <button key={card.id} type="button" onClick={() => setActiveTab(card.id)} className="text-right bg-white rounded-3xl border border-slate-200 p-5 shadow-xs hover:-translate-y-0.5 hover:border-emerald-300 transition-all"><Icon className="w-6 h-6 text-emerald-800 mb-4" /><h3 className="font-black text-slate-900">{card.label}</h3><p className="text-xs text-slate-500 leading-6 mt-2">{card.description}</p></button>; })}</section>
      {isGeneralSupervisor && <section className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs"><div className="flex items-center justify-between gap-3"><div><h3 className="font-black text-slate-900">دعاء الدخول للمركز</h3><p className="text-xs text-slate-500 mt-1">يظهر قبل الدخول إلى المنظومة.</p></div><button type="button" onClick={() => { setDraftDua(welcomeDua); setIsDuaEditing(true); }} className="px-3 py-2 rounded-xl bg-emerald-800 text-white text-xs font-bold">تعديل دعاء الدخول للمركز</button></div><p className="mt-3 text-sm text-emerald-900 leading-7">{welcomeDua}</p></section>}
      <div className="grid lg:grid-cols-3 gap-5">
        {isGeneralSupervisor && <form onSubmit={submit} className="bg-white rounded-3xl border border-slate-200 p-5 space-y-3"><h3 className="font-black">نشر تعميم أو ملاحظة</h3><input required placeholder="العنوان" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border rounded-xl" /><textarea required placeholder="المحتوى" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="w-full px-3 py-2 border rounded-xl min-h-24" /><select value={form.targetType} onChange={e => setForm({ ...form, targetType: e.target.value })} className="w-full px-3 py-2 border rounded-xl"><option value="all">تعميم عام لجميع المشرفين</option><option value="personal">ملاحظة خاصة</option></select>{form.targetType === 'personal' && <select required value={form.targetSupervisorId} onChange={e => setForm({ ...form, targetSupervisorId: e.target.value })} className="w-full px-3 py-2 border rounded-xl"><option value="">اختر المشرف</option>{supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}<select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="w-full px-3 py-2 border rounded-xl"><option value="normal">عادي</option><option value="important">هام</option><option value="urgent">عاجل</option></select><button className="w-full py-2 rounded-xl bg-emerald-800 text-white font-bold">نشر</button></form>}
        <div className={`${isGeneralSupervisor ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white rounded-3xl border border-slate-200 p-5`}><h3 className="font-black mb-4">التعاميم والملاحظات الإدارية</h3><div className="space-y-3">{visible.map(item => <article key={item.id} className={`rounded-2xl border p-4 ${readAnnouncementIds.includes(item.id) ? 'border-slate-100' : 'border-amber-300 bg-amber-50/40'}`}><div className="flex justify-between gap-2"><h4 className="font-black">{item.title}</h4><div className="flex items-center gap-2"><span className="text-xs text-amber-700">{item.priority === 'urgent' ? 'عاجل' : item.priority === 'important' ? 'هام' : 'عادي'}</span>{!readAnnouncementIds.includes(item.id) && <span className="text-[10px] bg-rose-500 text-white rounded-full px-2 py-0.5 font-black">جديد ✨</span>}</div></div>{item.target_type === 'personal' && <span className="inline-block mt-1 text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">ملاحظة خاصة لك</span>}<p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{item.content}</p><div className="flex items-center gap-3 mt-2">{!readAnnouncementIds.includes(item.id) && <button type="button" onClick={() => onMarkAnnouncementRead(item.id)} className="text-xs text-emerald-700 font-bold">تمت القراءة ✓</button>}{isGeneralSupervisor && <button type="button" onClick={() => onDeleteAnnouncement(item.id)} className="text-xs text-rose-700 font-bold">حذف</button>}</div></article>)}{visible.length === 0 && <p className="text-sm text-slate-400">لا توجد تعاميم حالياً.</p>}</div></div>
      </div>
      {isDuaEditing && <div className="fixed inset-0 z-[80] bg-slate-950/60 flex items-center justify-center p-4"><form onSubmit={async event => { event.preventDefault(); await onSaveWelcomeDua(draftDua); setIsDuaEditing(false); }} className="bg-white rounded-3xl p-6 w-full max-w-lg space-y-4"><h3 className="font-black text-slate-900">تعديل دعاء الدخول للمركز</h3><textarea value={draftDua} onChange={event => setDraftDua(event.target.value)} required className="w-full min-h-32 rounded-2xl border border-slate-200 p-3 text-sm leading-7" /><div className="flex justify-end gap-2"><button type="button" onClick={() => setIsDuaEditing(false)} className="px-4 py-2 rounded-xl bg-slate-100 font-bold">إلغاء</button><button type="submit" className="px-4 py-2 rounded-xl bg-emerald-800 text-white font-bold">حفظ الدعاء</button></div></form></div>}
    </div>
  );
}

function StaffSelfAttendanceView({ currentUser, shifts, onStartShift, onEndShift, onSubmitManualShift }) {
  const todayStr = new Date().toISOString().split('T')[0];

  const currentActiveShift = useMemo(() => {
    return shifts.find(sh => String(sh.supervisorId) === String(currentUser?.supervisorId) && !sh.endTime);
  }, [shifts, currentUser]);

  const hasShiftToday = useMemo(() => {
    return shifts.some(sh => String(sh.supervisorId) === String(currentUser?.supervisorId) && sh.date === todayStr);
  }, [shifts, currentUser, todayStr]);

  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualError, setManualError] = useState('');
  const [manualForm, setManualForm] = useState({
    date: todayStr,
    startTime: '15:30',
    endTime: '18:30'
  });

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const [startHour, startMinute] = manualForm.startTime.split(':').map(Number);
    const [endHour, endMinute] = manualForm.endTime.split(':').map(Number);
    const duration = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
    const duplicateDate = shifts.some(
      sh => String(sh.supervisorId) === String(currentUser?.supervisorId) && sh.date === manualForm.date
    );
    if (duplicateDate) {
      setManualError('يوجد سجل دوام لهذا التاريخ مسبقاً.');
      return;
    }

    function DashboardView({ students, classes, shifts, announcements, supervisors, currentUser, isGeneralSupervisor, onCreateAnnouncement, onDeleteAnnouncement }) {
      const dates = formatLiveDates();
      const today = new Date().toISOString().split('T')[0];
      const todayWeekday = new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(new Date());
      const approvedStudents = students.filter(student => student.status === 'approved');
      const attendanceTotal = approvedStudents.length;
      const attendancePresent = approvedStudents.filter(student => ['present', 'late'].includes(student.attendanceRecords?.[todayWeekday])).length;
      const currentShift = shifts.find(shift => String(shift.supervisorId) === String(currentUser?.supervisorId) && shift.date === today);
      const visibleAnnouncements = announcements.filter(item => item.target_type === 'all' || (item.target_type === 'personal' && String(item.target_supervisor_id) === String(currentUser?.supervisorId)));
      const [form, setForm] = useState({ title: '', content: '', targetType: 'all', targetSupervisorId: '', priority: 'normal' });

      const submit = async event => {
        event.preventDefault();
        await onCreateAnnouncement(form);
        setForm({ title: '', content: '', targetType: 'all', targetSupervisorId: '', priority: 'normal' });
      };

      return (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-xl font-black text-emerald-950">الرئيسية والتعاميم</h2><p className="text-xs text-slate-500 mt-1">مرحباً {currentUser?.name || 'بك'} في لوحة مركز ريحان</p></div>
              <div className="text-left text-xs font-bold text-emerald-900"><div>{dates.hijri}</div><div className="text-slate-500 mt-1">{dates.gregorian}</div></div>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ['إجمالي الطلاب المعتمدين', approvedStudents.length, Users],
              ['عدد الشُعب', classes.length, Layers],
              ['نسبة الحضور اليوم', `${attendanceTotal ? Math.round(attendancePresent / attendanceTotal * 100) : 0}%`, Calendar],
              ['دوام المشرف الحالي', currentShift ? (currentShift.endTime ? 'منتهٍ' : 'جارٍ الآن') : 'غير مسجل', Clock]
            ].map(([label, value, Icon]) => <div key={label} className="bg-white rounded-3xl border border-slate-200 p-5"><Icon className="w-5 h-5 text-emerald-800 mb-3" /><p className="text-xs text-slate-500">{label}</p><strong className="text-2xl font-black text-emerald-950">{value}</strong></div>)}
          </div>
          <div className="grid lg:grid-cols-3 gap-5">
            {isGeneralSupervisor && <form onSubmit={submit} className="bg-white rounded-3xl border border-slate-200 p-5 space-y-3">
              <h3 className="font-black text-slate-900">نشر تعميم أو ملاحظة</h3>
              <input required placeholder="عنوان التعميم" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
              <textarea required placeholder="محتوى الرسالة" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="w-full px-3 py-2 border rounded-xl min-h-24" />
              <div className="grid grid-cols-2 gap-2"><select value={form.targetType} onChange={e => setForm({ ...form, targetType: e.target.value })} className="px-2 py-2 border rounded-xl"><option value="all">تعميم عام</option><option value="personal">ملاحظة خاصة</option></select><select disabled={form.targetType !== 'personal'} value={form.targetSupervisorId} onChange={e => setForm({ ...form, targetSupervisorId: e.target.value })} className="px-2 py-2 border rounded-xl"><option value="">اختر المشرف</option>{supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="w-full px-3 py-2 border rounded-xl"><option value="normal">عادي</option><option value="important">هام</option><option value="urgent">عاجل</option></select>
              <button className="w-full py-2 rounded-xl bg-emerald-800 text-white font-bold">نشر التعميم</button>
            </form>}
            <div className={`${isGeneralSupervisor ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white rounded-3xl border border-slate-200 p-5`}>
              <h3 className="font-black text-slate-900 mb-4">التعاميم والملاحظات الإدارية</h3>
              <div className="space-y-3">{visibleAnnouncements.map(item => <article key={item.id} className="rounded-2xl border border-slate-100 p-4"><div className="flex justify-between gap-2"><h4 className="font-black">{item.title}</h4><span className="text-[10px] font-bold text-amber-700">{item.priority === 'urgent' ? 'عاجل' : item.priority === 'important' ? 'هام' : 'عادي'}</span></div>{item.target_type === 'personal' && <span className="inline-block mt-1 text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">ملاحظة خاصة لك</span>}<p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{item.content}</p>{isGeneralSupervisor && <button onClick={() => onDeleteAnnouncement(item.id)} className="text-xs text-rose-700 font-bold mt-2">حذف التعميم</button>}</article>)}{announcements.length === 0 && <p className="text-sm text-slate-400">لا توجد تعاميم حالياً.</p>}</div>
            </div>
          </div>
        </div>
      );
    }
    if (duration <= 0) {
      setManualError('يجب أن يكون وقت الانتهاء بعد وقت البدء.');
      return;
    }
    onSubmitManualShift(manualForm);
    setManualError('');
    setIsManualModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-800" />
            <span>تسجيل دوامي (بصمة المشرف الذاتية)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            تسجيل الحضور والانصراف اليومي للمشرف {currentUser?.name || ''}.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsManualModalOpen(true)}
          className="px-3.5 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5"
        >
          <FileText className="w-4 h-4" />
          <span>طلب تسجيل دوام يدوي</span>
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center max-w-lg mx-auto space-y-5 shadow-xs">
        <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto">
          <Clock className="w-8 h-8" />
        </div>

        <div>
          <h3 className="text-base font-black text-slate-900">
            {currentActiveShift ? 'أنت في فترة دوام حالياً' : 'ابدأ جلسة دوامك اليومي'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            التاريخ: <span className="font-mono font-bold text-slate-700">{todayStr}</span>
          </p>
        </div>

        {currentActiveShift ? (
          <div className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-xs text-emerald-950 font-bold">
              بدأ الدوام في تمام الساعة: <span className="font-mono text-sm">{currentActiveShift.startTime}</span>
            </div>
            <button
              type="button"
              onClick={() => onEndShift(currentActiveShift.id)}
              className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>إنهاء الدوام والانصراف</span>
            </button>
          </div>
        ) : (
          <div>
            {hasShiftToday ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 font-bold">
                لقد قمت بتسجيل دوام لهذا اليوم مسبقاً.
              </div>
            ) : (
              <button
                type="button"
                onClick={onStartShift}
                className="w-full py-3 rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                <span>بدء الدوام الآن</span>
              </button>
            )}
          </div>
        )}
      </div>

      {isManualModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="font-black text-slate-900 text-sm">طلب تسجيل دوام يدوي</h3>
              <button type="button" onClick={() => setIsManualModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleManualSubmit} className="space-y-3 text-xs">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 text-blue-900 text-[11px]">
                سيتم إرسال الطلب للمشرف العام، ولن يُحتسب الدوام حتى يتم اعتماده رسمياً.
              </div>
              {manualError && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-rose-800 text-[11px] font-bold">
                  {manualError}
                </div>
              )}
              <div>
                <label className="block text-slate-600 font-bold mb-1">التاريخ</label>
                <input
                  type="date"
                  required
                  value={manualForm.date}
                  onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">وقت البدء</label>
                  <input
                    type="time"
                    required
                    value={manualForm.startTime}
                    onChange={(e) => setManualForm({ ...manualForm, startTime: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">وقت الانتهاء</label>
                  <input
                    type="time"
                    required
                    value={manualForm.endTime}
                    onChange={(e) => setManualForm({ ...manualForm, endTime: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-800 text-white hover:bg-emerald-900 font-bold"
                >
                  إرسال الطلب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function LoginScreen({ onLogin, error, isSubmitting }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onLogin(identifier, password);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-emerald-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <p className="text-amber-300 font-black text-lg tracking-wider mb-2">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
          <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-400 text-emerald-950 flex items-center justify-center shadow-2xl">
            <BookOpen className="w-10 h-10" />
          </div>
          <h1 className="mt-5 text-2xl font-black text-amber-300">مركز ريحان القرآني</h1>
          <p className="mt-2 text-sm text-emerald-200">تسجيل الدخول إلى منظومة الإدارة</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
          <div>
            <label htmlFor="login-identifier" className="block text-sm font-bold text-slate-700 mb-2">
              اسم المستخدم أو البريد الإلكتروني
            </label>
            <input
              id="login-identifier"
              type="text"
              autoComplete="username"
              required
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value.trim())}
              placeholder="اسم المستخدم"
              className="w-full min-h-12 rounded-2xl border border-slate-200 px-4 text-left outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              dir="ltr"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-sm font-bold text-slate-700 mb-2">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full min-h-12 rounded-2xl border border-slate-200 px-4 pl-12 text-left outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPassword(value => !value)}
                className="absolute left-1 top-1 min-h-10 min-w-10 rounded-xl text-slate-500 hover:bg-slate-100"
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff className="mx-auto w-5 h-5" /> : <Eye className="mx-auto w-5 h-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full min-h-12 rounded-2xl bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 text-white font-black flex items-center justify-center gap-2"
          >
            <LogIn className="w-5 h-5" />
            <span>{isSubmitting ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// Main Application Component
// ==========================================
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [localSession, setLocalSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [classes, setClasses] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [students, setStudents] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [classSchedules, setClassSchedules] = useState([]);
  const [prayerTimes, setPrayerTimes] = useState([]);
  const [welcomeDua, setWelcomeDua] = useState(() => {
    try {
      return window.localStorage.getItem('rehan_welcome_dua') || DEFAULT_WELCOME_DUA;
    } catch (error) {
      console.error('Failed to restore welcome dua:', error);
      return DEFAULT_WELCOME_DUA;
    }
  });
  const [readAnnouncementIds, setReadAnnouncementIds] = useState([]);
  const [toastAnnouncement, setToastAnnouncement] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [actionError, setActionError] = useState('');
  const [actionNotice, setActionNotice] = useState('');

  // Trash Bin
  const [trashItems, setTrashItems] = useState([]);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeStudentId, setActiveStudentId] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeCenterDays, setActiveCenterDays] = useState(() => {
    try {
      const savedDays = JSON.parse(window.localStorage.getItem('rehan_active_center_days') || 'null');
      return normalizeCenterDays(savedDays) || DEFAULT_CENTER_DAYS;
    } catch (error) {
      console.error('Failed to restore active center days:', error);
      return DEFAULT_CENTER_DAYS;
    }
  });

  // Modals
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState({ isOpen: false, item: null, type: null });
  const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);

  const isGeneralSupervisor = currentUser?.role === ROLES.GENERAL_SUPERVISOR || currentUser?.role === ROLES.IT_ADMIN;
  const liveDates = formatLiveDates();

  useEffect(() => {
    let active = true;
    supabase.from('center_settings').select('welcome_dua').eq('id', 'default').maybeSingle()
      .then(({ data, error }) => {
        if (error) throw error;
        const dua = data?.welcome_dua?.trim();
        if (active && dua) {
          setWelcomeDua(dua);
          window.localStorage.setItem('rehan_welcome_dua', dua);
        }
      })
      .catch(error => console.error('Failed to load welcome dua:', error));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;
    try {
      const saved = JSON.parse(window.localStorage.getItem(`rehan_read_msgs_${currentUser.id}`) || '[]');
      setReadAnnouncementIds(Array.isArray(saved) ? saved : []);
    } catch (error) {
      console.error('Failed to restore read announcement state:', error);
      setReadAnnouncementIds([]);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser) return undefined;
    const channel = supabase.channel('announcements-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, payload => {
        const item = payload.new;
        if (item?.is_deleted === false && (item.target_type === 'all' || String(item.target_supervisor_id) === String(currentUser.supervisorId))) {
          setAnnouncements(previous => [item, ...previous.filter(existing => existing.id !== item.id)]);
          if (item.priority === 'important' || item.priority === 'urgent' || item.target_type === 'personal') {
            setToastAnnouncement(item);
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser?.id, currentUser?.supervisorId]);

  const visibleAnnouncements = useMemo(() => announcements.filter(item => (
    item.target_type === 'all'
    || String(item.target_supervisor_id) === String(currentUser?.supervisorId)
  )), [announcements, currentUser?.supervisorId]);

  const unreadAnnouncements = useMemo(
    () => visibleAnnouncements.filter(item => !readAnnouncementIds.includes(item.id)),
    [visibleAnnouncements, readAnnouncementIds]
  );

  useEffect(() => {
    const importantUnread = unreadAnnouncements.find(item => (
      item.priority === 'important'
      || item.priority === 'urgent'
      || item.target_type === 'personal'
    ));
    if (importantUnread) setToastAnnouncement(importantUnread);
  }, [unreadAnnouncements.length]);

  const markAnnouncementRead = (id) => {
    if (!currentUser?.id || readAnnouncementIds.includes(id)) return;
    const next = [...readAnnouncementIds, id];
    setReadAnnouncementIds(next);
    window.localStorage.setItem(`rehan_read_msgs_${currentUser.id}`, JSON.stringify(next));
    setToastAnnouncement(current => current?.id === id ? null : current);
  };

  const saveWelcomeDua = async (dua) => {
    const normalizedDua = dua.trim();
    if (!normalizedDua || !isGeneralSupervisor) return;
    try {
      const { error } = await supabase.from('center_settings')
        .update({ welcome_dua: normalizedDua })
        .eq('id', 'default');
      if (error) throw error;
      setWelcomeDua(normalizedDua);
      window.localStorage.setItem('rehan_welcome_dua', normalizedDua);
      setActionNotice('تم حفظ دعاء الدخول بنجاح.');
    } catch (error) {
      reportActionError('تعذر حفظ دعاء الدخول:', error);
    }
  };

  useEffect(() => {
    window.localStorage.setItem('rehan_active_center_days', JSON.stringify(activeCenterDays));
  }, [activeCenterDays]);

  const handleToggleCenterDay = (day) => {
    if (!isGeneralSupervisor || !ALL_WEEK_DAYS.includes(day)) return;
    if (activeCenterDays.includes(day) && activeCenterDays.length === 1) return;
    const nextDays = activeCenterDays.includes(day)
      ? activeCenterDays.filter(activeDay => activeDay !== day)
      : ALL_WEEK_DAYS.filter(weekDay => activeCenterDays.includes(weekDay) || weekDay === day);
    setActiveCenterDays(nextDays);
    void supabase
      .from('center_settings')
      .upsert({ id: 'default', active_days: nextDays }, { onConflict: 'id' })
      .then(({ error }) => {
        if (error) throw error;
      })
      .catch(error => {
        reportActionError('تعذر حفظ أيام دوام المركز في قاعدة البيانات:', error);
      });
  };

  const handleSaveClassSchedule = async (schedule) => {
    if (!isGeneralSupervisor) return;
    const payload = {
      class_id: schedule.classId,
      schedule_date: schedule.date,
      start_time: schedule.startTime,
      end_time: schedule.endTime,
      tasks: schedule.tasks || []
    };
    try {
      const existing = classSchedules.find(item => String(item.classId) === String(schedule.classId) && item.date === schedule.date);
      const request = existing?.id
        ? supabase.from('class_schedules').update(payload).eq('id', existing.id).select().single()
        : supabase.from('class_schedules').insert(payload).select().single();
      const { data, error } = await request;
      if (error) throw error;
      const mapped = mapScheduleRow(data || { ...payload, id: existing?.id || crypto.randomUUID() });
      setClassSchedules(previous => existing
        ? previous.map(item => item.id === existing.id ? mapped : item)
        : [...previous, mapped]);
      setActionNotice('تم حفظ جدول الشُعبة ومهامها.');
    } catch (error) {
      reportActionError('تعذر حفظ جدول الشُعبة:', error);
    }
  };

  const handleSavePrayerTimes = async (entries) => {
    if (!isGeneralSupervisor) return;
    try {
      const { data, error } = await supabase.from('prayer_times').upsert(entries, { onConflict: 'prayer_date' }).select();
      if (error) throw error;
      const mapped = (data || entries).map(mapPrayerTimeRow);
      setPrayerTimes(previous => [...previous.filter(item => !mapped.some(next => next.date === item.date)), ...mapped].sort((a, b) => a.date.localeCompare(b.date)));
      setActionNotice('تم حفظ مواقيت الصلاة بنجاح.');
    } catch (error) {
      reportActionError('تعذر حفظ مواقيت الصلاة:', error);
    }
  };

  const reportActionError = (action, error) => {
    const message = error?.message || 'حدث خطأ غير متوقع.';
    const schemaHint = /column .*deleted_at|column .*is_deleted|schema cache/i.test(message)
      ? ' يجب تشغيل migration الخاصة بالأرشفة الآمنة في Supabase SQL Editor.'
      : '';
    console.error(`${action}:`, error);
    setActionError(`${action} ${message}${schemaHint}`);
  };

  useEffect(() => {
    try {
      const savedUser = window.localStorage.getItem('rehan_current_user');
      const parsedUser = savedUser ? JSON.parse(savedUser) : null;
      if (parsedUser) {
        const restoredUser = {
          id: parsedUser.id,
          name: parsedUser.full_name || parsedUser.name || '',
          role: parsedUser.role || '',
          roleTitle: parsedUser.role_title
            || parsedUser.roleTitle
            || (parsedUser.role === ROLES.GENERAL_SUPERVISOR ? 'المشرف العام' : 'مشرف شُعبة'),
          assignedClassId: parsedUser.assigned_class_id || parsedUser.assignedClassId || null
        };
        setCurrentUser(restoredUser);
        setLocalSession({ ...parsedUser, ...restoredUser });
      } else {
        setLocalSession(null);
      }
    } catch (error) {
      console.error('Failed to restore local login session:', error);
      setAuthError('تعذر استعادة جلسة الدخول المحلية.');
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const handleLogin = async (identifier, password) => {
    setIsSigningIn(true);
    setAuthError('');
    const normalizedIdentifier = identifier.trim().toLowerCase();

    try {
      const { data, error } = await supabase.rpc('verify_app_user', {
        p_username: normalizedIdentifier,
        p_password: password
      });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      if (!result?.success) {
        setAuthError('اسم المستخدم أو كلمة المرور غير صحيحة');
        return;
      }

      const loggedUser = {
        id: result.id,
        name: result.name || result.full_name || '',
        username: result.username || normalizedIdentifier,
        role: result.role || '',
        roleTitle: result.role_title
          || result.roleTitle
          || (result.role === ROLES.GENERAL_SUPERVISOR ? 'المشرف العام' : 'مشرف شُعبة'),
        assignedClassId: result.assigned_class_id || result.assignedClassId || null,
        supervisorId: result.supervisor_id || null,
        signedInAt: new Date().toISOString()
      };
      window.localStorage.setItem('rehan_current_user', JSON.stringify(loggedUser));
      setLocalSession(loggedUser);
      setCurrentUser(loggedUser);
    } catch (error) {
      console.error('Supabase app_users login failed:', error);
      setAuthError('تعذر التحقق من بيانات الدخول. حاول مرة أخرى.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      window.localStorage.removeItem('rehan_current_user');
      setLocalSession(null);
      setCurrentUser(null);
      setClasses([]);
      setSupervisors([]);
      setStudents([]);
      setShifts([]);
    } catch (error) {
      console.error('Failed to clear local login session:', error);
      setActionError(`تعذر تسجيل الخروج: ${error.message}`);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let loadingTimer;
    const loadingStartedAt = Date.now();
    const minimumLoadingDuration = 5000;

    const fetchInitialData = async () => {
      if (!localSession) return;
      setIsLoading(true);
      setLoadError('');

      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('*')
        .eq('is_deleted', false);
      if (classesError) throw classesError;

      const { data: supervisorsData, error: supervisorsError } = await supabase
        .from('supervisors')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });
      if (supervisorsError) throw supervisorsError;

      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .eq('is_deleted', false);
      if (studentsError) throw studentsError;

      const { data: shiftsData, error: shiftsError } = await supabase
        .from('supervisor_shifts')
        .select('*')
        .order('shift_date', { ascending: false });
      if (shiftsError) throw shiftsError;

      const { data: announcementsData, error: announcementsError } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });
      if (announcementsError) throw announcementsError;

      const { data: schedulesData, error: schedulesError } = await supabase
        .from('class_schedules')
        .select('*')
        .order('schedule_date', { ascending: true });
      if (schedulesError) {
        console.error('Failed to load class schedules:', schedulesError);
      }

      const { data: prayerTimesData, error: prayerTimesError } = await supabase
        .from('prayer_times')
        .select('*')
        .order('prayer_date', { ascending: true });
      if (prayerTimesError) {
        console.error('Failed to load prayer times:', prayerTimesError);
      }

      const { data: centerSettingsData, error: centerSettingsError } = await supabase
        .from('center_settings')
        .select('active_days')
        .eq('id', 'default')
        .maybeSingle();
      if (centerSettingsError) {
        console.error('Failed to load center attendance days from Supabase:', centerSettingsError);
      }
      const loadedCenterDays = normalizeCenterDays(centerSettingsData?.active_days);

      const formattedClasses = (classesData || []).map(mapClassRow).filter(classItem => !classItem.isDeleted);
      const allSupervisors = (supervisorsData || []).map(mapSupervisorRow);
      const formattedSupervisors = allSupervisors.filter(supervisor => !supervisor.isDeleted);
      const formattedStudents = (studentsData || []).map(mapStudentRow);
      const formattedShifts = (shiftsData || []).map(row => mapShiftRow(row, allSupervisors));

      if (formattedSupervisors.length === 0) {
        throw new Error('No supervisors were found in the supervisors table.');
      }

      if (!isMounted) return;

      setClasses(formattedClasses);
      setSupervisors(formattedSupervisors);
      setStudents(formattedStudents);
      setShifts(formattedShifts);
      setAnnouncements(announcementsData || []);
      setClassSchedules((schedulesData || []).map(mapScheduleRow));
      setPrayerTimes((prayerTimesData || []).map(mapPrayerTimeRow));
      if (loadedCenterDays) {
        setActiveCenterDays(loadedCenterDays);
      }

      const linkedSupervisor = formattedSupervisors.find(supervisor => (
        (localSession.supervisorId && String(supervisor.id) === String(localSession.supervisorId))
        || (supervisor.userId && String(supervisor.userId) === String(localSession.id))
        || (localSession.name && supervisor.name.trim() === localSession.name.trim())
      ));
      const loadedUser = {
        ...localSession,
        ...(linkedSupervisor
          ? {
              supervisorId: linkedSupervisor.id,
              assignedClassId: linkedSupervisor.assignedClassId || localSession.assignedClassId || null
            }
          : {})
      };
      setCurrentUser(loadedUser);
      if (formattedStudents.length > 0) {
        setActiveStudentId(formattedStudents[0].id);
      }
    };

    fetchInitialData()
      .catch(error => {
        if (!isMounted) return;
        console.error('Failed to load Quran center data from Supabase:', error);
        setLoadError('تعذر تحميل بيانات المركز من قاعدة البيانات. تحقق من الاتصال وإعدادات Supabase ثم حاول مرة أخرى.');
      })
      .finally(() => {
        const remainingDuration = Math.max(
          0,
          minimumLoadingDuration - (Date.now() - loadingStartedAt)
        );
        loadingTimer = window.setTimeout(() => {
          if (isMounted) setIsLoading(false);
        }, remainingDuration);
      });

    return () => {
      isMounted = false;
      if (loadingTimer) window.clearTimeout(loadingTimer);
    };
  }, [reloadKey, localSession]);

  const pendingStudents = useMemo(() => {
    return students.filter(s => s.status === 'pending_approval');
  }, [students]);

  const roleScopedStudents = useMemo(() => {
    if (!currentUser) return [];
    return students
      .map(student => scopeStudentForRole(student, currentUser, isGeneralSupervisor))
      .filter(Boolean);
  }, [students, currentUser, isGeneralSupervisor]);

  const handleEnrollStudent = async (formData) => {
    const isGeneral = currentUser?.role === ROLES.GENERAL_SUPERVISOR || currentUser?.role === ROLES.IT_ADMIN;
    const enrolledClass = classes.find(classItem => String(classItem.id) === String(formData.classId));
    const passport = isGeneral ? createInitialPassport(enrolledClass?.sectionsCount) : null;
    const studentPayload = {
      name: formData.name,
      class_id: formData.classId,
      status: isGeneral ? 'approved' : 'pending_approval',
      juz_memorized: Number(formData.juzMemorized) || 0,
      guardian_phone: formData.guardianPhone,
      tuition_paid: false,
      tuition_amount: 0,
      attendance_records: {},
      passport_data: passport,
      is_deleted: false
    };

    try {
      const { data, error } = await supabase
        .from('students')
        .insert([studentPayload])
        .select()
        .single();
      if (error) throw error;

      const newStudent = mapStudentRow(data);
      setStudents(prev => [newStudent, ...prev]);
      if (isGeneral) {
        setActiveStudentId(newStudent.id);
      }
    } catch (error) {
      reportActionError('تعذر تسجيل الطالب:', error);
      return;
    }
  };

  const handleApproveStudent = async (studentId) => {
    if (!isGeneralSupervisor) return;
    const targetStudent = students.find(st => st.id === studentId);
    if (!targetStudent) return;
    const targetClass = classes.find(classItem => String(classItem.id) === String(targetStudent.classId));
    const passport = targetStudent.passport || createInitialPassport(targetClass?.sectionsCount);

    try {
      const { error } = await supabase
        .from('students')
        .update({ status: 'approved', passport_data: passport })
        .eq('id', studentId);
      if (error) throw error;
      setStudents(prev => prev.map(st => (
        st.id === studentId ? { ...st, status: 'approved', passport } : st
      )));
    } catch (error) {
      reportActionError('تعذر اعتماد الطالب:', error);
    }
  };

  const handleUpdateStudent = async (updatedStudent) => {
    try {
      const { error } = await supabase
        .from('students')
        .update({
          name: updatedStudent.name,
          class_id: updatedStudent.classId,
          juz_memorized: Number(updatedStudent.juzMemorized) || 0,
          guardian_phone: updatedStudent.guardianPhone
        })
        .eq('id', updatedStudent.id);
      if (error) throw error;

      setStudents(prev => prev.map(s => (
        s.id === updatedStudent.id
          ? { ...s, ...updatedStudent, juzMemorized: Number(updatedStudent.juzMemorized) || 0 }
          : s
      )));
    } catch (error) {
      reportActionError('تعذر تعديل بيانات الطالب:', error);
      return;
    }
  };

  const handlePromptDeleteStudent = (student) => {
    if (!isGeneralSupervisor) return;
    setConfirmDeleteModal({ isOpen: true, item: student, type: 'student' });
  };

  const handlePromptDeleteSupervisor = (supervisor) => {
    if (!isGeneralSupervisor) return;
    if (supervisor.role === ROLES.GENERAL_SUPERVISOR || supervisor.roleTitle === 'المشرف العام') {
      setActionError('محظور: لا يمكن حذف حساب المشرف العام لأسباب أمنية.');
      return;
    }
    if (supervisors.length <= 1) return;
    setConfirmDeleteModal({ isOpen: true, item: supervisor, type: 'supervisor' });
  };

  const handlePromptDeleteClass = (classItem) => {
    if (!isGeneralSupervisor) return;
    setConfirmDeleteModal({ isOpen: true, item: classItem, type: 'class' });
  };

  const handleConfirmMoveToTrash = async () => {
    const { item, type } = confirmDeleteModal;
    if (!item) return;

    try {
      if (type === 'supervisor'
        && (item.role === ROLES.GENERAL_SUPERVISOR || item.roleTitle === 'المشرف العام')) {
        setActionError('محظور: لا يمكن حذف حساب المشرف العام لأسباب أمنية.');
        return;
      }
      if (type === 'student') {
        const deletedAt = new Date().toISOString();
        const { error } = await supabase
          .from('students')
          .update({ is_deleted: true, deleted_at: deletedAt })
          .eq('id', item.id);
        if (error) throw error;
        const trashEntry = {
          id: `trash_${item.id}`,
          type,
          deletedAt,
          deletedBy: currentUser?.name || 'المشرف',
          deletedById: currentUser?.id || null,
          data: item
        };
        setTrashItems(prev => [trashEntry, ...prev]);
        setStudents(prev => prev.filter(s => s.id !== item.id));
      } else if (type === 'supervisor') {
        const deletedAt = new Date().toISOString();
        const { error } = await supabase
          .from('supervisors')
          .update({ is_deleted: true, deleted_at: deletedAt })
          .eq('id', item.id);
        if (error) throw error;
        setSupervisors(prev => prev.filter(s => s.id !== item.id));
        setTrashItems(prev => [{
          id: `trash_${item.id}`,
          type,
          deletedAt,
          deletedBy: currentUser?.name || 'المشرف',
          deletedById: currentUser?.id || null,
          data: { ...item, isDeleted: true, deletedAt }
        }, ...prev]);
      } else if (type === 'class') {
        const deletedAt = new Date().toISOString();
        const { error } = await supabase
          .from('classes')
          .update({ is_deleted: true, deleted_at: deletedAt })
          .eq('id', item.id);
        if (error) throw error;
        setClasses(prev => prev.filter(classItem => classItem.id !== item.id));
        setTrashItems(prev => [{
          id: `trash_${item.id}`,
          type,
          deletedAt,
          deletedBy: currentUser?.name || 'المشرف',
          deletedById: currentUser?.id || null,
          data: { ...item, isDeleted: true, deletedAt }
        }, ...prev]);
      }
      setConfirmDeleteModal({ isOpen: false, item: null, type: null });
    } catch (error) {
      reportActionError('تعذر نقل العنصر إلى سلة المهملات:', error);
    }
  };

  const handleRestoreFromTrash = async (trashId) => {
    const entry = trashItems.find(t => t.id === trashId);
    if (!entry) return;

    try {
      if (entry.type === 'student') {
        const { data, error } = await supabase
          .from('students')
          .update({ is_deleted: false, deleted_at: null })
          .eq('id', entry.data.id)
          .select()
          .single();
        if (error) throw error;
        setStudents(prev => [mapStudentRow(data), ...prev]);
      } else if (entry.type === 'supervisor') {
        const { data, error } = await supabase
          .from('supervisors')
          .update({ is_deleted: false, deleted_at: null })
          .eq('id', entry.data.id)
          .select()
          .single();
        if (error) throw error;
        setSupervisors(prev => [mapSupervisorRow(data), ...prev]);
      } else if (entry.type === 'class') {
        const { data, error } = await supabase
          .from('classes')
          .update({ is_deleted: false, deleted_at: null })
          .eq('id', entry.data.id)
          .select()
          .single();
        if (error) throw error;
        setClasses(prev => [...prev, mapClassRow(data)]);
      }
      setTrashItems(prev => prev.filter(t => t.id !== trashId));
    } catch (error) {
      reportActionError('تعذر استعادة العنصر:', error);
    }
  };

  const handlePermanentDelete = async (trashId) => {
    const entry = trashItems.find(t => t.id === trashId);
    if (!entry) return;

    try {
      if (entry.type === 'student') {
        const { error } = await supabase.from('students').delete().eq('id', entry.data.id);
        if (error) throw error;
      } else if (entry.type === 'supervisor') {
        const hasLinkedShifts = shifts.some(shift => shift.supervisorId === entry.data.id);
        if (hasLinkedShifts) {
          throw new Error('لا يمكن الحذف النهائي لأن للمشرف سجلات دوام مرتبطة. تمت المحافظة على السجلات.');
        }
        const { error } = await supabase
          .from('supervisors')
          .delete()
          .eq('id', entry.data.id);
        if (error) throw error;
      } else if (entry.type === 'class') {
        const { data: linkedStudents, error: linkedStudentsError } = await supabase
          .from('students')
          .select('id')
          .eq('class_id', entry.data.id)
          .limit(1);
        if (linkedStudentsError) throw linkedStudentsError;
        if (linkedStudents?.length) {
          throw new Error('لا يمكن الحذف النهائي للشعبة لأن لديها طلاباً مرتبطين. تمت المحافظة على جميع بياناتهم.');
        }
        const { error } = await supabase
          .from('classes')
          .delete()
          .eq('id', entry.data.id);
        if (error) throw error;
      }
      setTrashItems(prev => prev.filter(t => t.id !== trashId));
      setActionError('');
      setActionNotice(
          entry.type === 'class'
            ? 'تم حذف الشعبة نهائياً.'
            : 'تم حذف العنصر نهائياً.'
      );
    } catch (error) {
      reportActionError('تعذر حذف العنصر نهائياً:', error);
    }
  };

  const handleAddClass = async (classData) => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .insert([{
          name: classData.name,
          room: classData.room,
          capacity: Number(classData.capacity),
          level: classData.level,
          curriculum_juz: classData.curriculumJuz || null,
          sections_count: Number(classData.sectionsCount) || 3
        }])
        .select()
        .single();
      if (error) throw error;
      setClasses(prev => [...prev, mapClassRow(data)]);
    } catch (error) {
      reportActionError('تعذر إضافة الشُعبة:', error);
    }
  };

  const handleUpdateClass = async (updatedClass) => {
    try {
      const { error } = await supabase
        .from('classes')
        .update({
          name: updatedClass.name,
          room: updatedClass.room,
          capacity: Number(updatedClass.capacity),
          level: updatedClass.level,
          curriculum_juz: updatedClass.curriculumJuz || null,
          sections_count: Number(updatedClass.sectionsCount) || 3
        })
        .eq('id', updatedClass.id);
      if (error) throw error;
      setClasses(prev => prev.map(c => (
        c.id === updatedClass.id
          ? { ...c, ...updatedClass, capacity: Number(updatedClass.capacity) }
          : c
      )));
    } catch (error) {
      reportActionError('تعذر تعديل بيانات الشُعبة:', error);
    }
  };

  const handleCreateAnnouncement = async (announcement) => {
    if (!isGeneralSupervisor) return;
    try {
      const { data, error } = await supabase.from('announcements').insert([{
        title: announcement.title,
        content: announcement.content,
        target_type: announcement.targetType,
        target_supervisor_id: announcement.targetType === 'personal' ? announcement.targetSupervisorId : null,
        priority: announcement.priority,
        is_deleted: false
      }]).select().single();
      if (error) throw error;
      setAnnouncements(prev => [data, ...prev]);
    } catch (error) {
      reportActionError('تعذر نشر التعميم:', error);
    }
  };

  const handleDeleteAnnouncement = async (announcementId) => {
    if (!isGeneralSupervisor) return;
    try {
      const { error } = await supabase.from('announcements').update({ is_deleted: true }).eq('id', announcementId);
      if (error) throw error;
      setAnnouncements(prev => prev.filter(item => item.id !== announcementId));
    } catch (error) {
      reportActionError('تعذر حذف التعميم:', error);
    }
  };

  const handleAddSupervisor = async (supData) => {
    try {
      const { data, error } = await supabase.rpc('register_new_supervisor', {
        p_name: supData.name,
        p_username: supData.username.trim(),
        p_password: supData.password,
        p_role: supData.role,
        p_role_title: supData.role === ROLES.GENERAL_SUPERVISOR ? 'المشرف العام' : 'مشرف شُعبة',
        p_class_id: supData.assignedClassId || null,
        p_phone: supData.phone || null,
        p_national_id: supData.nationalId || null,
        p_qualification: supData.qualification || null,
        p_specialty: supData.specialty || null
      });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      if (result && result.success === false) {
        setActionNotice('');
        setActionError(result.message || 'تعذر إضافة المشرف.');
        return false;
      }
      if (!result?.success) {
        throw new Error(result?.message || 'تعذر إضافة المشرف.');
      }
      const newSupervisor = mapSupervisorRow(result.supervisor || result);
      setSupervisors(prev => [...prev, newSupervisor]);
      setActionError('');
      setActionNotice('تمت إضافة المشرف وحساب الدخول بنجاح.');
      return true;
    } catch (error) {
      reportActionError('تعذر إضافة المشرف:', error);
      return false;
    }
  };

  const handleUpdateSupervisor = async (updatedSup) => {
    try {
      const { error } = await supabase
        .from('supervisors')
        .update({
          name: updatedSup.name,
          role: updatedSup.role,
          role_title: updatedSup.roleTitle,
          assigned_class_id: updatedSup.assignedClassId || null,
          phone: updatedSup.phone || null,
          national_id: updatedSup.nationalId || null,
          qualification: updatedSup.qualification || null,
          specialty: updatedSup.specialty || null
        })
        .eq('id', updatedSup.id);
      if (error) throw error;
      if (updatedSup.userId) {
        const { error: appUserError } = await supabase
          .from('app_users')
          .update({ assigned_class_id: updatedSup.assignedClassId || null })
          .eq('id', updatedSup.userId);
        if (appUserError) throw appUserError;
      }
      setSupervisors(prev => prev.map(s => (s.id === updatedSup.id ? updatedSup : s)));
    } catch (error) {
      reportActionError('تعذر تعديل المشرف:', error);
    }
  };

  const handleUpdatePassport = async (studentId, newPassport) => {
    const targetStudent = students.find(st => st.id === studentId);
    const canUpdate = targetStudent
      && targetStudent.status === 'approved'
      && (isGeneralSupervisor || String(targetStudent.classId) === String(currentUser?.assignedClassId));
    if (!canUpdate) return;

    try {
      const { error } = await supabase
        .from('students')
        .update({ passport_data: newPassport })
        .eq('id', studentId);
      if (error) throw error;
      setStudents(prev => prev.map(st => (st.id === studentId ? { ...st, passport: newPassport } : st)));
    } catch (error) {
      reportActionError('تعذر حفظ جواز الطالب:', error);
    }
  };

  const handleToggleAttendance = async (studentId, day, requestedStatus) => {
    const attendanceStatuses = ['present', 'absent', 'excused', 'late'];
    const targetStudent = students.find(st => st.id === studentId);
    if (!targetStudent
      || targetStudent.status !== 'approved'
      || (!isGeneralSupervisor && targetStudent.classId !== currentUser?.assignedClassId)) {
      return;
    }

    const currentStatus = targetStudent.attendanceRecords?.[day] || 'absent';
    const nextStatus = attendanceStatuses.includes(requestedStatus)
      ? requestedStatus
      : attendanceStatuses[(attendanceStatuses.indexOf(currentStatus) + 1) % attendanceStatuses.length];
    const attendanceRecords = {
      ...targetStudent.attendanceRecords,
      [day]: nextStatus
    };

    try {
      const { error } = await supabase
        .from('students')
        .update({ attendance_records: attendanceRecords })
        .eq('id', studentId);
      if (error) throw error;
      setStudents(prev => prev.map(st => (
        st.id === studentId ? { ...st, attendanceRecords } : st
      )));
    } catch (error) {
      reportActionError('تعذر حفظ حضور الطالب:', error);
    }
  };

  const handleToggleTuition = async (studentId) => {
    const targetStudent = students.find(st => st.id === studentId);
    if (!targetStudent) return;
    const nextPaidStatus = !targetStudent.tuitionPaid;

    try {
      const { error } = await supabase
        .from('students')
        .update({
          tuition_paid: nextPaidStatus,
          tuition_amount: nextPaidStatus ? 15 : 0
        })
        .eq('id', studentId);
      if (error) throw error;
      setStudents(prev => prev.map(st => (
        st.id === studentId
          ? { ...st, tuitionPaid: nextPaidStatus, tuitionAmount: nextPaidStatus ? 15 : 0 }
          : st
      )));
    } catch (error) {
      reportActionError('تعذر تحديث الرسوم:', error);
    }
  };

  const handleStartShift = async () => {
    if (!currentUser?.supervisorId) {
      setActionError('تعذر بدء الدوام: لا يوجد مشرف مرتبط بحساب الدخول.');
      return;
    }
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const dateStr = now.toISOString().split('T')[0];

    const supervisorId = currentUser?.supervisorId;
    if (!supervisorId) {
      setActionError('تعذر بدء الدوام: تعذر تحديد حساب المشرف المرتبط. سجّل الخروج ثم الدخول مرة أخرى.');
      return;
    }
    const alreadyRecordedToday = shifts.some(sh => String(sh.supervisorId) === String(supervisorId) && sh.date === dateStr);
    if (alreadyRecordedToday) return;

    try {
      const { data, error } = await supabase
        .from('supervisor_shifts')
        .insert([{
          supervisor_id: supervisorId,
          shift_date: dateStr,
          start_time: timeStr,
          end_time: null,
          duration_minutes: null,
          approved: isGeneralSupervisor
        }])
        .select()
        .single();
      if (error) throw error;
      setShifts(prev => [mapShiftRow(data, supervisors), ...prev]);
    } catch (error) {
      reportActionError('تعذر بدء جلسة الدوام:', error);
    }
  };

  const handleEndShift = async (shiftId) => {
    const activeShift = shifts.find(sh => sh.id === shiftId);
    if (!activeShift) return;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const [sH, sM] = activeShift.startTime.split(':').map(Number);
    const duration = Math.max(0, (now.getHours() * 60 + now.getMinutes()) - (sH * 60 + sM));

    try {
      const { error } = await supabase
        .from('supervisor_shifts')
        .update({ end_time: timeStr, duration_minutes: duration })
        .eq('id', shiftId);
      if (error) throw error;
      setShifts(prev => prev.map(sh => (
        sh.id === shiftId ? { ...sh, endTime: timeStr, durationMinutes: duration } : sh
      )));
    } catch (error) {
      reportActionError('تعذر إنهاء جلسة الدوام:', error);
    }
  };

  const handleSubmitManualShift = async (manualData) => {
    const [sH, sM] = manualData.startTime.split(':').map(Number);
    const [eH, eM] = manualData.endTime.split(':').map(Number);
    const duration = (eH * 60 + eM) - (sH * 60 + sM);

    const supervisorId = currentUser?.supervisorId;
    if (!supervisorId) {
      reportActionError('تعذر إرسال طلب الدوام اليدوي:', new Error('تعذر تحديد حساب المشرف المرتبط. سجّل الخروج ثم الدخول مرة أخرى.'));
      return;
    }
    const alreadyRecordedDate = shifts.some(sh => String(sh.supervisorId) === String(supervisorId) && sh.date === manualData.date);
    if (alreadyRecordedDate || duration <= 0) return;

    try {
      const { data, error } = await supabase
        .from('supervisor_shifts')
        .insert([{
          supervisor_id: supervisorId,
          shift_date: manualData.date,
          start_time: manualData.startTime,
          end_time: manualData.endTime,
          duration_minutes: duration,
          approved: false
        }])
        .select()
        .single();
      if (error) throw error;
      setShifts(prev => [mapShiftRow(data, supervisors), ...prev]);
    } catch (error) {
      reportActionError('تعذر إرسال طلب الدوام اليدوي:', error);
    }
  };

  const handleApproveShift = async (shiftId) => {
    if (!isGeneralSupervisor) return;
    try {
      const { error } = await supabase
        .from('supervisor_shifts')
        .update({ approved: true })
        .eq('id', shiftId);
      if (error) throw error;
      setShifts(prev => prev.map(sh => (sh.id === shiftId ? { ...sh, approved: true } : sh)));
    } catch (error) {
      reportActionError('تعذر اعتماد سجل الدوام:', error);
    }
  };

  const handleUpdateShift = async (updatedShift) => {
    if (!isGeneralSupervisor) return;
    try {
      const { error } = await supabase
        .from('supervisor_shifts')
        .update({
          shift_date: updatedShift.date,
          start_time: updatedShift.startTime,
          end_time: updatedShift.endTime || null,
          approved: updatedShift.approved
        })
        .eq('id', updatedShift.id);
      if (error) throw error;
      setShifts(prev => prev.map(sh => (sh.id === updatedShift.id ? updatedShift : sh)));
    } catch (error) {
      reportActionError('تعذر تعديل سجل الدوام:', error);
    }
  };

  const navItems = useMemo(() => {
    const items = [
      { id: 'dashboard', label: 'الرئيسية والتعاميم', mobileLabel: 'الرئيسية', icon: BookOpen },
      { id: 'passport', label: 'جواز سفر الطالب', icon: BookOpen },
      { id: 'analytics', label: 'الإحصائيات والترتيب', icon: Award },
      { id: 'attendance', label: 'حضور وغياب الطلاب', icon: Calendar },
      { id: 'azkari', label: 'جدول الشعب', icon: Clock },
      { id: 'quran_prayer', label: 'الأذكار والصلاة', icon: Compass },
      { id: 'self_attendance', label: 'تسجيل دوامي (البصمة)', icon: Clock }
    ];

    items.push({ id: 'classes', label: isGeneralSupervisor ? 'إدارة الشُعب' : 'بيانات شُعبتي وطلابي', icon: Layers });

    if (isGeneralSupervisor) {
      items.push({ id: 'supervisors', label: 'شؤون المشرفين والدوام', icon: Shield });
      items.push({ id: 'tuition', label: 'الرسوم وسندات القبض', icon: DollarSign });
      items.push({ id: 'trash', label: 'سلة المهملات والمحذوفات', icon: Trash2 });
    }

    return items;
  }, [isGeneralSupervisor]);

  if (authLoading) {
    return (
      <div dir="rtl" className="min-h-screen bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-950 flex items-center justify-center p-4 animate-fadeIn">
        <div className="w-full max-w-lg text-center text-white">
          <p className="text-amber-300 text-xl sm:text-2xl font-black tracking-wide">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
          <div className="mt-6 mx-auto w-20 h-20 rounded-3xl bg-amber-400 text-emerald-950 flex items-center justify-center shadow-2xl animate-pulse">
            <BookOpen className="w-10 h-10" />
          </div>
          <p className="mt-6 px-4 text-emerald-100 text-base leading-8">{welcomeDua}</p>
          <p className="mt-8 text-sm font-bold text-emerald-100 animate-pulse">جاري تحميل بيانات مركز ريحان...</p>
        </div>
      </div>
    );
  }

  if (!localSession) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        error={authError}
        isSubmitting={isSigningIn}
      />
    );
  }

  if (!currentUser) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        error={authError || 'تعذر تحميل بيانات المشرف. سجّل الدخول مرة أخرى.'}
        isSubmitting={isSigningIn}
      />
    );
  }

  if (isLoading) {
    return (
      <div dir="rtl" className="min-h-screen bg-white flex items-center justify-center p-4 animate-fadeIn">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8 max-w-sm w-full mx-auto text-center space-y-4">
          <p className="text-emerald-900 text-lg font-black tracking-wide">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-900 text-amber-300 flex items-center justify-center shadow-md">
            <BookOpen className="w-7 h-7" />
          </div>
          <p className="px-2 text-sm leading-7 text-slate-700">{welcomeDua}</p>
          <p className="text-sm font-black text-slate-900 animate-pulse">جاري تحميل بيانات مركز ريحان...</p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-2/3 rounded-full bg-emerald-700 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div dir="rtl" className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl border border-rose-200 shadow-sm p-8 text-center space-y-4 max-w-md">
          <AlertCircle className="w-10 h-10 mx-auto text-rose-600" />
          <h1 className="text-base font-black text-slate-900">تعذر تحميل بيانات المركز</h1>
          <p className="text-xs leading-6 text-slate-600">{loadError}</p>
          <button
            type="button"
            onClick={() => setReloadKey(value => value + 1)}
            className="min-h-11 px-5 rounded-xl bg-emerald-800 text-white text-xs font-bold hover:bg-emerald-900"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-24 md:pb-12 [&_input]:bg-white [&_input]:text-slate-900 [&_select]:bg-white [&_select]:text-slate-900"
      style={{ colorScheme: 'light' }}
    >
      {actionNotice && (
        <div className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-[70] rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-lg">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="flex-1 leading-6">{actionNotice}</p>
            <button type="button" onClick={() => setActionNotice('')} className="min-h-11 min-w-11 rounded-xl hover:bg-emerald-100" aria-label="إغلاق التنبيه">
              <X className="mx-auto h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      {actionError && (
        <div className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-[70] rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 shadow-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="flex-1 leading-6">{actionError}</p>
            <button
              type="button"
              onClick={() => setActionError('')}
              className="min-h-11 min-w-11 rounded-xl text-rose-700 hover:bg-rose-100"
              aria-label="إغلاق التنبيه"
            >
              <X className="mx-auto h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <header className="bg-emerald-950 text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-3 text-right cursor-pointer"
            aria-label="الانتقال إلى الصفحة الرئيسية"
          >
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-emerald-950 flex items-center justify-center font-black shadow-md">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-amber-300">مركز ريحان القرآني</h1>
              <p className="text-[11px] text-emerald-300">منظومة الإدارة وجواز سفر الطالب التفاعلي</p>
              <p className="text-[10px] text-amber-200 mt-1">{liveDates.hijri} · {liveDates.gregorian}</p>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { setActiveTab('dashboard'); setToastAnnouncement(null); }} className="relative min-h-11 min-w-11 rounded-xl bg-emerald-900 text-emerald-100 hover:bg-emerald-800" aria-label="الإشعارات">
              <Bell className="mx-auto w-5 h-5" />
              {unreadAnnouncements.length > 0 && <span className="absolute -top-1 -left-1 min-w-5 h-5 px-1 rounded-full animate-pulse bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">{unreadAnnouncements.length}</span>}
            </button>
            <div className="bg-emerald-900/80 px-3 py-2 rounded-2xl border border-emerald-800">
              <p className="text-xs font-bold text-amber-300">
                {currentUser?.roleTitle || (currentUser?.role === ROLES.GENERAL_SUPERVISOR ? 'المشرف العام' : 'مشرف شُعبة')}
              </p>
              <p className="text-[10px] text-emerald-200">{currentUser?.name || currentUser?.full_name || 'المشرف'}</p>
            </div>

            <div className="hidden md:flex items-center gap-2">
              {isGeneralSupervisor && (
                <button
                  type="button"
                  onClick={() => setIsTrashModalOpen(true)}
                  className="min-h-11 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 shadow-sm transition-all"
                  title="عرض العناصر المحذوفة وسلة المهملات"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>سلة المهملات</span>
                  {trashItems.length > 0 && (
                    <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center font-mono">
                      {trashItems.length}
                    </span>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={handleLogout}
                className="min-h-11 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-900/70 hover:bg-rose-800 text-rose-100 border border-rose-700 flex items-center gap-1.5 transition-all"
                title="تسجيل الخروج"
              >
                <LogOut className="w-4 h-4" />
                <span>خروج</span>
              </button>

              <button
                type="button"
                onClick={() => setIsEnrollModalOpen(true)}
                className="min-h-11 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-emerald-950 flex items-center gap-1.5 shadow-sm transition-all"
              >
                <UserPlus className="w-4 h-4" />
                <span>تسجيل طالب جديد</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="block md:hidden min-h-11 min-w-11 rounded-xl bg-emerald-900 text-emerald-100 hover:bg-emerald-800"
              aria-label="فتح قائمة النظام"
              title="فتح قائمة النظام"
            >
              <Menu className="mx-auto w-5 h-5" />
            </button>
          </div>
        </div>

        <div
          className="hidden md:flex items-center gap-1 overflow-x-auto max-w-7xl mx-auto px-4 py-2 border-t border-emerald-900/60 scrollbar-none [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {navItems.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  if (tab.id === 'trash') {
                    setIsTrashModalOpen(true);
                  } else {
                    setActiveTab(tab.id);
                  }
                  setIsMobileMenuOpen(false);
                }}
                className={`min-h-11 px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'text-emerald-300 hover:bg-emerald-900/50 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>
      {toastAnnouncement && <div className="fixed top-20 left-4 right-4 md:left-auto md:w-[28rem] z-[70] bg-white border border-amber-300 shadow-xl rounded-2xl p-4"><div className="flex items-start gap-3"><p className="flex-1 font-black text-slate-900">🔔 لديك رسالة / تعميم جديد من الإدارة: {toastAnnouncement.title}</p><button type="button" onClick={() => setToastAnnouncement(null)} className="min-h-11 min-w-11 rounded-xl text-slate-500 hover:bg-slate-100" aria-label="إغلاق الإشعار"><X className="mx-auto w-4 h-4" /></button></div><div className="flex gap-3 mt-3"><button type="button" onClick={() => { setActiveTab('dashboard'); setToastAnnouncement(null); }} className="text-xs font-bold text-emerald-700">عرض الرسالة</button><button type="button" onClick={() => markAnnouncementRead(toastAnnouncement.id)} className="text-xs font-bold text-slate-500">تحديد كمقروء</button></div></div>}

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="قائمة صفحات النظام">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/60"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="إغلاق القائمة"
          />
          <aside className="absolute right-0 top-0 bottom-0 max-w-sm bg-emerald-950 text-white border-l border-emerald-800 shadow-2xl p-4 overflow-y-auto" style={{ width: 'min(88vw, 20rem)' }}>
            <div className="flex items-center justify-between border-b border-emerald-800 pb-3 mb-3">
              <div>
                <p className="text-sm font-black text-amber-300">قائمة النظام</p>
                <p className="text-[11px] text-emerald-200">
                  {currentUser?.roleTitle || (currentUser?.role === ROLES.GENERAL_SUPERVISOR ? 'المشرف العام' : 'مشرف شُعبة')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="min-h-11 min-w-11 rounded-xl text-emerald-200 hover:bg-emerald-900"
                aria-label="إغلاق القائمة"
              >
                <X className="mx-auto w-5 h-5" />
              </button>
            </div>
            <div className="space-y-1">
              {navItems.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      if (tab.id === 'trash') {
                        setIsTrashModalOpen(true);
                      } else {
                        setActiveTab(tab.id);
                      }
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full min-h-11 px-3 rounded-xl flex items-center gap-3 text-right text-sm ${
                      isActive ? 'bg-amber-400 text-emerald-950 font-black' : 'text-emerald-100 hover:bg-emerald-900/70'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span>{tab.mobileLabel || tab.label}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setIsEnrollModalOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full min-h-11 px-3 rounded-xl flex items-center gap-3 text-right text-sm font-bold text-emerald-100 hover:bg-emerald-900/70"
              >
                <UserPlus className="w-5 h-5 shrink-0" />
                <span>تسجيل طالب جديد</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full min-h-11 px-3 rounded-xl flex items-center gap-3 text-right text-sm font-bold text-rose-700 hover:bg-rose-50"
              >
                <LogOut className="w-5 h-5 shrink-0" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-3 sm:px-4 pt-4 pb-28 md:pb-10 space-y-6">
        {isGeneralSupervisor && pendingStudents.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-3xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-amber-400 text-emerald-950 flex items-center justify-center font-bold">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-amber-950">
                  يوجد {pendingStudents.length} طلاب جدد بانتظار الاعتماد والموافقة
                </h3>
                <p className="text-xs text-amber-800">
                  لن يُمنح الطالب دفتر جواز سفر ولن يظهر في السجلات حتى يتم اعتماده من المشرف العام.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {pendingStudents.map(st => (
                <div key={st.id} className="bg-white px-3 py-1.5 rounded-xl border border-amber-200 flex items-center gap-2 text-xs">
                  <span className="font-bold text-slate-800">{st.name}</span>
                  <button
                    type="button"
                    onClick={() => handleApproveStudent(st.id)}
                    className="px-2.5 py-0.5 rounded-lg bg-emerald-800 text-white font-bold text-[11px] hover:bg-emerald-900"
                  >
                    قبول واعتماد ✓
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Views */}
        {activeTab === 'dashboard' && (
          <DashboardView
            students={roleScopedStudents}
            classes={classes}
            shifts={shifts}
            announcements={announcements}
            supervisors={supervisors}
            currentUser={currentUser}
            isGeneralSupervisor={isGeneralSupervisor}
            activeCenterDays={activeCenterDays}
            setActiveTab={setActiveTab}
            onCreateAnnouncement={handleCreateAnnouncement}
            onDeleteAnnouncement={handleDeleteAnnouncement}
            onMarkAnnouncementRead={markAnnouncementRead}
            readAnnouncementIds={readAnnouncementIds}
            onSaveWelcomeDua={saveWelcomeDua}
            welcomeDua={welcomeDua}
            onStartShift={handleStartShift}
            onEndShift={handleEndShift}
          />
        )}
        {activeTab === 'passport' && (
          <StudentPassportView
            students={roleScopedStudents}
            classes={classes}
            currentUser={currentUser}
            activeStudentId={activeStudentId}
            onSelectStudent={(id) => setActiveStudentId(id)}
            onUpdatePassport={handleUpdatePassport}
            isGeneralSupervisor={isGeneralSupervisor}
            activeCenterDays={activeCenterDays}
            onToggleCenterDay={handleToggleCenterDay}
          />
        )}

        {activeTab === 'analytics' && (
          <PassportAnalyticsView
            students={roleScopedStudents}
            classes={classes}
            currentUser={currentUser}
            isGeneralSupervisor={isGeneralSupervisor}
            activeCenterDays={activeCenterDays}
          />
        )}

        {activeTab === 'attendance' && (
          <AttendanceRegister
            students={roleScopedStudents}
            classes={classes}
            currentUser={currentUser}
            isGeneralSupervisor={isGeneralSupervisor}
            onToggleAttendance={handleToggleAttendance}
            activeCenterDays={activeCenterDays}
            onToggleCenterDay={handleToggleCenterDay}
          />
        )}

        {activeTab === 'self_attendance' && (
          <StaffSelfAttendanceView
            currentUser={currentUser}
            shifts={shifts}
            onStartShift={handleStartShift}
            onEndShift={handleEndShift}
            onSubmitManualShift={handleSubmitManualShift}
          />
        )}

        {activeTab === 'azkari' && (
          <AzkariView
            schedules={classSchedules}
            prayerTimes={prayerTimes}
            classes={classes}
            currentUser={currentUser}
            isGeneralSupervisor={isGeneralSupervisor}
            onSaveSchedule={handleSaveClassSchedule}
          />
        )}

        {activeTab === 'quran_prayer' && (
          <QuranPrayerView
            prayerTimes={prayerTimes}
            isGeneralSupervisor={isGeneralSupervisor}
            onSavePrayerTimes={handleSavePrayerTimes}
          />
        )}

        {activeTab === 'tuition' && isGeneralSupervisor && (
          <TuitionManagementView
            students={students}
            classes={classes}
            onToggleTuition={handleToggleTuition}
          />
        )}

        {activeTab === 'supervisors' && isGeneralSupervisor && (
          <SupervisorsManagementView
            supervisors={supervisors}
            classes={classes}
            shifts={shifts}
            onAddSupervisor={handleAddSupervisor}
            onUpdateSupervisor={handleUpdateSupervisor}
            onDeleteSupervisor={handlePromptDeleteSupervisor}
            onApproveShift={handleApproveShift}
            onUpdateShift={handleUpdateShift}
          />
        )}

        {activeTab === 'classes' && (
          <ClassesManagementView
            classes={classes}
            students={students}
            currentUser={currentUser}
            onAddClass={handleAddClass}
            onUpdateClass={handleUpdateClass}
            onEditStudent={(st) => setEditingStudent(st)}
            onDeleteStudent={handlePromptDeleteStudent}
            onDeleteClass={handlePromptDeleteClass}
            isGeneralSupervisor={isGeneralSupervisor}
          />
        )}
      </main>

      <nav
        aria-label="التنقل السريع"
        className="fixed bottom-0 left-0 right-0 z-40 bg-emerald-950 border-t border-emerald-800/80 shadow-[0_-4px_20px_rgba(0,0,0,0.3)] md:hidden px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
      >
        <div className="grid grid-cols-5 gap-1 max-w-lg mx-auto">
          {['dashboard', 'passport', 'analytics', 'self_attendance']
            .map(tabId => navItems.find(tab => tab.id === tabId))
            .filter(Boolean)
            .map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`min-h-11 rounded-xl text-[10px] font-bold flex flex-col items-center justify-center gap-0.5 transition-all ${
                    isActive ? 'bg-amber-400 text-emerald-950 font-black shadow-md' : 'text-emerald-200 hover:bg-emerald-900 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.id === 'dashboard' ? 'الرئيسية' : tab.id === 'passport' ? 'الجواز' : tab.id === 'analytics' ? 'الإحصائيات' : 'البصمة'}</span>
                </button>
              );
            })}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="فتح قائمة النظام"
            className="min-h-11 rounded-xl text-[10px] font-bold flex flex-col items-center justify-center gap-0.5 text-emerald-200 hover:bg-emerald-900 hover:text-white"
          >
            <Menu className="w-5 h-5" />
            <span>المزيد</span>
          </button>
        </div>
      </nav>

      {isEnrollModalOpen && (
        <StudentEnrollModal
          classes={classes}
          currentUser={currentUser}
          onClose={() => setIsEnrollModalOpen(false)}
          onEnroll={handleEnrollStudent}
        />
      )}

      {editingStudent && (
        <StudentEditModal
          student={editingStudent}
          classes={classes}
          onClose={() => setEditingStudent(null)}
          onSave={handleUpdateStudent}
        />
      )}

      {confirmDeleteModal.isOpen && confirmDeleteModal.item && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
              <Trash2 className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900">
                تأكيد حذف {
                  confirmDeleteModal.type === 'student'
                    ? 'الطالب'
                    : confirmDeleteModal.type === 'supervisor'
                      ? 'المشرف'
                      : 'الشُعبة'
                }
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                هل أنت متأكد من رغبتك في حذف <strong className="text-slate-800">{confirmDeleteModal.item.name}</strong>؟
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-right text-xs text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>سيتم نقله إلى سلة المهملات:</span>
              </div>
              <p className="text-[11px] text-amber-800">
                لن يتم حذفه نهائياً مباشرة، يمكنك استعادته في أي وقت من خلال سلة المهملات.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDeleteModal({ isOpen: false, item: null, type: null })}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                إلغاء التراجع
              </button>
              <button
                type="button"
                onClick={handleConfirmMoveToTrash}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-sm"
              >
                نقل إلى سلة المهملات
              </button>
            </div>
          </div>
        </div>
      )}

      {isTrashModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">سلة المهملات والمحذوفات</h3>
                  <p className="text-xs text-slate-500">استعادة الطلاب أو المشرفين أو الشُعب المحذوفة أو مسحها نهائياً.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsTrashModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2">
              {trashItems.map(item => {
                const isStudent = item.type === 'student';
                const isClass = item.type === 'class';
                return (
                  <div key={item.id} className="bg-slate-50 hover:bg-slate-100/80 p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          isStudent ? 'bg-blue-100 text-blue-900' : 'bg-amber-100 text-amber-950'
                        }`}>
                          {isStudent ? 'طالب' : isClass ? 'شُعبة' : 'مشرف'}
                        </span>
                        <h4 className="font-black text-slate-900 text-sm">{item.data.name}</h4>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        تاريخ الحذف: <span className="font-mono">{item.deletedAt}</span>
                        {' • '}
                        المنفذ: <span className="font-bold">{item.deletedBy || 'المشرف العام'}</span>
                        {' • '}
                        {isStudent
                          ? `الأجزاء: ${item.data.juzMemorized}`
                          : isClass
                            ? `${item.data.room} • ${item.data.level}`
                            : ('roleTitle' in item.data ? item.data.roleTitle : 'بيانات المشرف')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRestoreFromTrash(item.id)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 flex items-center gap-1 transition-all"
                        title="استعادة وإرجاع للسجلات النشطة"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>استعادة</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePermanentDelete(item.id)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-all"
                        title="حذف نهائي بدون استرجاع"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {trashItems.length === 0 && (
                <div className="py-12 text-center space-y-2">
                  <Trash2 className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-500 font-bold">سلة المهملات فارغة حالياً.</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsTrashModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}