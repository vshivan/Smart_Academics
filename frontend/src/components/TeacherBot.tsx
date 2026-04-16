"use client";
import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const PAGE_TOURS: Record<string, { title: string; steps: string[]; quickActions?: { label: string; path: string }[] }> = {
  "/": { title: "Welcome!", steps: ["Hi! I am Prof. Byte!", "SAAP automates academic tasks.", "Sign in with Google to start."] },
  "/dashboard": { title: "Dashboard", steps: ["Your command centre.", "Core: Syllabus, Papers, Evaluation, Analytics.", "Management: College setup, Departments.", "Features: Question Bank, Rubrics, Export, Plagiarism."], quickActions: [{ label: "Upload Syllabus", path: "/dashboard/syllabus" }, { label: "Generate Paper", path: "/dashboard/papers" }] },
  "/dashboard/syllabus": { title: "Syllabus Upload", steps: ["Enter Subject ID.", "Choose file type: Syllabus or Reference.", "Upload PDF - topics extracted automatically!", "Same file uploaded twice? No reprocessing."], quickActions: [{ label: "View Versions", path: "/dashboard/versions" }, { label: "Generate Paper", path: "/dashboard/papers" }] },
  "/dashboard/papers": { title: "Paper Generator", steps: ["Enter Subject ID.", "Choose Exam Type: Midterm, Final, Quiz.", "Bloom Mode = standard preset. Custom = your own sliders.", "Generates 2 sets (A and B).", "Edit questions with the pencil icon.", "Finalize to lock the paper."], quickActions: [{ label: "Export PDF", path: "/dashboard/export" }, { label: "Question Bank", path: "/dashboard/question-bank" }] },
  "/dashboard/evaluation": { title: "Evaluation", steps: ["Enter Class ID and Coursework ID.", "Paste Answer Key and Keywords.", "Grading: keywords 40% + semantic 40% + rubric 20%.", "Low-confidence results flagged for review.", "Override any grade with the edit icon.", "Batch override all flagged results at once."], quickActions: [{ label: "Plagiarism Check", path: "/dashboard/plagiarism" }, { label: "Rubric Builder", path: "/dashboard/rubrics" }] },
  "/dashboard/analytics": { title: "Analytics", steps: ["Enter Class ID and click Load.", "Score Distribution pie chart.", "Assignment Trends bar chart.", "Flagged submissions highlighted."] },
  "/dashboard/setup": { title: "College Setup", steps: ["Step 1: Create or select a College.", "Step 2: Create Academic Year.", "Step 3: Create Subject with code and department.", "Step 4: Create Class section.", "Done! Use Subject ID in Syllabus Upload."], quickActions: [{ label: "Upload Syllabus", path: "/dashboard/syllabus" }] },
  "/dashboard/departments": { title: "Departments", steps: ["Enter College ID and click Load.", "Summary shows subjects, classes, faculty, papers.", "Add departments and assign HOD.", "HOD gets department-wide analytics."] },
  "/dashboard/question-bank": { title: "Question Bank", steps: ["Search by topic, Bloom level, difficulty.", "Add questions manually or import from a paper.", "Usage count shows reuse frequency.", "Multi-language support available."] },
  "/dashboard/rubrics": { title: "Rubric Builder", steps: ["Click New Rubric to create one.", "Add criteria with name, keywords, weight.", "Higher weight = more impact on score.", "Share rubrics with all faculty."] },
  "/dashboard/versions": { title: "Syllabus Versions", steps: ["Enter Subject ID and click Load.", "Latest version is marked Current.", "Click Restore to roll back.", "Useful when a syllabus update breaks generation."] },
  "/dashboard/export": { title: "Export", steps: ["Enter Paper ID from the Papers page.", "Download PDF generates a formatted A4 paper.", "Toggle Include Answer Key for a separate sheet.", "Add to Bank imports questions to Question Bank."] },
  "/dashboard/plagiarism": { title: "Plagiarism", steps: ["Enter Session ID from Evaluation.", "Set similarity threshold (75% recommended).", "Click Check to compare all submissions.", "Pairs above threshold are flagged."] },
  "/dashboard/calibration": { title: "Calibration", steps: ["Enter Session ID after evaluation.", "Run Calibration computes average score.", ">=75% = Easy, 45-75% = Medium, <45% = Hard.", "Results stored for future paper generation."] },
  "/dashboard/notifications": { title: "Notifications", steps: ["Get notified when syllabus processing completes.", "Notified when evaluation finishes.", "Click to mark as read.", "Mark all read clears everything."] },
  "/dashboard/lms": { title: "LMS", steps: ["Google Classroom is already connected.", "Moodle, Canvas, Teams coming soon.", "Submissions fetched automatically during evaluation."] },
};

