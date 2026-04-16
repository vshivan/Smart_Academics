"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { calibrateDifficulty } from "@/lib/api";
import { Sliders } from "lucide-react";

export default function CalibrationPage() {
  const [sessionId, setSessionId] = useState("");

  const calibrate = useMutation({ mutationFn: () => calibrateDifficulty(sessionId) });

  return (
    <div className="max-w-xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-2">Difficulty Calibration</h1>
      <p className="text-gray-500 text-sm mb-6">
        After evaluation, recalibrate question difficulty based on actual student performance.
      </p>

      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Evaluation Session ID</label>
          <input value={sessionId} onChange={e => setSessionId(e.target.value)}
            placeholder="Paste session ID" className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <button onClick={() => calibrate.mutate()} disabled={!sessionId || calibrate.isPending}
          className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50">
          <Sliders size={14} />
          {calibrate.isPending ? "Calibrating..." : "Run Calibration"}
        </button>
      </div>

      {calibrate.data && (
        <div className="mt-6 bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold mb-3">Calibration Result</h2>
          <div className="flex items-center gap-4">
            <div className={`text-4xl font-bold px-6 py-4 rounded-xl ${
              calibrate.data.calibrated_difficulty === "easy" ? "bg-green-100 text-green-700" :
              calibrate.data.calibrated_difficulty === "medium" ? "bg-yellow-100 text-yellow-700" :
              "bg-red-100 text-red-700"
            }`}>
              {calibrate.data.calibrated_difficulty?.toUpperCase()}
            </div>
            <div>
              <p className="text-sm text-gray-600">Average student score</p>
              <p className="text-2xl font-bold text-gray-800">{calibrate.data.avg_score_pct}%</p>
              <p className="text-xs text-gray-400 mt-1">
                {calibrate.data.calibrated_difficulty === "easy" && "≥75% avg → Easy"}
                {calibrate.data.calibrated_difficulty === "medium" && "45–75% avg → Medium"}
                {calibrate.data.calibrated_difficulty === "hard" && "<45% avg → Hard"}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 bg-gray-50 rounded-xl p-4 text-xs text-gray-500">
        <p className="font-semibold mb-1">How it works</p>
        <p>Calibration computes the average score across all submissions in the session. If students score ≥75% on average, questions are marked Easy. 45–75% = Medium. Below 45% = Hard. Results are stored in the question performance table.</p>
      </div>
    </div>
  );
}
