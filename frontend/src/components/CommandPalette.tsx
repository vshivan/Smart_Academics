"use client";
/**
 * Command Palette — Ctrl+K / Cmd+K global keyboard shortcut.
 * Fuzzy search across all pages and actions.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Upload, CheckSquare, BarChart2, Building2, Users, Database, Layout, History, Download, AlertTriangle, Sliders, Bell, Brain, Shield, CalendarCheck, Award, Target, GitMerge, ClipboardCheck, Eye, X } from "lucide-react";

const COMMANDS = [
  { label: "Upload Syllabus",       href: "/dashboard/syllabus",      icon: Upload,         group: "Core" },
  { label: "Generate Paper",        href: "/dashboard/papers",        icon: FileText,       group: "Core" },
  { label: "Preview Paper",         href: "/dashboard/preview",       icon: Eye,            group: "Core" },
  { label: "Start Evaluation",      href: "/dashboard/evaluation",    icon: CheckSquare,    group: "Core" },
  { label: "Analytics Dashboard",   href: "/dashboard/analytics",     icon: BarChart2,      group: "Core" },
  { label: "College Setup",         href: "/dashboard/setup",         icon: Building2,      group: "Management" },
  { label: "Departments",           href: "/dashboard/departments",   icon: Users,          group: "Management" },
  { label: "CO-PO Mapping",         href: "/dashboard/co-po",         icon: Target,         group: "Accreditation" },
  { label: "OBE Attainment",        href: "/dashboard/obe",           icon: GitMerge,       group: "Accreditation" },
  { label: "Paper Moderation",      href: "/dashboard/moderation",    icon: ClipboardCheck, group: "Accreditation" },
  { label: "Accreditation Reports", href: "/dashboard/accreditation", icon: Shield,         group: "Accreditation" },
  { label: "Bloom's Report",        href: "/dashboard/bloom-report",  icon: Brain,          group: "Accreditation" },
  { label: "Question Bank",         href: "/dashboard/question-bank", icon: Database,       group: "Features" },
  { label: "Rubric Builder",        href: "/dashboard/rubrics",       icon: Layout,         group: "Features" },
  { label: "Syllabus Versions",     href: "/dashboard/versions",      icon: History,        group: "Features" },
  { label: "Export Papers",         href: "/dashboard/export",        icon: Download,       group: "Features" },
  { label: "Plagiarism Check",      href: "/dashboard/plagiarism",    icon: AlertTriangle,  group: "Features" },
  { label: "Difficulty Calibration",href: "/dashboard/calibration",   icon: Sliders,        group: "Features" },
  { label: "Paper Templates",       href: "/dashboard/templates",     icon: FileText,       group: "Features" },
  { label: "Bulk Import Students",  href: "/dashboard/bulk-import",   icon: Users,          group: "Features" },
  { label: "Attendance",            href: "/dashboard/attendance",    icon: CalendarCheck,  group: "Features" },
  { label: "Certificates",          href: "/dashboard/certificates",  icon: Award,          group: "Features" },
  { label: "Comparative Analytics", href: "/dashboard/comparative",   icon: BarChart2,      group: "Features" },
  { label: "Notifications",         href: "/dashboard/notifications", icon: Bell,           group: "Other" },
  { label: "Answer Sheet Scanner",  href: "/dashboard/scanner",       icon: FileText,       group: "Features" },
  { label: "Exam Schedule",         href: "/dashboard/schedule",      icon: CalendarCheck,  group: "Management" },
  { label: "Audit Logs",            href: "/dashboard/audit",         icon: Shield,         group: "Admin" },
  { label: "Super Admin",           href: "/dashboard/admin",         icon: Users,          group: "Admin" },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? COMMANDS.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.group.toLowerCase().includes(query.toLowerCase())
      )
    : COMMANDS.slice(0, 8);

  const navigate = useCallback((href: string) => {
    router.push(href);
    setOpen(false);
    setQuery("");
    setSelected(0);
  }, [router]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen(o => !o);
        setQuery("");
        setSelected(0);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => { setSelected(0); }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && filtered[selected]) navigate(filtered[selected].href);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Palette */}
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages and actions…"
            className="flex-1 text-sm text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent"
          />
          <div className="flex items-center gap-1">
            <kbd className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">ESC</kbd>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No results for "{query}"</p>
          )}
          {filtered.map((cmd, i) => (
            <button
              key={cmd.href}
              onClick={() => navigate(cmd.href)}
              onMouseEnter={() => setSelected(i)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition ${
                selected === i ? "bg-blue-50" : "hover:bg-gray-50"
              }`}
            >
              <div className={`p-1.5 rounded-lg flex-shrink-0 ${selected === i ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"}`}>
                <cmd.icon size={13} />
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium ${selected === i ? "text-blue-700" : "text-gray-800"}`}>
                  {cmd.label}
                </span>
              </div>
              <span className="text-[10px] text-gray-400 flex-shrink-0">{cmd.group}</span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-4 text-[10px] text-gray-400">
          <span><kbd className="font-mono bg-gray-100 px-1 rounded">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono bg-gray-100 px-1 rounded">↵</kbd> open</span>
          <span><kbd className="font-mono bg-gray-100 px-1 rounded">Ctrl+K</kbd> toggle</span>
        </div>
      </div>
    </div>
  );
}