const FAQS = [
  { q: "How do I upload a syllabus?", a: "Go to Upload Syllabus, enter Subject ID, choose file type, upload PDF." },
  { q: "Can I upload the same file twice?", a: "No need - SAAP detects duplicates via SHA-256 hash and reuses the existing knowledge graph." },
  { q: "What is a Subject ID?", a: "A unique identifier for your subject (e.g. CS101). Use the same ID for syllabus upload and paper generation." },
  { q: "How does question generation work?", a: "Topics are extracted from your syllabus, then Bloom taxonomy rules create questions. No expensive AI!" },
  { q: "What is Bloom taxonomy?", a: "6-level framework: Remember, Understand, Apply, Analyze, Evaluate, Create. Papers are distributed across levels." },
  { q: "How does evaluation work?", a: "Student PDFs fetched from Google Classroom, text extracted, scored via keyword matching + semantic similarity + rubric." },
  { q: "What does flagged for review mean?", a: "When confidence is low (keyword and semantic scores disagree), the result is flagged for manual verification." },
  { q: "Can I edit generated questions?", a: "Yes! Click the pencil icon on the Papers page to edit text, marks, or answer key before finalizing." },
  { q: "What file types are supported?", a: "PDF only. Scanned PDFs use OCR fallback automatically." },
  { q: "How do I connect Google Classroom?", a: "Sign in with Google - SAAP requests Classroom permissions during login." },
  { q: "What is the Question Bank?", a: "A searchable store of all questions. Import from papers or add manually. Filter by Bloom level, difficulty, topic." },
  { q: "How does plagiarism detection work?", a: "TF-IDF cosine similarity compares all submissions in a session. Pairs above your threshold are flagged." },
  { q: "What is difficulty calibration?", a: "After evaluation, average scores determine if questions were Easy (>=75%), Medium (45-75%), or Hard (<45%)." },
  { q: "How do I export a paper as PDF?", a: "Go to Export, enter the Paper ID, optionally include answer key, click Download PDF." },
  { q: "What is a rubric?", a: "A rubric defines evaluation criteria with keywords and weights. Build one in Rubric Builder and use it in Evaluation." },
];

