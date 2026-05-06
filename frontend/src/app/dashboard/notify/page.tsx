"use client";
/**
 * Notification Management — Email, SMS, WhatsApp alerts.
 * Send bulk notifications to faculty, students, and parents.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/Toast";
import { Send, Mail, MessageSquare, Users, RefreshCw, CheckCircle } from "lucide-react";

type Channel = "email" | "sms" | "whatsapp";
type Audience = "all" | "faculty" | "hod" | "admin";

const CHANNELS: { id: Channel; label: string; icon: React.ElementType; desc: string; available: boolean }[] = [
  { id: "email",     label: "Email",     icon: Mail,          desc: "Send via SMTP (Gmail/SendGrid)", available: true },
  { id: "sms",       label: "SMS",       icon: MessageSquare, desc: "Send via Twilio",                available: true },
  { id: "whatsapp",  label: "WhatsApp",  icon: MessageSquare, desc: "WhatsApp Business API",          available: false },
];

const TEMPLATES = [
  { id: "syllabus_done",    label: "Syllabus Processed",   body: "Your syllabus has been processed and the knowledge graph is ready. You can now generate question papers." },
  { id: "evaluation_done",  label: "Evaluation Complete",  body: "Evaluation is complete. Please review the results and override any flagged submissions." },
  { id: "paper_finalized",  label: "Paper Finalized",      body: "Your question paper has been finalized and is ready for distribution." },
  { id: "reminder",         label: "Submission Reminder",  body: "This is a reminder that assignment submissions are due soon. Please ensure all students have submitted." },
  { id: "custom",           label: "Custom Message",       body: "" },
];

export default function NotifyPage() {
  const auth = useAuth();
  const { success, error } = useToast();
  const [channel, setChannel] = useState<Channel>("email");
  const [audience, setAudience] = useState<Audience>("faculty");
  const [templateId, setTemplateId] = useState("custom");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [sent, setSent] = useState(false);

  const selectedTemplate = TEMPLATES.find(t => t.id === templateId);

  const sendBulk = useMutation({
    mutationFn: () => api.post("/notify/bulk-email", {
      college_id: auth.collegeId,
      role_filter: audience === "all" ? null : audience,
      subject,
      body_html: `<p>${body.replace(/\n/g, "<br/>")}</p>`,
      notification_type: templateId,
    }),
    onSuccess: () => { success("Notifications sent!", "Messages queued for delivery."); setSent(true); },
    onError: () => error("Failed to send", "Check your SMTP configuration in .env"),
  });

  const notifyParents = useMutation({
    mutationFn: () => api.post(`/notify/parents/${sessionId}`),
    onSuccess: (data: any) => {
      const count = data?.data?.parents_notified ?? data?.parents_notified ?? 0;
      success(`${count} parents notified!`, "SMS messages queued.");
    },
    onError: () => error("Failed to notify parents", "Check Twilio configuration."),
  });

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Notification Center</h1>
        <p className="text-gray-500 text-sm mt-0.5">Send bulk notifications to faculty, students, and parents.</p>
      </div>

      {/* Channel selector */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {CHANNELS.map(ch => (
          <button key={ch.id} onClick={() => !ch.available ? null : setChannel(ch.id)}
            className={`p-3 rounded-xl border-2 text-left transition relative ${
              !ch.available ? "opacity-50 cursor-not-allowed border-gray-100" :
              channel === ch.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
            }`}>
            <div className="flex items-center gap-2 mb-1">
              <ch.icon size={14} className={channel === ch.id ? "text-blue-600" : "text-gray-500"} />
              <span className={`text-xs font-semibold ${channel === ch.id ? "text-blue-700" : "text-gray-700"}`}>{ch.label}</span>
            </div>
            <p className="text-[10px] text-gray-400">{ch.desc}</p>
            {!ch.available && (
              <span className="absolute top-1.5 right-1.5 text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Soon</span>
            )}
          </button>
        ))}
      </div>

      {/* Bulk email/SMS form */}
      {(channel === "email" || channel === "sms") && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5 space-y-4">
          <h2 className="font-semibold text-sm text-gray-900">Compose Message</h2>

          {/* Audience */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Send to</label>
            <div className="flex gap-2 flex-wrap">
              {(["all", "faculty", "hod", "admin"] as Audience[]).map(a => (
                <button key={a} onClick={() => setAudience(a)}
                  className={`text-xs px-3 py-1.5 rounded-lg capitalize font-medium transition ${
                    audience === a ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>
                  {a === "all" ? "All Users" : a}
                </button>
              ))}
            </div>
          </div>

          {/* Template */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Template</label>
            <select value={templateId} onChange={e => {
              setTemplateId(e.target.value);
              const tmpl = TEMPLATES.find(t => t.id === e.target.value);
              if (tmpl && tmpl.id !== "custom") {
                setSubject(tmpl.label);
                setBody(tmpl.body);
              }
            }} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="Email subject line"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
            <textarea value={body} onChange={e => setBody(e.target.value)}
              rows={4} placeholder="Write your message here…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <p className="text-[10px] text-gray-400 mt-1">Use {"{{name}}"} to personalize with recipient's name.</p>
          </div>

          {sent ? (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 rounded-lg p-3">
              <CheckCircle size={16} />
              <span className="text-sm font-medium">Messages sent successfully!</span>
              <button onClick={() => setSent(false)} className="ml-auto text-xs text-green-700 underline">Send another</button>
            </div>
          ) : (
            <button onClick={() => sendBulk.mutate()} disabled={!subject || !body || sendBulk.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition">
              {sendBulk.isPending ? <><RefreshCw size={14} className="animate-spin" /> Sending…</> : <><Send size={14} /> Send to {audience === "all" ? "All Users" : audience}</>}
            </button>
          )}
        </div>
      )}

      {/* Parent SMS alerts */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-sm text-gray-900 mb-1">Parent SMS Alerts</h2>
        <p className="text-xs text-gray-400 mb-4">
          Automatically notify parents when evaluation results are published. Requires Twilio configuration.
        </p>
        <div className="flex gap-2">
          <input value={sessionId} onChange={e => setSessionId(e.target.value)}
            placeholder="Evaluation Session ID"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          <button onClick={() => notifyParents.mutate()} disabled={!sessionId || notifyParents.isPending}
            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
            {notifyParents.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
            Notify Parents
          </button>
        </div>
        <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700">
          <strong>WhatsApp:</strong> Coming soon via WhatsApp Business API. Currently SMS via Twilio is supported.
          Set <code className="bg-yellow-100 px-1 rounded">TWILIO_ACCOUNT_SID</code>, <code className="bg-yellow-100 px-1 rounded">TWILIO_AUTH_TOKEN</code>, and <code className="bg-yellow-100 px-1 rounded">TWILIO_FROM_NUMBER</code> in your .env file.
        </div>
      </div>
    </div>
  );
}
