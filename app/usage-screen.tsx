"use client";

import { useEffect, useState } from "react";

type Metric = { key: string; label: string; used: number; limit: number; unit: "count" | "bytes" };

function display(metric: Metric, value: number) {
  if (metric.unit === "bytes") return new Intl.NumberFormat("en-GB", { style: "unit", unit: value >= 1_000_000 ? "megabyte" : "kilobyte", maximumFractionDigits: 1 }).format(value / (value >= 1_000_000 ? 1_000_000 : 1_000));
  return new Intl.NumberFormat("en-GB").format(value);
}

export default function UsageScreen() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [planName, setPlanName] = useState("Professional");
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/usage", { cache: "no-store" }).then(async (response) => {
      const payload = (await response.json()) as { metrics?: Metric[]; planName?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Workspace usage is unavailable.");
      setMetrics(payload.metrics ?? []); setPlanName(payload.planName ?? "Professional");
    }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Workspace usage is unavailable."));
  }, []);
  return <div className="standard-page"><div className="page-heading"><div><p className="eyebrow">Plan governance</p><h1>Usage and limits</h1><p className="page-subtitle">The {planName} plan warns at 100% and blocks new objects only at 110%; existing records remain available.</p></div><span className="status">{planName}</span></div>{message && <p className="storage-message">{message}</p>}<div className="usage-grid">{metrics.map((metric) => { const percentage = metric.limit ? metric.used / metric.limit * 100 : 0; const state = percentage >= 110 ? "blocked" : percentage >= 100 ? "warning" : "healthy"; return <section className={`usage-card usage-${state}`} key={metric.key}><div><span>{metric.label}</span><strong>{display(metric, metric.used)} <small>of {display(metric, metric.limit)}</small></strong></div><div className="usage-meter"><span style={{ width: `${Math.min(100, percentage)}%` }} /></div><p>{percentage.toFixed(0)}% used · {state === "blocked" ? "New objects blocked" : state === "warning" ? "Grace band active" : "Within plan allowance"}</p></section>; })}</div><section className="data-panel limit-policy"><div className="panel-toolbar"><div><h2>Limit policy</h2><p>Server-side enforcement never hides, deletes or locks existing tenant data.</p></div></div><div><span><strong>100%</strong> Warning shown; creation remains available.</span><span><strong>110%</strong> New objects of that type are blocked.</span><span><strong>Any tier</strong> Complete owner export remains available.</span></div></section></div>;
}
