"use client";
import { useState } from "react";
import axios from "axios";
import { saveSession, type User } from "@/lib/auth";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const FEATURES = [
  { icon: "📄", title: "Smart Question Papers",  desc: "Generate Bloom's taxonomy-mapped papers with answer keys in seconds.",       color: "blue"   },
  { icon: "✅", title: "Auto Evaluation",         desc: "Grade assignments from Google Classroom using keyword + semantic scoring.",   color: "green"  },
  { icon: "📊", title: "Academic Analytics",      desc: "Track score distributions, trends, and flag low-confidence results.",        color: "purple" },
  { icon: "🏛️", title: "College Management",      desc: "Multi-tenant setup for colleges, departments, subjects, and classes.",       color: "orange" },
  { icon: "🎓", title: "CO-PO & OBE Reports",     desc: "Auto-generate NBA/NAAC attainment reports from evaluation data.",            color: "teal"   },
  { icon: "🔍", title: "Plagiarism Detection",    desc: "Compare student submissions using TF-IDF cosine similarity.",               color: "red"    },
];

const STATS = [
  { value: "30+",         label: "Built-in modules" },
  { value: "0 AI cost",   label: "Local NLP only" },
  { value: "Multi-tenant",label: "College isolation" },
  { value: "NBA/NAAC",    label: "Accreditation ready" },
];

const COLOR_BG: Record<string, string> = {
  blue: "bg-blue-50", green: "bg-green-50", purple: "bg-purple-50",
  orange: "bg-orange-50", teal: "bg-teal-50", red: "bg-red-50",
};

// ── OTP Login Form ────────────────────────────────────────────
function OTPLoginForm() {
  const router = useRouter();
  const [step, setStep]       = useState<"email" | "otp">("email");
  const [email, setEmail]     = useState("");
  const [otp, setOtp]         = useState("");
  const [name, setName]       = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [info, setInfo]       = useState("");

  async function requestOTP(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true); setError(""); setInfo("");
    try {
      await axios.post(`${API_URL}/auth/otp/request`, { email });
      setStep("otp");
      setInfo(`Code sent to ${email}. Check your inbox.`);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to send OTP. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOTP(e: React.FormEvent) {
    e.preventDefault();
    if (!otp) return;
    setLoading(true); setError("");
    try {
      const resp = await axios.post(`${API_URL}/auth/otp/verify`, { email, otp, name: name || undefined });
      const { access_token, user } = resp.data.data;
      saveSession(access_token, user as User);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Invalid or expired code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 w-full max-w-sm">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <span className="text-white text-sm font-bold">S</span>
        </div>
        <span className="font-bold text-gray-900">Sign in to SAAP</span>
      </div>

      {/* Google OAuth */}
      <a href={`${API_URL}/auth/login`}
        className="flex items-center justify-center gap-3 w-full border border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-gray-700 font-medium py-2.5 rounded-xl transition text-sm mb-4">
        <svg width="18" height="18" viewBox="0 0 18 18">
          <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
          <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
          <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
          <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
        </svg>
        Continue with Google
      </a>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400">or sign in with email</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* OTP flow */}
      {step === "email" ? (
        <form onSubmit={requestOTP} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email address</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@college.edu" required
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={loading || !email}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition">
            {loading ? "Sending…" : "Send Login Code →"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyOTP} className="space-y-3">
          {info && <p className="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2">{info}</p>}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">6-digit code</label>
            <input
              type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456" maxLength={6} required
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-center text-2xl font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Your name <span className="text-gray-400">(optional, for new accounts)</span></label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Dr. Sharma"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={loading || otp.length !== 6}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition">
            {loading ? "Verifying…" : "Verify & Sign In →"}
          </button>
          <button type="button" onClick={() => { setStep("email"); setOtp(""); setError(""); }}
            className="w-full text-xs text-gray-400 hover:text-gray-600 transition py-1">
            ← Use a different email
          </button>
        </form>
      )}

      <p className="text-[10px] text-gray-400 text-center mt-4">
        By signing in you agree to our terms of service.
      </p>
    </div>
  );
}

// ── Landing Page ──────────────────────────────────────────────
export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">S</span>
          </div>
          <span className="font-bold text-gray-900">SAAP</span>
        </div>
        <a href={`${API_URL}/docs`} target="_blank"
          className="text-sm text-gray-500 hover:text-blue-600 transition hidden sm:block">
          API Docs
        </a>
      </nav>

      {/* Hero — two column on desktop */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left — copy */}
          <div>
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
              Built for Indian colleges · NBA/NAAC ready
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-4">
              Smart Academic<br />
              <span className="text-blue-600">Automation Platform</span>
            </h1>
            <p className="text-lg text-gray-500 mb-6 leading-relaxed">
              Automate question paper generation, assignment evaluation, and academic analytics
              using NLP — not expensive AI. 30+ modules, zero setup.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {STATS.map(s => (
                <div key={s.label} className="bg-gray-50 rounded-xl p-3">
                  <div className="text-lg font-bold text-blue-600">{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — login form */}
          <div className="flex justify-center lg:justify-end">
            <OTPLoginForm />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 border-t border-gray-100 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">Everything you need</h2>
          <p className="text-gray-500 text-center text-sm mb-10">30+ modules built in — no plugins, no extra cost</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <div key={f.title} className={`${COLOR_BG[f.color]} rounded-2xl p-5`}>
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-1.5">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
            {[
              { step: "1", title: "Upload Syllabus",   desc: "Upload your PDF once. Topics and units are extracted automatically." },
              { step: "2", title: "Generate Papers",   desc: "Pick exam type and Bloom's distribution. Get 2 paper sets instantly." },
              { step: "3", title: "Evaluate",          desc: "Connect Google Classroom. All submissions graded automatically." },
              { step: "4", title: "Accreditation",     desc: "CO-PO mapping and OBE attainment reports generated from your data." },
            ].map(s => (
              <div key={s.step} className="text-center">
                <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm mx-auto mb-3">
                  {s.step}
                </div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1">{s.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400">
        SAAP — Smart Academic Automation Platform · FastAPI + Next.js ·{" "}
        <a href={`${API_URL}/docs`} target="_blank" className="underline">API Docs</a>
      </footer>
    </div>
  );
}
