"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getNotifications, markNotificationRead, markAllRead } from "@/lib/api";
import { Bell, CheckCheck, BookOpen, FileText, CheckSquare, AlertTriangle } from "lucide-react";

const TYPE_ICON: Record<string, any> = {
  syllabus_done: BookOpen,
  eval_done: CheckSquare,
  paper_finalized: FileText,
  review_needed: AlertTriangle,
};
const TYPE_COLOR: Record<string, string> = {
  syllabus_done: "text-blue-500",
  eval_done: "text-green-500",
  paper_finalized: "text-purple-500",
  review_needed: "text-orange-500",
};

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { data, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getNotifications(false),
    refetchInterval: 15000,
  });

  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => { refetch(); qc.invalidateQueries({ queryKey: ["notifications-count"] }); },
  });

  const markAll = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => { refetch(); qc.invalidateQueries({ queryKey: ["notifications-count"] }); },
  });

  const notifications = data?.notifications ?? [];
  const unread = data?.unread_count ?? 0;

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          {unread > 0 && <p className="text-sm text-blue-600">{unread} unread</p>}
        </div>
        {unread > 0 && (
          <button onClick={() => markAll.mutate()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 border rounded-lg px-3 py-1.5">
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      <div className="space-y-2">
        {notifications.map((n: any) => {
          const Icon = TYPE_ICON[n.type] || Bell;
          const color = TYPE_COLOR[n.type] || "text-gray-500";
          return (
            <div
              key={n.id}
              onClick={() => !n.is_read && markRead.mutate(n.id)}
              className={`bg-white rounded-xl border p-4 flex items-start gap-3 cursor-pointer transition ${
                !n.is_read ? "border-blue-200 bg-blue-50/30" : "border-gray-100"
              }`}
            >
              <Icon size={18} className={`flex-shrink-0 mt-0.5 ${color}`} />
              <div className="flex-1">
                <p className={`text-sm font-medium ${!n.is_read ? "text-gray-900" : "text-gray-600"}`}>{n.title}</p>
                {n.message && <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>}
                <p className="text-xs text-gray-300 mt-1">{new Date(n.created_at).toLocaleString()}</p>
              </div>
              {!n.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />}
            </div>
          );
        })}
        {notifications.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Bell size={40} className="mx-auto mb-3 opacity-30" />
            <p>No notifications yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
