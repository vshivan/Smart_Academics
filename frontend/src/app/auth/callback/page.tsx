"use client";
/**
 * OAuth callback page.
 *
 * The API gateway redirects here with the token in the URL FRAGMENT (hash):
 *   /auth/callback#token=<jwt>&user=<url-encoded-json>
 *
 * Why hash? Fragments are never sent to the server, so the JWT is not
 * logged in server access logs. window.location.hash reads it client-side.
 *
 * Error case still uses query string:
 *   /auth/callback?error=<message>
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveSession, type User } from "@/lib/auth";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus]   = useState("Signing you in…");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    // Check query string for errors first
    const queryParams = new URLSearchParams(window.location.search);
    const error = queryParams.get("error");

    if (error) {
      setIsError(true);
      try {
        const parsed = JSON.parse(decodeURIComponent(error));
        setStatus(`Login failed: ${parsed.error_description || parsed.error}`);
      } catch {
        setStatus(`Login failed: ${decodeURIComponent(error)}`);
      }
      return;
    }

    // Token is in the URL hash fragment: #token=...&user=...
    const hash = window.location.hash.slice(1); // remove leading #
    const hashParams = new URLSearchParams(hash);
    const token   = hashParams.get("token");
    const userRaw = hashParams.get("user");

    if (!token) {
      setIsError(true);
      setStatus("No token received from server.");
      return;
    }

    try {
      let user: User | null = null;
      if (userRaw) {
        user = JSON.parse(decodeURIComponent(userRaw)) as User;
      }

      saveSession(token, user ?? { email: "", name: "", role: "faculty" });
      setStatus("Login successful! Redirecting…");
      router.push("/dashboard");
    } catch {
      setIsError(true);
      setStatus("Failed to save session. Please try again.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-sm w-full text-center">
        <div className="flex items-center justify-center mb-6">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-lg">S</span>
          </div>
        </div>
        <div className="text-5xl mb-4">{isError ? "❌" : "⏳"}</div>
        <p className="text-gray-600 text-lg">{status}</p>
        {isError && (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-gray-400">
              Common causes: Google OAuth credentials not configured, or redirect URI mismatch.
            </p>
            <a href="/" className="inline-block text-blue-600 underline text-sm">
              ← Back to home
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
