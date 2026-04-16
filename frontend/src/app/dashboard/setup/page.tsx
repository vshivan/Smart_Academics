"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createCollege, listColleges, createSubject, listSubjects, createClass, listClasses, createAcademicYear, listAcademicYears } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Building2, BookOpen, Users, ChevronRight, RefreshCw, CheckCircle } from "lucide-react";

type Step = "college" | "year" | "subject" | "class" | "done";

const STEPS = [
  { key: "college", label: "College",       icon: Building2 },
  { key: "year",    label: "Academic Year", icon: ChevronRight },
  { key: "subject", label: "Subject",       icon: BookOpen },
  { key: "class",   label: "Class",         icon: Users },
];

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export default function SetupPage() {
  const { success, error: toastError } = useToast();
  const [step, setStep] = useState<Step>("college");
  const [collegeId, setCollegeId] = useState("");
  const [yearId, setYearId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const { data: colleges, refetch: refetchColleges } = useQuery({ queryKey: ["colleges"], queryFn: listColleges });
  const { data: years,    refetch: refetchYears }    = useQuery({ queryKey: ["years", collegeId],    queryFn: () => listAcademicYears(collegeId), enabled: !!collegeId });
  const { data: subjects, refetch: refetchSubjects } = useQuery({ queryKey: ["subjects", collegeId], queryFn: () => listSubjects(collegeId),     enabled: !!collegeId });
  const { data: classes,  refetch: refetchClasses }  = useQuery({ queryKey: ["classes", collegeId],  queryFn: () => listClasses(collegeId),       enabled: !!collegeId });

  const createCollegeMut = useMutation({
    mutationFn: createCollege,
    onSuccess: (d) => { setCollegeId(d.id); refetchColleges(); setStep("year"); reset(); success("College created!", d.name); },
    onError: () => toastError("Failed to create college"),
  });
  const createYearMut = useMutation({
    mutationFn: (d: any) => createAcademicYear(collegeId, d),
    onSuccess: (d) => { setYearId(d.id); refetchYears(); setStep("subject"); reset(); success("Academic year created!", d.label); },
    onError: () => toastError("Failed to create academic year"),
  });
  const createSubjectMut = useMutation({
    mutationFn: (d: any) => createSubject(collegeId, { ...d, academic_year_id: yearId }),
    onSuccess: (d) => { setSubjectId(d.id); refetchSubjects(); setStep("class"); reset(); success("Subject created!", d.name); },
    onError: () => toastError("Failed to create subject"),
  });
  const createClassMut = useMutation({
    mutationFn: (d: any) => createClass(collegeId, { ...d, subject_id: subjectId, academic_year_id: yearId }),
    onSuccess: (d) => { refetchClasses(); setStep("done"); reset(); success("Class created!", d.name); },
    onError: () => toastError("Failed to create class"),
  });

  const currentStepIdx = STEPS.findIndex(s => s.key === step);
  const inputClass = (hasError: boolean) =>
    `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 ${hasError ? "border-red-400 bg-red-50" : "border-gray-300"}`;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">College Setup Wizard</h1>
        <p className="text-gray-500 text-sm mt-0.5">Set up your college structure step by step.</p>
      </div>

      {/* Progress stepper */}
      <div className="flex items-center mb-8">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step === s.key ? "bg-blue-600 text-white ring-4 ring-blue-100" :
                currentStepIdx > i ? "bg-green-500 text-white" : "bg-gray-100 text-gray-400"
              }`}>
                {currentStepIdx > i ? <CheckCircle size={16} /> : i + 1}
              </div>
              <span className={`text-xs mt-1 hidden sm:block ${step === s.key ? "text-blue-600 font-medium" : "text-gray-400"}`}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mb-4 ${currentStepIdx > i ? "bg-green-400" : "bg-gray-200"}`} />
            )}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {/* College step */}
        {step === "college" && (
          <>
            <h2 className="font-semibold text-gray-900 mb-4">Create or Select College</h2>
            {colleges?.colleges?.length > 0 && (
              <div className="mb-5">
                <p className="text-xs text-gray-500 mb-2 font-medium">Existing colleges — click to select:</p>
                <div className="space-y-1.5">
                  {colleges.colleges.map((c: any) => (
                    <button key={c.id} onClick={() => { setCollegeId(c.id); setStep("year"); }}
                      className="w-full text-left px-3 py-2.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-sm flex justify-between items-center transition">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-gray-400 text-xs">{c.domain}</span>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">or create new</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
              </div>
            )}
            <form onSubmit={handleSubmit((d) => createCollegeMut.mutate(d))} className="space-y-3">
              <Field label="College Name" required error={errors.name?.message as string}>
                <input {...register("name", { required: "College name is required" })} placeholder="e.g. MIT College of Engineering" className={inputClass(!!errors.name)} />
              </Field>
              <Field label="Domain" error={errors.domain?.message as string}>
                <input {...register("domain")} placeholder="e.g. mit.edu" className={inputClass(false)} />
              </Field>
              <Field label="Address">
                <input {...register("address")} placeholder="Full address" className={inputClass(false)} />
              </Field>
              <button type="submit" disabled={createCollegeMut.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition">
                {createCollegeMut.isPending ? <><RefreshCw size={14} className="animate-spin" /> Creating...</> : "Create College →"}
              </button>
            </form>
          </>
        )}

        {/* Year step */}
        {step === "year" && (
          <>
            <h2 className="font-semibold text-gray-900 mb-4">Academic Year</h2>
            {years?.academic_years?.length > 0 && (
              <div className="mb-4 space-y-1.5">
                {years.academic_years.map((y: any) => (
                  <button key={y.id} onClick={() => { setYearId(y.id); setStep("subject"); }}
                    className="w-full text-left px-3 py-2.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-sm flex justify-between items-center transition">
                    <span className="font-medium">{y.label}</span>
                    {y.is_current && <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Current</span>}
                  </button>
                ))}
                <div className="flex items-center gap-3 my-3">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">or create new</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
              </div>
            )}
            <form onSubmit={handleSubmit((d) => createYearMut.mutate(d))} className="space-y-3">
              <Field label="Year Label" required error={errors.label?.message as string}>
                <input {...register("label", { required: "Year label is required" })} placeholder="e.g. 2024-25" className={inputClass(!!errors.label)} />
              </Field>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" {...register("is_current")} className="rounded" />
                Set as current academic year
              </label>
              <button type="submit" disabled={createYearMut.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition">
                {createYearMut.isPending ? <><RefreshCw size={14} className="animate-spin" /> Creating...</> : "Create Year →"}
              </button>
            </form>
          </>
        )}

        {/* Subject step */}
        {step === "subject" && (
          <>
            <h2 className="font-semibold text-gray-900 mb-4">Create Subject</h2>
            <form onSubmit={handleSubmit((d) => createSubjectMut.mutate(d))} className="space-y-3">
              <Field label="Subject Name" required error={errors.name?.message as string}>
                <input {...register("name", { required: "Subject name is required" })} placeholder="e.g. Database Management Systems" className={inputClass(!!errors.name)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Subject Code">
                  <input {...register("code")} placeholder="e.g. CS301" className={inputClass(false)} />
                </Field>
                <Field label="Department">
                  <input {...register("department")} placeholder="e.g. Computer Science" className={inputClass(false)} />
                </Field>
                <Field label="Semester">
                  <input {...register("semester")} type="number" min={1} max={8} placeholder="e.g. 5" className={inputClass(false)} />
                </Field>
                <Field label="Credits">
                  <input {...register("credits")} type="number" defaultValue={3} min={1} max={6} className={inputClass(false)} />
                </Field>
              </div>
              <Field label="Language">
                <select {...register("language")} className={inputClass(false)}>
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="mr">Marathi</option>
                  <option value="ta">Tamil</option>
                  <option value="te">Telugu</option>
                </select>
              </Field>
              <button type="submit" disabled={createSubjectMut.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition">
                {createSubjectMut.isPending ? <><RefreshCw size={14} className="animate-spin" /> Creating...</> : "Create Subject →"}
              </button>
            </form>
          </>
        )}

        {/* Class step */}
        {step === "class" && (
          <>
            <h2 className="font-semibold text-gray-900 mb-4">Create Class Section</h2>
            <form onSubmit={handleSubmit((d) => createClassMut.mutate(d))} className="space-y-3">
              <Field label="Class Name" required error={errors.name?.message as string}>
                <input {...register("name", { required: "Class name is required" })} placeholder="e.g. CS-A 2024" className={inputClass(!!errors.name)} />
              </Field>
              <Field label="Google Classroom ID">
                <input {...register("google_classroom_id")} placeholder="Optional — paste from Google Classroom" className={inputClass(false)} />
                <p className="text-xs text-gray-400 mt-1">Find this in Google Classroom → Settings → Class code</p>
              </Field>
              <button type="submit" disabled={createClassMut.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition">
                {createClassMut.isPending ? <><RefreshCw size={14} className="animate-spin" /> Creating...</> : "Create Class →"}
              </button>
            </form>
          </>
        )}

        {/* Done */}
        {step === "done" && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-500" />
            </div>
            <h2 className="font-bold text-lg text-gray-900 mb-1">Setup Complete!</h2>
            <p className="text-gray-500 text-sm mb-6">Your college structure is ready. Start uploading syllabi and generating papers.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setStep("subject")} className="border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm transition">
                Add Another Subject
              </button>
              <a href="/dashboard/syllabus" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
                Upload Syllabus →
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Summary stats */}
      {collegeId && step !== "done" && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: "Subjects", value: subjects?.subjects?.length ?? 0 },
            { label: "Classes",  value: classes?.classes?.length ?? 0 },
            { label: "Years",    value: years?.academic_years?.length ?? 0 },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <div className="text-xl font-bold text-blue-600">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
