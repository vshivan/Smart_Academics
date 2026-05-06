"use client";
/**
 * Paper Moderation Workflow
 * Faculty generates → HOD reviews → Approve / Request Changes → Faculty revises → Lock
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/Toast";
import RoleGuard from "@/components/RoleGuard";
import {
  CheckCircle, XCircle, MessageSquare, Clock, Lock,
  FileText, ChevronDown, ChevronUp, Eye, Send,
} from "lucide-react";

type ReviewStatus = "pending" | "approved" | "rejected" | "changes_requested";

const STATUS_CONFIG: Record<ReviewStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending:           { label: "Awaiting Review", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  approved:          { label: "Approved",         color: "bg-green-100 text-green-700",  icon: CheckCircle },
  rejected:          { label: "Rejected",         color: "bg-red-100 text-red-700",      icon: XCircle },
  changes_requested: { label: "Changes Needed",   color: "bg-orange-100 text-orange-700",icon: MessageSquare },
};

function StatusBadge({ status }: { status: ReviewStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
      <cfg.icon size={10} />
      {cfg.label}
    </span>
  );
}

// ── Review card (HOD/Admin view) ──────────────────────────────
function ReviewCard({ review, onAction }: { review: any; onAction: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [comment, setComment] = useState("");
  const { success, error } = useToast();
  const qc = useQueryClient();

  const act = useMutation({
    mutationFn: ({ status, comments }: { status: ReviewStatus; comments: string }) =>
      api.patch(`/papers/${review.paper_id}/review`, { status, comments }),
    onSuccess: () => {
      success("Review submitted");
      qc.invalidateQueries({ queryKey: ["reviews"] });
      onAction();
    },
    onError: () => error("Failed to submit review"),
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm text-gray-900 truncate">{review.paper_title}</h3>
            <StatusBadge status={review.status} />
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {review.exam_type} · {review.total_marks} marks · by {review.created_by_name}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setExpanded(e => !e)}
            className="text-gray-400 hover:text-gray-600 transition">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 pt-4 space-y-4">
          {/* Questions preview */}
          {review.questions?.slice(0, 3).map((q: any, i: number) => (
            <div key={q.id} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-gray-400">Q{i+1}</span>
                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{q.blooms_level}</span>
                <span className="text-xs text-gray-400">{q.marks} marks</span>
              </div>
              <p className="text-xs text-gray-700">{q.question_text}</p>
            </div>
          ))}
          {review.questions?.length > 3 && (
            <p className="text-xs text-gray-400 text-center">
              +{review.questions.length - 3} more questions
            </p>
          )}

          {/* Previous comments */}
          {review.comments && (
            <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
              <p className="text-xs font-semibold text-orange-700 mb-1">Previous feedback</p>
              <p className="text-xs text-orange-800">{review.comments}</p>
            </div>
          )}

          {/* HOD/Admin action panel */}
          <RoleGuard roles={["hod", "admin"]}>
            {review.status === "pending" || review.status === "changes_requested" ? (
              <div className="space-y-3">
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Add review comments (required for changes/rejection)…"
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => act.mutate({ status: "approved", comments: comment })}
                    disabled={act.isPending}
                    className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs px-3 py-2 rounded-lg transition"
                  >
                    <CheckCircle size={12} /> Approve
                  </button>
                  <button
                    onClick={() => act.mutate({ status: "changes_requested", comments: comment })}
                    disabled={act.isPending || !comment.trim()}
                    className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs px-3 py-2 rounded-lg transition"
                  >
                    <MessageSquare size={12} /> Request Changes
                  </button>
                  <button
                    onClick={() => act.mutate({ status: "rejected", comments: comment })}
                    disabled={act.isPending || !comment.trim()}
                    className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-xs px-3 py-2 rounded-lg transition"
                  >
                    <XCircle size={12} /> Reject
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">This paper has been {review.status}.</p>
            )}
          </RoleGuard>
        </div>
      )}
    </div>
  );
}

// ── Submit for review (Faculty view) ─────────────────────────
function SubmitForReview() {
  const [paperId, setPaperId] = useState("");
  const { success, error } = useToast();
  const qc = useQueryClient();

  const submit = useMutation({
    mutationFn: () => api.post(`/papers/${paperId}/submit-for-review`),
    onSuccess: () => {
      success("Submitted for review!", "Your HOD will be notified.");
      setPaperId("");
      qc.invalidateQueries({ queryKey: ["reviews"] });
    },
    onError: () => error("Submission failed", "Check the Paper ID and try again."),
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
      <h2 className="font-semibold text-sm text-gray-900 mb-3">Submit Paper for Review</h2>
      <div className="flex gap-2">
        <input
          value={paperId}
          onChange={e => setPaperId(e.target.value)}
          placeholder="Enter Paper ID to submit for HOD review"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <button
          onClick={() => submit.mutate()}
          disabled={!paperId || submit.isPending}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Send size={14} /> {submit.isPending ? "Submitting…" : "Submit"}
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function ModerationPage() {
  const auth = useAuth();
  const [filter, setFilter] = useState<"all" | ReviewStatus>("all");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["reviews", filter],
    queryFn: () => api.get("/papers/reviews", { params: filter !== "all" ? { status: filter } : {} })
      .then(r => r.data)
      .catch(() => ({ data: { reviews: [] } })),
    enabled: auth.isAuthenticated,
  });

  const reviews = data?.data?.reviews ?? data?.reviews ?? [];

  const counts = {
    all:               reviews.length,
    pending:           reviews.filter((r: any) => r.status === "pending").length,
    approved:          reviews.filter((r: any) => r.status === "approved").length,
    changes_requested: reviews.filter((r: any) => r.status === "changes_requested").length,
    rejected:          reviews.filter((r: any) => r.status === "rejected").length,
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Paper Moderation</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Review and approve question papers before distribution.
        </p>
      </div>

      {/* Faculty: submit for review */}
      <RoleGuard roles={["faculty"]}>
        <SubmitForReview />
      </RoleGuard>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {(["all", "pending", "approved", "changes_requested", "rejected"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
              filter === f
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}>
            {f === "all" ? "All" : STATUS_CONFIG[f]?.label ?? f}
            {counts[f] > 0 && (
              <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                filter === f ? "bg-white/20" : "bg-gray-100"
              }`}>
                {counts[f]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Reviews list */}
      {isLoading && (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse h-20" />
          ))}
        </div>
      )}

      {!isLoading && reviews.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No papers to review.</p>
          <p className="text-xs mt-1">Faculty can submit papers for review using the form above.</p>
        </div>
      )}

      <div className="space-y-3">
        {reviews.map((review: any) => (
          <ReviewCard key={review.id} review={review} onAction={refetch} />
        ))}
      </div>
    </div>
  );
}
