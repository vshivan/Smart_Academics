"use client";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// ── Page tour scripts ─────────────────────────────────────────
const PAGE_TOURS: Record<string, { title: string; steps: string[] }> = {
  "/": {
    title: "Welcome to SAAP!",
    steps: [
      "👋 Hi! I'm Prof. Byte, your AI teaching assistant!",
      "📚 SAAP automates question paper generation, assignment evaluation, and academic analytics.",
      "🔐 Click **Sign in with Google** to get started. It's quick and secure!",
      "✨ Once logged in, you'll land on your personal dashboard.",
    ],
  },
  "/dashboard": {
    title: "Your Dashboard",
    steps: [
      "🏠 Welcome to your Dashboard! This is your command centre.",
      "📄 **Upload Syllabus** — Upload your subject PDF once. I'll extract all topics automatically!",
      "📝 **Question Papers** — Generate Bloom's taxonomy-mapped papers in seconds.",
      "✅ **Evaluation** — Auto-grade assignments fetched from Google Classroom.",
      "📊 **Analytics** — Track student performance trends and submission stats.",
    ],
  },
  "/dashboard/syllabus": {
    title: "Syllabus Upload",
    steps: [
      "📂 This is the Syllabus Upload page.",
      "🔑 Enter your **Subject ID** — this links the syllabus to a subject.",
      "📎 Choose the file type: **Syllabus** or **Reference Material**.",
      "⬆️ Upload your PDF. I'll extract topics, units, and Bloom's levels automatically!",
      "♻️ Smart deduplication: uploading the same file twice won't reprocess it.",
      "✅ Once processed, the status changes to **done** and you can generate papers!",
    ],
  },
  "/dashboard/papers": {
    title: "Question Paper Generator",
    steps: [
      "📝 This is the Question Paper Generator.",
      "🔑 Enter the **Subject ID** you uploaded a syllabus for.",
      "🎯 Choose **Exam Type**: Midterm, Final, or Quiz.",
      "🔢 Set **Total Marks** — I'll scale the paper structure automatically.",
      "⚡ Click **Generate** — I'll create **2 paper sets (A & B)** instantly!",
      "✏️ You can edit any question by clicking the pencil icon.",
      "🔒 Click **Finalize** when you're happy — the paper is locked for distribution.",
    ],
  },
  "/dashboard/evaluation": {
    title: "Assignment Evaluation",
    steps: [
      "✅ This is the Assignment Evaluation page.",
      "🏫 Enter your **Class ID** and **Google Coursework ID** from Google Classroom.",
      "📋 Paste the **Answer Key** and comma-separated **Keywords**.",
      "🚀 Click **Start Evaluation** — I'll fetch all submissions and grade them!",
      "🤖 Grading uses keyword matching + semantic similarity (no expensive AI!).",
      "⚠️ Low-confidence results are flagged with an orange warning for your review.",
      "✏️ You can override any grade using the edit icon.",
    ],
  },
  "/dashboard/analytics": {
    title: "Analytics Dashboard",
    steps: [
      "📊 This is the Analytics Dashboard.",
      "🔑 Enter your **Class ID** and click **Load** to see data.",
      "🥧 The **Score Distribution** pie chart shows how marks are spread.",
      "📈 The **Assignment Trends** bar chart tracks average scores over time.",
      "🚩 Flagged submissions (needing review) are highlighted in the session cards.",
    ],
  },
};

