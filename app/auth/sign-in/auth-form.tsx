"use client";

import { FormEvent, useState } from "react";
import { authClient } from "../../../lib/auth/client";

export default function AuthForm({ returnTo }: { returnTo: string }) {
  const [mode, setMode] = useState<"sign-in" | "register">("sign-in");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();

    try {
      const result = mode === "register"
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password });
      if (result.error) throw new Error(result.error.message || "Authentication failed.");
      window.location.assign(returnTo);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="auth-tabs" role="tablist" aria-label="Authentication method">
        <button className={mode === "sign-in" ? "active" : ""} type="button" onClick={() => { setMode("sign-in"); setMessage(null); }}>Sign in</button>
        <button className={mode === "register" ? "active" : ""} type="button" onClick={() => { setMode("register"); setMessage(null); }}>Create account</button>
      </div>
      <form className="auth-form" onSubmit={submit}>
        {mode === "register" ? <label>Full name<input name="name" autoComplete="name" maxLength={120} required /></label> : null}
        <label>Email address<input name="email" type="email" autoComplete="email" inputMode="email" required /></label>
        <label>Password<input name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={8} required /></label>
        {message ? <p className="auth-error" role="alert">{message}</p> : null}
        <button className="button primary" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "register" ? "Create secure account" : "Sign in securely"}</button>
      </form>
    </>
  );
}
