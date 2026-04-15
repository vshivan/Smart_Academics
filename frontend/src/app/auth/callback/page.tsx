"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function CallbackHandler() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState("Signing you in...");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const token = params.get("token");
    const userRaw = params.get("user");
    const error = params.get("error");

    if (error) {
      setIsError(true);
      // Try to parse a friendly message from Google's JSON error body
      try {
        const parsed = JSON.parse(decodeURIComponent(error));
        setStatus(`Login failed: ${parsed.error_description || parsed.error}`);
      } catch {
        setStatus(`Login failed: ${decodeURIComponent(error)}`);
      }
      return;
    }

    if (!token) {
      setIsError(true);
      setStatus("No token received from server.");
      return;
    }

    try {
      localStorage.setItem("access_token", token);
      if (userRaw) {
        localStorage.setItem("user", decodeURIComponent(userRaw));
      }
      setStatus("Login successful! Redirecting...");
      router.push("/dashboard");
    } catch {
      setIsError(true);
      setStatus("Failed to save session. Please try again.");
    }
  }, [params, router]);

  return (
    <div className="text-center">
      <div className="text-5xl mb-4">{isError ? "❌" : "⏳"}</div>
      <p className="text-gray-600 text-lg">{status}</p>
      {isError && (
        <a href="/" className="mt-6 inline-block text-blue-600 underline">
          ← Back to home
        </a>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <Suspense fallback={<p className="text-gray-500">Loading...</p>}>
        <CallbackHandler />
      </Suspense>
    </main>
  );
}
