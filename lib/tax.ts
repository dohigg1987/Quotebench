import { money, type TaxComponent, type TaxTreatment } from "../packages/pricing-engine/src/index.ts";
import type { MarketCode } from "./market.ts";

export type WorkspaceTaxConfiguration = {
  countryCode: MarketCode;
  defaultTaxCode: string;
  treatments: TaxTreatment[];
  evidenceNote: string;
};

const zeroComponent = (id: string, label: string, jurisdictionCode: string): TaxComponent => ({
  id,
  label,
  jurisdictionCode,
  jurisdictionLevel: "country",
  rateBp: money.bp(0),
});

export function defaultTaxConfiguration(market: MarketCode): WorkspaceTaxConfiguration {
  if (market === "US") {
    return {
      countryCode: "US",
      defaultTaxCode: "US_OUT_OF_SCOPE",
      evidenceNote: "Configure the state and local components for each registered jurisdiction before applying US sales tax.",
      treatments: [
        { code: "US_SALES_TAX", label: "US sales tax", countryCode: "US", calculation: "exclusive", components: [] },
        { code: "US_EXEMPT", label: "Exempt sale", countryCode: "US", calculation: "exempt", components: [zeroComponent("us-exempt", "Exempt", "US")] },
        { code: "US_OUT_OF_SCOPE", label: "Outside registered jurisdictions", countryCode: "US", calculation: "out_of_scope", components: [zeroComponent("us-oos", "Outside scope", "US")] },
      ],
    };
  }
  return {
    countryCode: "GB",
    defaultTaxCode: "GB_STANDARD",
    evidenceNote: "UK VAT presets reflect the standard, reduced and zero rates. Confirm product eligibility and retain supporting evidence.",
    treatments: [
      { code: "GB_STANDARD", label: "UK VAT standard rate", countryCode: "GB", calculation: "exclusive", components: [{ id: "gb-vat-standard", label: "VAT", jurisdictionCode: "GB", jurisdictionLevel: "country", rateBp: money.bp(2_000) }] },
      { code: "GB_REDUCED", label: "UK VAT reduced rate", countryCode: "GB", calculation: "exclusive", components: [{ id: "gb-vat-reduced", label: "VAT", jurisdictionCode: "GB", jurisdictionLevel: "country", rateBp: money.bp(500) }] },
      { code: "GB_ZERO", label: "UK VAT zero rate", countryCode: "GB", calculation: "exclusive", components: [zeroComponent("gb-vat-zero", "VAT", "GB")] },
      { code: "GB_EXEMPT", label: "VAT exempt", countryCode: "GB", calculation: "exempt", components: [zeroComponent("gb-vat-exempt", "VAT exempt", "GB")] },
      { code: "GB_OUT_OF_SCOPE", label: "Outside scope of UK VAT", countryCode: "GB", calculation: "out_of_scope", components: [zeroComponent("gb-vat-oos", "Outside scope", "GB")] },
    ],
  };
}

export function normaliseTaxConfiguration(value: unknown, market: MarketCode): WorkspaceTaxConfiguration {
  const fallback = defaultTaxConfiguration(market);
  if (!value || typeof value !== "object") return fallback;
  const input = value as Partial<WorkspaceTaxConfiguration>;
  if (!Array.isArray(input.treatments)) return fallback;
  const treatments = input.treatments.slice(0, 40).flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const treatment = candidate as TaxTreatment;
    const code = String(treatment.code ?? "").trim().toUpperCase().slice(0, 40);
    if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(code)) return [];
    const calculation = ["exclusive", "inclusive", "exempt", "out_of_scope"].includes(treatment.calculation) ? treatment.calculation : "exclusive";
    const components = Array.isArray(treatment.components) ? treatment.components.slice(0, 8).flatMap((component, index) => {
      const rate = Number(component?.rateBp);
      if (!Number.isInteger(rate) || rate < 0 || rate > 10_000) return [];
      const level = ["country", "state", "county", "city", "district"].includes(component.jurisdictionLevel) ? component.jurisdictionLevel : "country";
      return [{
        id: String(component.id || `${code}-${index + 1}`).slice(0, 80),
        label: String(component.label || "Tax").trim().slice(0, 80),
        jurisdictionCode: String(component.jurisdictionCode || market).trim().toUpperCase().slice(0, 32),
        jurisdictionLevel: level as TaxComponent["jurisdictionLevel"],
        rateBp: money.bp(rate),
      }];
    }) : [];
    return [{ code, label: String(treatment.label || code).trim().slice(0, 120), countryCode: market, calculation: calculation as TaxTreatment["calculation"], components }];
  });
  if (!treatments.length) return fallback;
  const defaultTaxCode = treatments.some((treatment) => treatment.code === input.defaultTaxCode) ? String(input.defaultTaxCode) : treatments[0].code;
  return { countryCode: market, defaultTaxCode, treatments, evidenceNote: String(input.evidenceNote || fallback.evidenceNote).trim().slice(0, 500) };
}

