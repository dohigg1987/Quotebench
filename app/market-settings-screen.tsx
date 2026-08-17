"use client";

import { useMemo, useState } from "react";
import { MARKET_PRESETS, type MarketCode, type WorkspaceMarketSettings } from "../lib/market";
import { defaultTaxConfiguration, type WorkspaceTaxConfiguration } from "../lib/tax";
import { money, type TaxComponent } from "../packages/pricing-engine/src/index";

type WorkspaceSettings = Omit<WorkspaceMarketSettings,"currency"> & { currency:string; taxConfiguration: WorkspaceTaxConfiguration };
type Props = { workspace: WorkspaceSettings | null; onSaved: () => Promise<void> | void };

const jurisdictions: TaxComponent["jurisdictionLevel"][] = ["state", "county", "city", "district"];

function percent(rateBp: number) { return String(rateBp / 100); }

export default function MarketSettingsScreen({ workspace, onSaved }: Props) {
  const initialMarket = workspace?.market ?? "GB";
  const [market, setMarket] = useState<MarketCode>(initialMarket);
  const [timezone, setTimezone] = useState(workspace?.timezone ?? MARKET_PRESETS[initialMarket].timezone);
  const [taxRegistrationStatus, setTaxRegistrationStatus] = useState<WorkspaceMarketSettings["taxRegistrationStatus"]>(workspace?.taxRegistrationStatus ?? "registered");
  const [pricesIncludeTax, setPricesIncludeTax] = useState(workspace?.pricesIncludeTax ?? false);
  const [taxConfiguration, setTaxConfiguration] = useState<WorkspaceTaxConfiguration>(workspace?.taxConfiguration ?? defaultTaxConfiguration(initialMarket));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const activeTreatment = useMemo(() => taxConfiguration.treatments.find((treatment) => treatment.code === taxConfiguration.defaultTaxCode), [taxConfiguration]);

  function selectMarket(next: MarketCode) {
    const preset = MARKET_PRESETS[next];
    setMarket(next);
    setTimezone(preset.timezone);
    setTaxRegistrationStatus(preset.taxRegistrationStatus);
    setPricesIncludeTax(preset.pricesIncludeTax);
    setTaxConfiguration(defaultTaxConfiguration(next));
    setMessage(null);
  }

  function updateUsComponent(index: number, field: keyof TaxComponent, value: string) {
    setTaxConfiguration((current) => ({
      ...current,
      treatments: current.treatments.map((treatment) => treatment.code !== "US_SALES_TAX" ? treatment : {
        ...treatment,
        components: treatment.components.map((component, componentIndex) => componentIndex !== index ? component : {
          ...component,
          [field]: field === "rateBp" ? money.bp(Math.max(0, Math.min(10_000, Math.round(Number(value) * 100)))) : value,
        }),
      }),
    }));
  }

  function addUsComponent() {
    setTaxConfiguration((current) => ({
      ...current,
      defaultTaxCode: "US_SALES_TAX",
      treatments: current.treatments.map((treatment) => treatment.code !== "US_SALES_TAX" ? treatment : {
        ...treatment,
        components: [...treatment.components, { id: crypto.randomUUID(), label: "State tax", jurisdictionCode: "US-", jurisdictionLevel: "state", rateBp: money.bp(0) }],
      }),
    }));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/workspaces", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "update_market", settings: { market, timezone, taxRegistrationStatus, pricesIncludeTax }, taxConfiguration }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Workspace market settings could not be saved.");
      setMessage("Market and tax settings saved. New pricing runs will use this configuration.");
      await onSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Workspace market settings could not be saved.");
    } finally { setSaving(false); }
  }

  const salesTax = taxConfiguration.treatments.find((treatment) => treatment.code === "US_SALES_TAX");
  const combinedRate = (salesTax?.components ?? []).reduce((total, component) => total + component.rateBp, 0) / 100;

  return <div className="standard-page market-settings-page">
    <div className="page-heading"><div><p className="eyebrow">Workspace configuration</p><h1>Markets and tax</h1><p className="page-subtitle">Control currency, regional presentation and tax evidence at workspace level. Every saved quote keeps the configuration used to price it.</p></div><button className="button primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save configuration"}</button></div>

    <section className="market-selector" aria-label="Primary market">
      {(["GB", "US"] as const).map((code) => <button key={code} className={market === code ? "selected" : ""} onClick={() => selectMarket(code)}><span className="market-flag" aria-hidden="true">{code === "GB" ? "GB" : "US"}</span><span><strong>{code === "GB" ? "United Kingdom" : "United States"}</strong><small>{code === "GB" ? "GBP · en-GB · UK VAT" : "USD · en-US · state and local sales tax"}</small></span><b>{market === code ? "Active" : "Select"}</b></button>)}
    </section>

    <div className="market-layout">
      <section className="data-panel market-profile"><div className="panel-toolbar"><div><h2>Regional profile</h2><p>Applied throughout quoting and recipient documents</p></div><span className="market-code">{market}</span></div><div className="market-form-grid"><label><span>Currency</span><input value={MARKET_PRESETS[market].currency} disabled /></label><label><span>Language and formatting</span><input value={MARKET_PRESETS[market].locale} disabled /></label><label><span>Timezone</span><input value={timezone} onChange={(event) => setTimezone(event.target.value)} /></label><label><span>Tax registration</span><select value={taxRegistrationStatus} onChange={(event) => setTaxRegistrationStatus(event.target.value as WorkspaceMarketSettings["taxRegistrationStatus"])}><option value="registered">Registered</option><option value="pending">Registration pending</option><option value="not_registered">Not registered</option></select></label></div><label className="market-toggle"><input type="checkbox" checked={pricesIncludeTax} onChange={(event) => setPricesIncludeTax(event.target.checked)} /><span><strong>Catalogue prices include tax</strong><small>Use only when entered prices already include VAT or sales tax.</small></span></label></section>

      <aside className="market-assurance"><span>PRICING ASSURANCE</span><strong>{market === "GB" ? "UK-ready" : salesTax?.components.length ? "US jurisdiction configured" : "US setup required"}</strong><p>{market === "GB" ? "Standard, reduced, zero-rated, exempt and out-of-scope treatments remain separate in the pricing trace." : salesTax?.components.length ? `${combinedRate.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}% combined configured rate across ${salesTax.components.length} jurisdictions.` : "Add each applicable state and local component before selecting taxable US sales."}</p><dl><div><dt>Default treatment</dt><dd>{activeTreatment?.label ?? "Not set"}</dd></div><div><dt>Quote evidence</dt><dd>Snapshot retained</dd></div><div><dt>Customer exemptions</dt><dd>Per quote</dd></div></dl></aside>
    </div>

    <section className="data-panel tax-policy-panel"><div className="panel-toolbar"><div><h2>{market === "GB" ? "UK VAT treatments" : "US sales-tax jurisdiction"}</h2><p>{taxConfiguration.evidenceNote}</p></div>{market === "US" && <button className="button secondary" onClick={addUsComponent}>+ Add jurisdiction</button>}</div>{market === "GB" ? <div className="tax-treatment-grid">{taxConfiguration.treatments.map((treatment) => <button key={treatment.code} className={taxConfiguration.defaultTaxCode === treatment.code ? "selected" : ""} onClick={() => setTaxConfiguration((current) => ({ ...current, defaultTaxCode: treatment.code }))}><span>{treatment.calculation.replaceAll("_", " ")}</span><strong>{treatment.label}</strong><small>{percent(treatment.components.reduce((sum, component) => sum + component.rateBp, 0))}%</small></button>)}</div> : <div className="jurisdiction-table"><div className="jurisdiction-row heading"><span>Level</span><span>Jurisdiction code</span><span>Label</span><span>Rate</span><span /></div>{(salesTax?.components ?? []).map((component, index) => <div className="jurisdiction-row" key={component.id}><select aria-label={`Jurisdiction level ${index + 1}`} value={component.jurisdictionLevel} onChange={(event) => updateUsComponent(index, "jurisdictionLevel", event.target.value)}>{jurisdictions.map((level) => <option key={level}>{level}</option>)}</select><input aria-label={`Jurisdiction code ${index + 1}`} value={component.jurisdictionCode} onChange={(event) => updateUsComponent(index, "jurisdictionCode", event.target.value.toUpperCase())} /><input aria-label={`Tax label ${index + 1}`} value={component.label} onChange={(event) => updateUsComponent(index, "label", event.target.value)} /><label><input aria-label={`Tax rate ${index + 1}`} type="number" min="0" max="100" step="0.001" value={percent(component.rateBp)} onChange={(event) => updateUsComponent(index, "rateBp", event.target.value)} /><span>%</span></label><button aria-label={`Remove ${component.label}`} onClick={() => setTaxConfiguration((current) => ({ ...current, treatments: current.treatments.map((treatment) => treatment.code !== "US_SALES_TAX" ? treatment : { ...treatment, components: treatment.components.filter((_, componentIndex) => componentIndex !== index) }) }))}>×</button></div>)}{!salesTax?.components.length && <div className="jurisdiction-empty"><strong>No taxable US jurisdiction configured</strong><p>QuoteBench will default to outside-scope treatment and will not invent a rate. Add verified components for the place where you are registered to collect sales tax.</p></div>}</div>}</section>
    {message && <p className={`market-message ${message.startsWith("Market") ? "success" : ""}`} role="status">{message}</p>}
  </div>;
}

