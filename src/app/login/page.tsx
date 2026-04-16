"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      router.push("/");
    }
  }, [user, loading, router]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setSuccess("");

      if (!email.trim() || !password.trim()) {
        setError("Email and password are required.");
        return;
      }

      if (mode === "signup") {
        if (password.length < 6) {
          setError("Password must be at least 6 characters.");
          return;
        }
        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          return;
        }
      }

      setSubmitting(true);

      if (mode === "login") {
        const { error } = await signIn(email, password);
        if (error) {
          setError(error);
          setSubmitting(false);
        }
        // On success, the auth listener redirects via the useEffect above
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          setError(error);
          setSubmitting(false);
        } else {
          setSuccess("Account created! Check your email to confirm, then log in.");
          setMode("login");
          setPassword("");
          setConfirmPassword("");
          setSubmitting(false);
        }
      }
    },
    [email, password, confirmPassword, mode, signIn, signUp]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-deep)" }}>
        <div className="w-5 h-5 rounded-full animate-spin" style={{ border: "2px solid var(--border)", borderTopColor: "var(--accent)" }} />
      </div>
    );
  }

  if (user) return null; // Will redirect

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg-deep)" }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "var(--accent-soft)" }}
          >
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7" style={{ stroke: "var(--accent)" }}>
              <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>MrWriter</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {mode === "login" ? "Welcome back" : "Create your account"}
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-6"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          {/* Mode tabs */}
          <div
            className="flex gap-1 p-1 rounded-xl mb-6"
            style={{ background: "var(--bg)" }}
          >
            <button
              onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
              className="flex-1 py-2 text-sm font-medium rounded-lg transition-all"
              style={
                mode === "login"
                  ? { background: "var(--accent)", color: "white" }
                  : { color: "var(--text-muted)" }
              }
            >
              Log In
            </button>
            <button
              onClick={() => { setMode("signup"); setError(""); setSuccess(""); }}
              className="flex-1 py-2 text-sm font-medium rounded-lg transition-all"
              style={
                mode === "signup"
                  ? { background: "var(--accent)", color: "white" }
                  : { color: "var(--text-muted)" }
              }
            >
              Sign Up
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "var(--border)"}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "var(--border)"}
              />
            </div>

            {mode === "signup" && (
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "var(--border)"}
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <div
                className="px-3.5 py-2.5 rounded-xl text-sm"
                style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", color: "var(--red)" }}
              >
                {error}
              </div>
            )}

            {/* Success */}
            {success && (
              <div
                className="px-3.5 py-2.5 rounded-xl text-sm"
                style={{ background: "var(--green-soft)", border: "1px solid rgba(74,222,128,0.2)", color: "var(--green)" }}
              >
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-1"
              style={{ background: "var(--accent)" }}
            >
              {submitting
                ? mode === "login" ? "Logging in..." : "Creating account..."
                : mode === "login" ? "Log In" : "Create Account"
              }
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "var(--text-muted)" }}>
          Screenwriting software for turning conversations into scripts.
        </p>
      </div>
    </div>
  );
}