// ── FAQ data ──────────────────────────────────────────────────
const FAQS: { q: string; a: string }[] = [
  {
    q: "How do I upload a syllabus?",
    a: "Go to **Upload Syllabus**, enter your Subject ID, choose file type, and upload your PDF. I'll process it automatically!",
  },
  {
    q: "Can I upload the same file twice?",
    a: "No need! SAAP detects duplicate files using a SHA-256 hash. Re-uploading the same PDF reuses the existing knowledge graph.",
  },
  {
    q: "What is a Subject ID?",
    a: "A Subject ID is a unique identifier for your subject (e.g., `CS101`). Use the same ID when uploading a syllabus and generating papers.",
  },
  {
    q: "How does question generation work?",
    a: "I extract topics from your syllabus, then use Bloom's taxonomy rules to create questions. No expensive AI — it's fast and free!",
  },
  {
    q: "What is Bloom's taxonomy?",
    a: "It's a 6-level framework: Remember → Understand → Apply → Analyze → Evaluate → Create. Papers are distributed across these levels.",
  },
  {
    q: "How does evaluation work?",
    a: "I fetch student PDFs from Google Classroom, extract text, then score using keyword matching (40%) + semantic similarity (40%) + rubric (20%).",
  },
  {
    q: "What does 'flagged for review' mean?",
    a: "When my confidence is low (keyword and semantic scores disagree), I flag the result so you can manually verify and override if needed.",
  },
  {
    q: "Can I edit generated questions?",
    a: "Yes! Click the pencil icon next to any question on the Papers page to edit the text, marks, or answer key before finalizing.",
  },
  {
    q: "What file types are supported?",
    a: "PDF files only. Scanned PDFs are handled via OCR fallback automatically.",
  },
  {
    q: "How do I connect Google Classroom?",
    a: "Sign in with Google — SAAP requests Classroom permissions during login. Your tokens are stored securely and used only for fetching submissions.",
  },
];

