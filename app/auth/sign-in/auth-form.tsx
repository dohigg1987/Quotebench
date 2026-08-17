"use client";

import { FormEvent, useState } from "react";
import { getAuthClient } from "../../../lib/auth/client";

export default function AuthForm({ returnTo }: { returnTo: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");

    try {
      const authClient = await getAuthClient();
      const result = await authClient.signIn.email({ email, password });
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
      <form className="auth-form" onSubmit={submit}>
        <label>Email address<input name="email" type="email" autoComplete="email" inputMode="email" required /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" minLength={8} required /></label>
        {message ? <p className="auth-error" role="alert">{message}</p> : null}
        <button className="button primary" type="submit" disabled={busy}>{busy ? "Please wait…" : "Sign in securely"}</button>
      </form>
      <p className="auth-access-note">New accounts are currently provisioned directly by QuoteBench.</p>
    </>
  );
}
