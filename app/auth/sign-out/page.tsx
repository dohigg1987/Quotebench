"use client";

import { useEffect, useState } from "react";
import { getAuthClient } from "../../../lib/auth/client";

export default function SignOutPage() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const returnTo = new URLSearchParams(window.location.search).get("return_to") || "/";
    const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
    const authClient = getAuthClient();
    void authClient.signOut().then(({ error }) => {
      if (error) setFailed(true);
      else window.location.replace(safeReturnTo);
    }).catch(() => setFailed(true));
  }, []);

  return <main className="signin-shell"><section className="signin-panel"><p className="eyebrow">QuoteBench security</p><h1>{failed ? "Sign out needs attention" : "Signing you out…"}</h1><p>{failed ? "We could not complete sign out. Close this browser tab or try again." : "Your authenticated session is being closed securely."}</p>{failed ? <button className="button primary" type="button" onClick={() => window.location.reload()}>Try again</button> : null}</section></main>;
}