// ── Teacher face SVG ──────────────────────────────────────────
function TeacherFace({ talking }: { talking: boolean }) {
  return (
    <svg viewBox="0 0 80 80" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      {/* Head */}
      <circle cx="40" cy="38" r="28" fill="#FDDBB4" stroke="#E8A87C" strokeWidth="2" />
      {/* Hair */}
      <ellipse cx="40" cy="13" rx="22" ry="10" fill="#4A3728" />
      <rect x="18" y="13" width="6" height="14" rx="3" fill="#4A3728" />
      <rect x="56" y="13" width="6" height="14" rx="3" fill="#4A3728" />
      {/* Glasses frame */}
      <circle cx="30" cy="36" r="9" fill="none" stroke="#4A3728" strokeWidth="2.5" />
      <circle cx="50" cy="36" r="9" fill="none" stroke="#4A3728" strokeWidth="2.5" />
      <line x1="39" y1="36" x2="41" y2="36" stroke="#4A3728" strokeWidth="2.5" />
      <line x1="21" y1="36" x2="17" y2="34" stroke="#4A3728" strokeWidth="2.5" />
      <line x1="59" y1="36" x2="63" y2="34" stroke="#4A3728" strokeWidth="2.5" />
      {/* Eyes */}
      <circle cx="30" cy="36" r="4" fill="white" />
      <circle cx="50" cy="36" r="4" fill="white" />
      <circle cx="31" cy="36" r="2" fill="#2C1810" />
      <circle cx="51" cy="36" r="2" fill="#2C1810" />
      {/* Eye shine */}
      <circle cx="32" cy="35" r="0.8" fill="white" />
      <circle cx="52" cy="35" r="0.8" fill="white" />
      {/* Eyebrows */}
      <path d="M23 28 Q30 25 37 28" stroke="#4A3728" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M43 28 Q50 25 57 28" stroke="#4A3728" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Nose */}
      <ellipse cx="40" cy="44" rx="3" ry="2" fill="#E8A87C" />
      {/* Mouth */}
      {talking ? (
        <ellipse cx="40" cy="52" rx="7" ry="4" fill="#C0392B" />
      ) : (
        <path d="M33 51 Q40 57 47 51" stroke="#C0392B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      )}
      {/* Cheeks */}
      <circle cx="22" cy="46" r="5" fill="#F4A0A0" opacity="0.5" />
      <circle cx="58" cy="46" r="5" fill="#F4A0A0" opacity="0.5" />
      {/* Collar / shirt */}
      <path d="M15 66 Q20 58 30 60 L40 65 L50 60 Q60 58 65 66 Q55 72 40 74 Q25 72 15 66Z" fill="#2980B9" />
      {/* Tie */}
      <path d="M37 60 L40 65 L43 60 L41 68 L40 72 L39 68Z" fill="#E74C3C" />
    </svg>
  );
}

// ── Main Bot Component ────────────────────────────────────────
export default function TeacherBot() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"tour" | "faq" | "chat">("tour");
  const [tourStep, setTourStep] = useState(0);
  const [talking, setTalking] = useState(false);
  const [faqSearch, setFaqSearch] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: "bot" | "user"; text: string }[]>([]);
  const [showBubble, setShowBubble] = useState(false);
  const [bubbleText, setBubbleText] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const tour = PAGE_TOURS[pathname] || PAGE_TOURS["/dashboard"];
  const currentStep = tour.steps[tourStep] ?? "";

  // Auto-greet on page change
  useEffect(() => {
    setTourStep(0);
    setMode("tour");
    setBubbleText(`👋 I can give you a tour of this page!`);
    setShowBubble(true);
    const t = setTimeout(() => setShowBubble(false), 4000);
    return () => clearTimeout(t);
  }, [pathname]);

  // Talking animation when step changes
  useEffect(() => {
    if (open && mode === "tour") {
      setTalking(true);
      const t = setTimeout(() => setTalking(false), 800);
      return () => clearTimeout(t);
    }
  }, [tourStep, open, mode]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const filteredFaqs = FAQS.filter(
    (f) =>
      faqSearch === "" ||
      f.q.toLowerCase().includes(faqSearch.toLowerCase()) ||
      f.a.toLowerCase().includes(faqSearch.toLowerCase())
  );

  function handleChatSend() {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatHistory((h) => [...h, { role: "user", text: userMsg }]);

    // Simple FAQ matching
    const lower = userMsg.toLowerCase();
    const match = FAQS.find(
      (f) =>
        f.q.toLowerCase().includes(lower) ||
        lower.includes(f.q.toLowerCase().split(" ").slice(0, 3).join(" "))
    );

    setTimeout(() => {
      if (match) {
        setChatHistory((h) => [...h, { role: "bot", text: match.a }]);
      } else if (lower.includes("tour") || lower.includes("help")) {
        setChatHistory((h) => [
          ...h,
          { role: "bot", text: "Sure! Click the **Tour** tab and I'll walk you through this page step by step! 🎓" },
        ]);
      } else if (lower.includes("hello") || lower.includes("hi")) {
        setChatHistory((h) => [
          ...h,
          { role: "bot", text: "Hello there! 👋 I'm Prof. Byte. Ask me anything about SAAP, or click **FAQ** for common questions!" },
        ]);
      } else {
        setChatHistory((h) => [
          ...h,
          {
            role: "bot",
            text: "Hmm, I'm not sure about that! Try checking the **FAQ** tab, or ask me something like *'How do I upload a syllabus?'* 🤔",
          },
        ]);
      }
    }, 400);
  }

  function renderMarkdown(text: string) {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/`(.*?)`/g, "<code class='bg-gray-100 px-1 rounded text-xs'>$1</code>");
  }

  return (
    <>
      {/* Floating bubble hint */}
      {showBubble && !open && (
        <div className="fixed bottom-24 right-6 z-50 bg-white border border-blue-200 rounded-2xl rounded-br-none shadow-lg px-4 py-2 text-sm text-gray-700 max-w-[200px] animate-bounce-once">
          {bubbleText}
        </div>
      )}

      {/* Bot toggle button */}
      <button
        onClick={() => { setOpen((o) => !o); setShowBubble(false); }}
        className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full shadow-2xl border-2 border-blue-400 bg-white hover:scale-110 transition-transform"
        title="Prof. Byte — AI Assistant"
      >
        <TeacherFace talking={talking} />
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{ maxHeight: "520px" }}>

          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white border-2 border-blue-300 flex-shrink-0 overflow-hidden">
              <TeacherFace talking={talking} />
            </div>
            <div>
              <p className="text-white font-bold text-sm">Prof. Byte</p>
              <p className="text-blue-100 text-xs">Your SAAP Guide 🎓</p>
            </div>
            <button onClick={() => setOpen(false)} className="ml-auto text-white hover:text-blue-200 text-lg leading-none">✕</button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            {(["tour", "faq", "chat"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setMode(tab)}
                className={`flex-1 py-2 text-xs font-semibold capitalize transition ${
                  mode === tab
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {tab === "tour" ? "🗺️ Tour" : tab === "faq" ? "❓ FAQ" : "💬 Chat"}
              </button>
            ))}
          </div>

          {/* ── TOUR MODE ── */}
          {mode === "tour" && (
            <div className="flex flex-col flex-1 p-4 gap-3 overflow-y-auto">
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">{tour.title}</p>

              {/* Step indicator */}
              <div className="flex gap-1">
                {tour.steps.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-all ${
                      i === tourStep ? "bg-blue-500" : i < tourStep ? "bg-blue-200" : "bg-gray-200"
                    }`}
                  />
                ))}
              </div>

              {/* Bot + speech bubble */}
              <div className="flex items-start gap-3 bg-blue-50 rounded-xl p-3">
                <div className="w-12 h-12 flex-shrink-0">
                  <TeacherFace talking={talking} />
                </div>
                <p
                  className="text-sm text-gray-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(currentStep) }}
                />
              </div>

              {/* Navigation */}
              <div className="flex gap-2 mt-auto">
                <button
                  onClick={() => setTourStep((s) => Math.max(0, s - 1))}
                  disabled={tourStep === 0}
                  className="flex-1 py-2 rounded-lg border text-sm font-medium disabled:opacity-30 hover:bg-gray-50 transition"
                >
                  ← Back
                </button>
                {tourStep < tour.steps.length - 1 ? (
                  <button
                    onClick={() => setTourStep((s) => s + 1)}
                    className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
                  >
                    Next →
                  </button>
                ) : (
                  <button
                    onClick={() => { setTourStep(0); setOpen(false); }}
                    className="flex-1 py-2 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition"
                  >
                    Done ✓
                  </button>
                )}
              </div>
              <p className="text-center text-xs text-gray-400">
                Step {tourStep + 1} of {tour.steps.length}
              </p>
            </div>
          )}

          {/* ── FAQ MODE ── */}
          {mode === "faq" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="p-3 border-b">
                <input
                  value={faqSearch}
                  onChange={(e) => setFaqSearch(e.target.value)}
                  placeholder="Search questions..."
                  className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                {filteredFaqs.map((faq, i) => (
                  <FAQItem key={i} q={faq.q} a={faq.a} renderMarkdown={renderMarkdown} />
                ))}
                {filteredFaqs.length === 0 && (
                  <p className="text-center text-sm text-gray-400 py-8">No results found 🤷</p>
                )}
              </div>
            </div>
          )}

          {/* ── CHAT MODE ── */}
          {mode === "chat" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {chatHistory.length === 0 && (
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 flex-shrink-0">
                      <TeacherFace talking={false} />
                    </div>
                    <div className="bg-blue-50 rounded-xl rounded-tl-none px-3 py-2 text-sm text-gray-700 max-w-[85%]">
                      Hi! I'm Prof. Byte 👋 Ask me anything about SAAP!
                    </div>
                  </div>
                )}
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`flex items-start gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    {msg.role === "bot" && (
                      <div className="w-8 h-8 flex-shrink-0">
                        <TeacherFace talking={false} />
                      </div>
                    )}
                    <div
                      className={`px-3 py-2 rounded-xl text-sm max-w-[85%] ${
                        msg.role === "bot"
                          ? "bg-blue-50 text-gray-700 rounded-tl-none"
                          : "bg-blue-600 text-white rounded-tr-none"
                      }`}
                      dangerouslySetInnerHTML={{ __html: msg.role === "bot" ? renderMarkdown(msg.text) : msg.text }}
                    />
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="p-3 border-t flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleChatSend()}
                  placeholder="Ask me anything..."
                  className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <button
                  onClick={handleChatSend}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition"
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── Collapsible FAQ item ──────────────────────────────────────
function FAQItem({
  q, a, renderMarkdown,
}: {
  q: string;
  a: string;
  renderMarkdown: (t: string) => string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="px-3 py-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left flex items-start justify-between gap-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition"
      >
        <span>{q}</span>
        <span className="text-gray-400 flex-shrink-0 mt-0.5">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <p
          className="mt-1.5 text-xs text-gray-500 leading-relaxed pl-1"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(a) }}
        />
      )}
    </div>
  );
}
