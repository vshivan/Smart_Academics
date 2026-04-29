"use client";
import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { sendChatMessage } from "@/lib/api";
import { Bot, Send, RefreshCw, BookOpen } from "lucide-react";

interface Message { role: "user" | "bot"; text: string; }

const QUICK_QUESTIONS = [
  "How do I upload a syllabus?",
  "How does question generation work?",
  "What is Bloom's taxonomy?",
  "How does evaluation work?",
  "How do I export a paper as PDF?",
  "What is plagiarism detection?",
  "How do I set up a college?",
  "What is difficulty calibration?",
];

export default function ChatbotPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "bot", text: "Hi! I'm the SAAP Assistant. Ask me anything about the platform — syllabus upload, paper generation, evaluation, analytics, or any feature." }
  ]);
  const [input, setInput] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [convId, setConvId] = useState<string | undefined>();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = useMutation({
    mutationFn: (msg: string) => sendChatMessage(msg, subjectId || undefined, convId),
    onSuccess: (data, msg) => {
      setConvId(data.conversation_id);
      setMessages(prev => [...prev, { role: "bot", text: data.response }]);
    },
  });

  const handleSend = (msg?: string) => {
    const text = (msg || input).trim();
    if (!text) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", text }]);
    send.mutate(text);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col h-[calc(100vh-120px)]">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Bot size={20} className="text-blue-600" /> SAAP Assistant
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">Ask anything about the platform. Optionally link a subject for topic-specific answers.</p>
      </div>

      {/* Subject context */}
      <div className="flex gap-2 mb-4">
        <div className="flex items-center gap-2 flex-1 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
          <BookOpen size={13} className="text-gray-400" />
          <input value={subjectId} onChange={e => setSubjectId(e.target.value)}
            placeholder="Subject ID (optional — for topic-specific answers)"
            className="flex-1 bg-transparent text-sm focus:outline-none text-gray-600" />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-gray-200 p-4 space-y-3 mb-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex items-start gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            {m.role === "bot" && (
              <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <Bot size={13} className="text-white" />
              </div>
            )}
            <div className={`px-3 py-2 rounded-xl text-sm max-w-[85%] leading-relaxed ${
              m.role === "bot" ? "bg-blue-50 text-gray-700 rounded-tl-none" : "bg-blue-600 text-white rounded-tr-none"
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {send.isPending && (
          <div className="flex items-start gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <Bot size={13} className="text-white" />
            </div>
            <div className="bg-blue-50 rounded-xl rounded-tl-none px-3 py-2 flex gap-1">
              {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Quick questions */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {QUICK_QUESTIONS.map(q => (
          <button key={q} onClick={() => handleSend(q)}
            className="text-xs bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-600 px-2.5 py-1 rounded-full transition">
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Ask me anything about SAAP..."
          className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        <button onClick={() => handleSend()} disabled={!input.trim() || send.isPending}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl transition">
          {send.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
