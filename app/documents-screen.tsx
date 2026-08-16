"use client";
/* Tenant logos are edge objects with runtime dimensions. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import type { BrandProfile } from "../db/document-store";

export default function DocumentsScreen() {
  const [brands, setBrands] = useState<BrandProfile[]>([]);
  const [activeBrand, setActiveBrand] = useState<BrandProfile | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    fetch("/api/documents", { cache: "no-store" }).then(async (response) => {
      const payload = await response.json() as { brands?: BrandProfile[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Brand settings are unavailable.");
      setBrands(payload.brands ?? []);
      setActiveBrand((current) => current ?? payload.brands?.[0] ?? null);
    }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Brand settings are unavailable."));
  }

  useEffect(load, []);

  async function saveBrand() {
    if (!activeBrand) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/documents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "save_brand", brand: activeBrand }) });
      const payload = await response.json() as { brands?: BrandProfile[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Brand settings could not be saved.");
      setBrands(payload.brands ?? []);
      setActiveBrand(payload.brands?.find((brand) => brand.id === activeBrand.id) ?? activeBrand);
      setMessage("Brand profile saved for future proposals.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Brand settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file?: File) {
    if (!file || !activeBrand) return;
    const form = new FormData();
    form.set("file", file);
    form.set("kind", "logo");
    const response = await fetch("/api/uploads", { method: "POST", body: form });
    const payload = await response.json() as { file?: { id: string }; error?: string };
    if (!response.ok || !payload.file) { setMessage(payload.error ?? "Logo upload failed."); return; }
    setActiveBrand({ ...activeBrand, logoFileId: payload.file.id });
  }

  const contrast = activeBrand ? parseInt(activeBrand.primaryColor.slice(1), 16) : 0;
  const lightText = (((contrast >> 16) * 299 + ((contrast >> 8) & 255) * 587 + (contrast & 255) * 114) / 1000) < 145;

  return <div className="standard-page">
    <div className="page-heading"><div><p className="eyebrow">Proposal identity</p><h1>Brand and delivery</h1><p className="page-subtitle">Control the visual identity and sending details applied to proposal templates and quote-specific documents.</p></div>{activeBrand && <button className="button primary" onClick={() => void saveBrand()} disabled={saving}>{saving ? "Saving…" : "Save brand"}</button>}</div>
    {message && <div className="notice" role="status"><span>i</span>{message}<button onClick={() => setMessage(null)}>×</button></div>}
    <section className="data-panel brand-studio-panel">
      <div className="panel-toolbar"><div><h2>Brand profile</h2><p>Palette, typography, logo and sending identity apply to new proposal snapshots.</p></div><div className="toolbar-actions"><select aria-label="Selected brand profile" value={activeBrand?.id ?? ""} onChange={(event) => setActiveBrand(brands.find((brand) => brand.id === event.target.value) ?? null)}>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></div></div>
      {activeBrand && <div className="brand-studio-grid"><div className="brand-editor-fields"><label><span>Profile name</span><input value={activeBrand.name} onChange={(event) => setActiveBrand({ ...activeBrand, name: event.target.value })}/></label><label><span>Primary colour</span><input type="color" value={activeBrand.primaryColor} onChange={(event) => setActiveBrand({ ...activeBrand, primaryColor: event.target.value })}/></label><label><span>Typeface</span><select value={activeBrand.typeface} onChange={(event) => setActiveBrand({ ...activeBrand, typeface: event.target.value })}><option>Inter</option><option>Source Sans 3</option><option>Merriweather</option><option>IBM Plex Sans</option></select></label><label><span>Sending name</span><input value={activeBrand.sendingName} onChange={(event) => setActiveBrand({ ...activeBrand, sendingName: event.target.value })}/></label><label><span>Reply-to</span><input type="email" value={activeBrand.replyTo} onChange={(event) => setActiveBrand({ ...activeBrand, replyTo: event.target.value })}/></label><label><span>Sending domain</span><input value={activeBrand.sendingDomain ?? ""} onChange={(event) => setActiveBrand({ ...activeBrand, sendingDomain: event.target.value })}/></label><label className="logo-field"><span>Logo, PNG, JPEG or WebP</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadLogo(event.target.files?.[0])}/></label></div><div><div className="brand-live-preview" style={{ fontFamily: activeBrand.typeface, background: activeBrand.primaryColor, color: lightText ? "#fff" : "#102b31" }}>{activeBrand.logoFileId ? <img src={`/api/files/${activeBrand.logoFileId}`} alt={`${activeBrand.name} logo`}/> : <strong>{activeBrand.name}</strong>}<h3>A clear commercial proposal</h3><p>Every template, page and block inherits this identity.</p></div><div className="domain-card"><strong>{activeBrand.domainVerified ? "Sending domain verified" : "Sending domain not verified"}</strong><p>{activeBrand.domainVerified ? "Recipient messages may use this domain." : "Until verification, delivery uses the platform domain with your sending name."}</p><code>TXT qb-verify.{activeBrand.sendingDomain || "your-domain.example"} = quotebench-verification</code></div></div></div>}
    </section>
  </div>;
}
