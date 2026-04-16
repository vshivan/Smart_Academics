import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const FEATURES = [
  {
    icon: "📄",
    title: "Smart Question Papers",
    desc: "Generate Bloom's taxonomy-mapped papers with answer keys in seconds. Choose from presets or set custom distributions.",
    color: "blue",
  },
  {
    icon: "✅",
    title: "Auto Evaluation",
    desc: "Grade assignments fetched directly from Google Classroom using keyword matching + semantic similarity.",
    color: "green",
  },
  {
    icon: "📊",
    title: "Academic Analytics",
    desc: "Track score distributions, submission trends, and flag low-confidence results for manual review.",
    color: "purple",
  },
  {
    icon: "🏛️",
    title: "College Management",
    desc: "Multi-tenant setup for colleges, departments, subjects, and classes with role-based access.",
    color: "orange",
  },
  {
    icon: "🗄️",
    title: "Question Bank",
    desc: "Build a searchable bank of questions across subjects, Bloom's levels, and difficulty.",
    color: "teal",
  },
  {
    icon: "🔍",
    title: "Plagiarism Detection",
    desc: "Compare student submissions using TF-IDF cosine similarity and flag suspicious pairs.",
    color: "red",
  },
];

const STATS = [
  { value: "80–90%", label: "Deterministic NLP" },
  { value: "0 AI cost", label: "No OpenAI required" },
  { value: "15+", label: "Built-in features" },
  { value: "Multi-tenant", label: "College isolation" },
];

const COLOR_BG: Record<string, string> = {
  blue:   "bg-blue-50",
  green:  "bg-green-50",
  purple: "bg-purple-50",
  orange: "bg-orange-50",
  teal:   "bg-teal-50",
  red:    "bg-red-50",
};

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
        <div className="flex items-center gap-4">
          <a href={`${API_URL}/docs`} target="_blank"
            className="text-sm text-gray-500 hover:text-blue-600 transition hidden sm:block">
            API Docs
          </a>
          <a href={`${API_URL}/auth/login`}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
            Sign in with Google
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
          Built for Indian colleges · No expensive AI
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-5">
          Smart Academic<br />
          <span className="text-blue-600">Automation Platform</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-8 leading-relaxed">
          Automate question paper generation, assignment evaluation, and academic analytics
          using NLP — not expensive AI. Built for faculty, designed for scale.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a href={`${API_URL}/auth/login`}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl transition text-sm">
            Get Started — Sign in with Google →
          </a>
          <a href={`${API_URL}/docs`} target="_blank"
            className="w-full sm:w-auto border border-gray-200 hover:border-gray-300 text-gray-600 font-medium px-6 py-3 rounded-xl transition text-sm">
            View API Docs
          </a>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-gray-50 border-y border-gray-100 py-10">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {STATS.map(s => (
            <div key={s.label}>
              <div className="text-2xl font-bold text-blue-600 mb-1">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">Everything you need</h2>
        <p className="text-gray-500 text-center text-sm mb-10">15 features built in — no plugins, no extra cost</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(f => (
            <div key={f.title} className={`${COLOR_BG[f.color]} rounded-2xl p-5`}>
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-1.5">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 border-t border-gray-100 py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
            {[
              { step: "1", title: "Upload Syllabus", desc: "Upload your PDF once. Topics and units are extracted automatically." },
              { step: "2", title: "Generate Papers", desc: "Pick exam type and Bloom's distribution. Get 2 paper sets instantly." },
              { step: "3", title: "Evaluate", desc: "Connect Google Classroom. All submissions graded automatically." },
              { step: "4", title: "Analyse", desc: "View score distributions, trends, and flagged results." },
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

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Ready to automate your academic workflow?</h2>
        <p className="text-gray-500 text-sm mb-6">Sign in with your Google account to get started. No setup required.</p>
        <a href={`${API_URL}/auth/login`}
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl transition">
          Sign in with Google →
        </a>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400">
        SAAP — Smart Academic Automation Platform · Built with FastAPI + Next.js · 
        <a href={`${API_URL}/docs`} target="_blank" className="underline ml-1">API Docs</a>
      </footer>
    </div>
  );
}