function TeacherFace({ talking, size = 40 }: { talking: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 80 80" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="38" r="28" fill="#FDDBB4" stroke="#E8A87C" strokeWidth="2" />
      <ellipse cx="40" cy="13" rx="22" ry="10" fill="#4A3728" />
      <rect x="18" y="13" width="6" height="14" rx="3" fill="#4A3728" />
      <rect x="56" y="13" width="6" height="14" rx="3" fill="#4A3728" />
      <circle cx="30" cy="36" r="9" fill="none" stroke="#4A3728" strokeWidth="2.5" />
      <circle cx="50" cy="36" r="9" fill="none" stroke="#4A3728" strokeWidth="2.5" />
      <line x1="39" y1="36" x2="41" y2="36" stroke="#4A3728" strokeWidth="2.5" />
      <line x1="21" y1="36" x2="17" y2="34" stroke="#4A3728" strokeWidth="2.5" />
      <line x1="59" y1="36" x2="63" y2="34" stroke="#4A3728" strokeWidth="2.5" />
      <circle cx="30" cy="36" r="4" fill="white" />
      <circle cx="50" cy="36" r="4" fill="white" />
      <circle cx="31" cy="36" r="2" fill="#2C1810" />
      <circle cx="51" cy="36" r="2" fill="#2C1810" />
      <circle cx="32" cy="35" r="0.8" fill="white" />
      <circle cx="52" cy="35" r="0.8" fill="white" />
      <path d="M23 28 Q30 25 37 28" stroke="#4A3728" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M43 28 Q50 25 57 28" stroke="#4A3728" strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="40" cy="44" rx="3" ry="2" fill="#E8A87C" />
      {talking ? (
        <ellipse cx="40" cy="52" rx="7" ry="4" fill="#C0392B" />
      ) : (
        <path d="M33 51 Q40 57 47 51" stroke="#C0392B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      )}
      <circle cx="22" cy="46" r="5" fill="#F4A0A0" opacity="0.5" />
      <circle cx="58" cy="46" r="5" fill="#F4A0A0" opacity="0.5" />
      <path d="M15 66 Q20 58 30 60 L40 65 L50 60 Q60 58 65 66 Q55 72 40 74 Q25 72 15 66Z" fill="#2980B9" />
      <path d="M37 60 L40 65 L43 60 L41 68 L40 72 L39 68Z" fill="#E74C3C" />
    </svg>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2 bg-blue-50 rounded-xl rounded-tl-none w-fit">
      {[0,1,2].map(i => (
        <span key={i} className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="px-3 py-2 border-b border-gray-50 last:border-0">
      <button onClick={() => setOpen(o => !o)} className="w-full text-left flex justify-between gap-2 text-xs font-medium text-gray-700 hover:text-blue-600 transition">
        <span>{q}</span>
        <span className="text-gray-300 flex-shrink-0">{open ? "▲" : "▼"}</span>
      </button>
      {open && <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">{a}</p>}
    </div>
  );
}

export default function TeacherBot() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"tour" | "faq" | "chat">("tour");
  const [tourStep, setTourStep] = useState(0);
  const [talking, setTalking] = useState(false);
  const [faqSearch, setFaqSearch] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: "bot" | "user"; text: string }[]>([]);
  const [typing, setTyping] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const tour = PAGE_TOURS[pathname] ?? PAGE_TOURS["/dashboard"];

  useEffect(() => {
    setTourStep(0);
    setMode("tour");
    setShowBubble(true);
    const t = setTimeout(() => setShowBubble(false), 4000);
    return () => clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    if (open && mode === "tour") {
      setTalking(true);
      const t = setTimeout(() => setTalking(false), 700);
      return () => clearTimeout(t);
    }
  }, [tourStep, open, mode]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, typing]);

  const filteredFaqs = FAQS.filter(f =>
    faqSearch === "" ||
    f.q.toLowerCase().includes(faqSearch.toLowerCase()) ||
    f.a.toLowerCase().includes(faqSearch.toLowerCase())
  );

  function botReply(text: string) {
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setChatHistory(h => [...h, { role: "bot", text }]);
    }, 600 + Math.random() * 400);
  }

  function handleChatSend() {
    const msg = chatInput.trim();
    if (!msg) return;
    setChatInput("");
    setChatHistory(h => [...h, { role: "user", text: msg }]);
    const lower = msg.toLowerCase();

    const faqMatch = FAQS.find(f =>
      lower.includes(f.q.toLowerCase().split(" ").slice(0, 4).join(" ")) ||
      f.q.toLowerCase().includes(lower.split(" ").slice(0, 3).join(" "))
    );

    if (faqMatch) {
      botReply(faqMatch.a);
    } else if (lower.includes("tour") || lower.includes("guide") || lower.includes("help")) {
      botReply("Click the Tour tab and I will walk you through this page step by step!");
    } else if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
      botReply("Hello! I am Prof. Byte. Ask me anything about SAAP, or click FAQ for common questions!");
    } else if (lower.includes("syllabus")) {
      botReply(FAQS[0].a);
    } else if (lower.includes("bloom") || lower.includes("taxonomy")) {
      botReply(FAQS[4].a);
    } else if (lower.includes("evaluat") || lower.includes("grade") || lower.includes("mark")) {
      botReply(FAQS[5].a);
    } else if (lower.includes("plagiar")) {
      botReply(FAQS[11].a);
    } else if (lower.includes("export") || lower.includes("pdf")) {
      botReply(FAQS[13].a);
    } else if (lower.includes("rubric")) {
      botReply(FAQS[14].a);
    } else if (lower.includes("bank") || lower.includes("question")) {
      botReply(FAQS[10].a);
    } else {
      botReply("I am not sure about that! Try the FAQ tab or ask something like: How do I upload a syllabus?");
    }
  }

  return (
    <>
      {showBubble && !open && (
        <div className="fixed bottom-24 right-6 z-50 bg-white border border-blue-200 rounded-2xl rounded-br-none shadow-lg px-3 py-2 text-xs text-gray-600 max-w-[180px]">
          Need help with this page?
        </div>
      )}

      <button
        onClick={() => { setOpen(o => !o); setShowBubble(false); }}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl border-2 border-blue-400 bg-white hover:scale-110 transition-transform"
        title="Prof. Byte"
      >
        <TeacherFace talking={talking} size={56} />
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col" style={{ maxHeight: "540px" }}>
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 flex items-center gap-3 rounded-t-2xl">
            <div className="w-9 h-9 rounded-full bg-white border-2 border-blue-300 flex-shrink-0 overflow-hidden flex items-center justify-center">
              <TeacherFace talking={talking} size={36} />
            </div>
            <div>
              <p className="text-white font-bold text-sm">Prof. Byte</p>
              <p className="text-blue-100 text-xs">SAAP Guide</p>
            </div>
            <button onClick={() => setOpen(false)} className="ml-auto text-white/70 hover:text-white text-lg leading-none">✕</button>
          </div>

          <div className="flex border-b border-gray-100">
            {(["tour","faq","chat"] as const).map(tab => (
              <button key={tab} onClick={() => setMode(tab)}
                className={`flex-1 py-2 text-xs font-semibold transition ${mode === tab ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-400 hover:text-gray-600"}`}>
                {tab === "tour" ? "Tour" : tab === "faq" ? "FAQ" : "Chat"}
              </button>
            ))}
          </div>

          {mode === "tour" && (
            <div className="flex flex-col flex-1 p-4 gap-3 overflow-y-auto">
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">{tour.title}</p>
              <div className="flex gap-1">
                {tour.steps.map((_, i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i === tourStep ? "bg-blue-500" : i < tourStep ? "bg-blue-200" : "bg-gray-200"}`} />
                ))}
              </div>
              <div className="flex items-start gap-3 bg-blue-50 rounded-xl p-3">
                <div className="flex-shrink-0"><TeacherFace talking={talking} size={40} /></div>
                <p className="text-sm text-gray-700 leading-relaxed">{tour.steps[tourStep]}</p>
              </div>
              {tour.quickActions && tourStep === tour.steps.length - 1 && (
                <div className="flex flex-wrap gap-2">
                  {tour.quickActions.map(a => (
                    <button key={a.path} onClick={() => { router.push(a.path); setOpen(false); }}
                      className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition">
                      {a.label} →
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-auto">
                <button onClick={() => setTourStep(s => Math.max(0, s - 1))} disabled={tourStep === 0}
                  className="flex-1 py-2 rounded-lg border text-xs font-medium disabled:opacity-30 hover:bg-gray-50 transition">← Back</button>
                {tourStep < tour.steps.length - 1 ? (
                  <button onClick={() => setTourStep(s => s + 1)}
                    className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition">Next →</button>
                ) : (
                  <button onClick={() => { setTourStep(0); setOpen(false); }}
                    className="flex-1 py-2 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600 transition">Done ✓</button>
                )}
              </div>
              <p className="text-center text-xs text-gray-300">Step {tourStep + 1} of {tour.steps.length}</p>
            </div>
          )}

          {mode === "faq" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="p-3 border-b">
                <input value={faqSearch} onChange={e => setFaqSearch(e.target.value)}
                  placeholder="Search questions..." className="w-full border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div className="flex-1 overflow-y-auto">
                {filteredFaqs.map((f, i) => <FAQItem key={i} q={f.q} a={f.a} />)}
                {filteredFaqs.length === 0 && <p className="text-center text-xs text-gray-400 py-8">No results</p>}
              </div>
            </div>
          )}

          {mode === "chat" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {chatHistory.length === 0 && (
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0"><TeacherFace talking={false} size={28} /></div>
                    <div className="bg-blue-50 rounded-xl rounded-tl-none px-3 py-2 text-xs text-gray-700 max-w-[85%]">
                      Hi! I am Prof. Byte. Ask me anything about SAAP!
                      <div className="flex flex-wrap gap-1 mt-2">
                        {["How to upload syllabus?","What is Bloom taxonomy?","How does evaluation work?"].map(s => (
                          <button key={s} onClick={() => { setChatInput(s); }}
                            className="text-[10px] bg-white border border-blue-200 text-blue-600 px-2 py-0.5 rounded-full hover:bg-blue-50 transition">{s}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`flex items-start gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    {msg.role === "bot" && <div className="flex-shrink-0"><TeacherFace talking={false} size={28} /></div>}
                    <div className={`px-3 py-2 rounded-xl text-xs max-w-[85%] leading-relaxed ${msg.role === "bot" ? "bg-blue-50 text-gray-700 rounded-tl-none" : "bg-blue-600 text-white rounded-tr-none"}`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {typing && (
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0"><TeacherFace talking={true} size={28} /></div>
                    <TypingDots />
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="p-3 border-t flex gap-2">
                <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleChatSend()}
                  placeholder="Ask me anything..." className="flex-1 border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <button onClick={handleChatSend} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition">Send</button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
