const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-8">
      <div className="text-center max-w-2xl">
        <h1 className="text-4xl font-bold text-blue-700 mb-3">
          Smart Academic Automation Platform
        </h1>
        <p className="text-gray-600 text-lg">
          Automate question paper generation, assignment evaluation, and academic analytics — powered by NLP, not expensive AI.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl">
        {[
          { title: "Question Papers", desc: "Generate Bloom's-mapped papers with answer keys in seconds", icon: "📄" },
          { title: "Auto Evaluation", desc: "Grade assignments via Google Classroom using keyword + semantic scoring", icon: "✅" },
          { title: "Analytics", desc: "Track performance trends, submission stats, and coverage gaps", icon: "📊" },
        ].map((f) => (
          <div key={f.title} className="bg-white rounded-xl shadow p-6 text-center">
            <div className="text-4xl mb-3">{f.icon}</div>
            <h3 className="font-semibold text-lg mb-1">{f.title}</h3>
            <p className="text-gray-500 text-sm">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Points directly to the API gateway OAuth endpoint */}
      <a
        href={`${API_URL}/auth/login`}
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg transition"
      >
        Sign in with Google
      </a>

      <p className="text-xs text-gray-400">
        API: {API_URL} &nbsp;|&nbsp;
        <a href={`${API_URL}/docs`} target="_blank" className="underline">Swagger Docs</a>
      </p>
    </main>
  );
}
