"use client";

import { useState } from "react";
import { formatMoney, localeForCurrency } from "../../../lib/market";

type ProposalStatus = "Issued" | "Viewed" | "Accepted" | "Declined" | "Expired" | "Superseded";

export default function AcceptanceForm({ token, status, acceptedBy, declineReason, supersededBy, options = [], depositMinor = 0, currency = "GBP", recipientSignedAt = null, recipientRole = "signatory", signingOrder = 1 }: { token: string; status: ProposalStatus; acceptedBy: string | null; declineReason: string | null; supersededBy: string | null; options?: Array<{ id: string; label: string }>; depositMinor?: number; currency?: string; recipientSignedAt?: string | null; recipientRole?: string; signingOrder?: number }) {
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(status === "Accepted");
  const [declined, setDeclined] = useState(status === "Declined");
  const [signaturePending, setSignaturePending] = useState(Boolean(recipientSignedAt) && status !== "Accepted");
  const [reason, setReason] = useState(declineReason ?? "Budget");
  const [selectedOptionId, setSelectedOptionId] = useState(options.length === 1 ? options[0].id : "");
  const [message, setMessage] = useState(status === "Accepted" ? `Accepted by ${acceptedBy ?? "recipient"}` : status === "Declined" ? `Declined${declineReason ? `: ${declineReason}` : ""}` : "");

  async function submit() {
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch(`/api/public/quotes/${token}/accept`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ acceptedBy: name, consent, selectedOptionId: selectedOptionId || undefined }),
      });
      const payload = (await response.json()) as { error?: string; signingComplete?: boolean; pendingSignatures?: number };
      if (!response.ok) throw new Error(payload.error ?? "Acceptance could not be recorded.");
      if (payload.signingComplete) { setAccepted(true); setMessage(`Acceptance completed for ${name}`); }
      else { setSignaturePending(true); setMessage(`Signature recorded for ${name}. ${payload.pendingSignatures ?? 1} required signature${payload.pendingSignatures === 1 ? "" : "s"} remain.`); }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Acceptance could not be recorded.");
    } finally {
      setSubmitting(false);
    }
  }

  async function decline() {
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch(`/api/public/quotes/${token}/decline`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "The proposal could not be declined.");
      setDeclined(true);
      setMessage(`Declined: ${reason}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The proposal could not be declined.");
    } finally {
      setSubmitting(false);
    }
  }

  if (accepted) {
    return <div className="acceptance-confirmed"><span>âœ“</span><div><strong>Proposal accepted</strong><p>{message}. A timestamped evidence record has been retained.</p><a className="button" href={`/api/public/quotes/${token}/certificate`}>Download acceptance certificate</a></div></div>;
  }

  if (signaturePending) return <div className="acceptance-confirmed"><span>âœ“</span><div><strong>Signature recorded</strong><p>{message || `Your ${recipientRole} signature at order ${signingOrder} is complete. The proposal remains open for the remaining required signatories.`}</p></div></div>;


  if (declined) {
    return <div className="acceptance-confirmed declined-confirmed"><span>Ã—</span><div><strong>Proposal declined</strong><p>{message}. The sender can reopen this as a new version.</p></div></div>;
  }

  if (status === "Expired") {
    return <div className="acceptance-confirmed decision-unavailable"><span>i</span><div><strong>Proposal expired</strong><p>Acceptance is closed. Contact the sender to request a refreshed version.</p></div></div>;
  }

  if (status === "Superseded") {
    return <div className="acceptance-confirmed decision-unavailable"><span>i</span><div><strong>Newer version available</strong><p>This proposal has been superseded by {supersededBy ?? "a revised quotation"}. Contact the sender for the current secure link.</p></div></div>;
  }

  return (
    <div className="acceptance-form">
      {options.length > 0 && <fieldset className="acceptance-options"><legend>Select one option</legend>{options.map((option) => <label key={option.id}><input type="radio" name="proposal-option" checked={selectedOptionId === option.id} onChange={() => setSelectedOptionId(option.id)} /><span>{option.label}</span></label>)}</fieldset>}
      {depositMinor > 0 && <div className="deposit-note"><span>Deposit stated in proposal</span><strong>{formatMoney(depositMinor,currency,localeForCurrency(currency))}</strong><small>No payment is collected on this page.</small></div>}
      <label><span>Full name</span><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label>
      <label className="consent-row"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I accept this proposal and confirm that I am authorised to proceed.</span></label>
      {message && <p className="acceptance-error" role="alert">{message}</p>}
      <button onClick={submit} disabled={submitting || !consent || name.trim().length < 2 || (options.length > 0 && !selectedOptionId)}>{submitting ? "Recordingâ€¦" : recipientRole === "countersignatory" ? "Countersign proposal" : "Sign and accept"}</button>
      <div className="decline-control"><label><span>Decline reason</span><select value={reason} onChange={(event) => setReason(event.target.value)}><option>Budget</option><option>Timing</option><option>Scope</option><option>Alternative provider</option><option>No longer required</option></select></label><button className="decline-button" onClick={decline} disabled={submitting}>Decline proposal</button></div>
    </div>
  );
}

