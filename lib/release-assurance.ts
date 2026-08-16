import { money, price } from "../packages/pricing-engine/src/index.ts";

export const RELEASE_SMOKE_TENANT_ID = "quotebench-release-smoke";

const fixture = {
  ruleSet: {
    id: "release-assurance-v1",
    version: 1,
    roundingIncrementMinor: money.minor(500),
    quoteMinimumMinor: money.minor(0),
    marginFloorBp: money.bp(3_500),
    discountCaps: { owner: money.bp(2_000), admin: money.bp(1_500), quoter: money.bp(1_000) },
    quantityBands: [{ id: "day-5-9", itemId: "design-day", fromQuantity: 5, toQuantity: 9, unitPriceMinor: money.minor(40_000), priority: 10 }],
    modifiers: [
      { id: "complex", name: "High complexity", scope: "all" as const, triggerQuestionId: "complexity", triggerValue: "high", adjustmentKind: "percentage" as const, adjustmentValue: 2_000, sequence: 10 },
      { id: "rush", name: "Rush", scope: "all" as const, triggerQuestionId: "turnaround", triggerValue: "rush", adjustmentKind: "percentage" as const, adjustmentValue: 1_500, sequence: 20 },
    ],
    minimumFees: [{ itemId: "design-day", minimumMinor: money.minor(50_000) }],
  },
  currency: "GBP",
  role: "owner" as const,
  answers: { complexity: "high", turnaround: "rush" },
  lines: [
    {
      lineId: "recurring",
      item: { id: "social-retainer", categoryId: "agency", name: "Social retainer", unitLabel: "month", pricingBasis: "fixed" as const, basePriceMinor: money.minor(120_000), costMinor: money.minor(60_000), recurrence: "monthly" as const },
      quantity: 1,
    },
    {
      lineId: "one-off",
      item: { id: "design-day", categoryId: "agency", name: "Design day", unitLabel: "day", pricingBasis: "per_unit" as const, basePriceMinor: money.minor(45_000), costMinor: money.minor(20_000), recurrence: "one_off" as const },
      quantity: 6,
    },
  ],
};

export const EXPECTED_RELEASE_PRICING_TRACE = {
  tenantId: RELEASE_SMOKE_TENANT_ID,
  oneOffSubtotalMinor: 331_500,
  recurringMonthlyMinor: 166_000,
  recurringAnnualisedMinor: 1_992_000,
  lines: [
    {
      lineId: "recurring",
      finalPriceMinor: 166_000,
      trace: [
        { label: "Base and quantity", beforeMinor: 0, afterMinor: 120_000 },
        { label: "High complexity", beforeMinor: 120_000, afterMinor: 144_000 },
        { label: "Rush", beforeMinor: 144_000, afterMinor: 165_600 },
        { label: "Presentation rounding", beforeMinor: 165_600, afterMinor: 166_000 },
      ],
    },
    {
      lineId: "one-off",
      finalPriceMinor: 331_500,
      trace: [
        { label: "Base and quantity", beforeMinor: 0, afterMinor: 240_000 },
        { label: "High complexity", beforeMinor: 240_000, afterMinor: 288_000 },
        { label: "Rush", beforeMinor: 288_000, afterMinor: 331_200 },
        { label: "Presentation rounding", beforeMinor: 331_200, afterMinor: 331_500 },
      ],
    },
  ],
};

export function runReleasePricingAssurance() {
  const result = price(fixture);
  if (!result.ok) return { ok: false, fixture: "release-assurance-v1", reason: "pricing_failed" } as const;
  const actual = {
    tenantId: RELEASE_SMOKE_TENANT_ID,
    oneOffSubtotalMinor: result.quote.oneOffSubtotalMinor,
    recurringMonthlyMinor: result.quote.recurringByFrequency.monthly,
    recurringAnnualisedMinor: result.quote.recurringAnnualisedMinor,
    lines: result.quote.lines.map((line) => ({ lineId: line.lineId, finalPriceMinor: line.finalPriceMinor, trace: line.trace })),
  };
  return {
    ok: JSON.stringify(actual) === JSON.stringify(EXPECTED_RELEASE_PRICING_TRACE),
    fixture: "release-assurance-v1",
    actual,
    expected: EXPECTED_RELEASE_PRICING_TRACE,
  } as const;
}
