import assert from "node:assert/strict";
import test from "node:test";
import { money, price } from "../packages/pricing-engine/src/index.ts";

const workshop = {
  id: "design-day",
  categoryId: "agency",
  name: "Design day",
  unitLabel: "day",
  pricingBasis: "per_unit",
  basePriceMinor: money.minor(45_000),
  costMinor: money.minor(20_000),
  recurrence: "one_off",
};

const retainer = {
  id: "social-retainer",
  categoryId: "agency",
  name: "Social retainer",
  unitLabel: "month",
  pricingBasis: "fixed",
  basePriceMinor: money.minor(120_000),
  costMinor: money.minor(60_000),
  recurrence: "monthly",
};

const ruleSet = {
  id: "agency-v1",
  version: 1,
  roundingIncrementMinor: money.minor(500),
  quoteMinimumMinor: money.minor(0),
  marginFloorBp: money.bp(3_500),
  discountCaps: { owner: money.bp(2_000), admin: money.bp(1_500), quoter: money.bp(1_000) },
  quantityBands: [{ id: "day-5-9", itemId: "design-day", fromQuantity: 5, toQuantity: 9, unitPriceMinor: money.minor(40_000), priority: 10 }],
  modifiers: [
    { id: "complex", name: "High complexity", scope: "all", triggerQuestionId: "complexity", triggerValue: "high", adjustmentKind: "percentage", adjustmentValue: 2_000, sequence: 10 },
    { id: "rush", name: "Rush", scope: "all", triggerQuestionId: "turnaround", triggerValue: "rush", adjustmentKind: "percentage", adjustmentValue: 1_500, sequence: 20 },
  ],
  minimumFees: [{ itemId: "design-day", minimumMinor: money.minor(50_000) }],
};

const baseRequest = {
  ruleSet,
  currency: "GBP",
  role: "owner",
  answers: { complexity: "high", turnaround: "rush" },
  lines: [
    { lineId: "l1", item: retainer, quantity: 1 },
    { lineId: "l2", item: workshop, quantity: 6 },
  ],
};

test("E3-R07 E3-R14 E3-R15 E3-R39: hand-calculated agency fixture", () => {
  const result = price(baseRequest);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const workshopLine = result.quote.lines.find((line) => line.lineId === "l2");
  assert.equal(workshopLine?.effectiveUnitPriceMinor, 40_000);
  assert.equal(workshopLine?.finalPriceMinor, 331_500);
  assert.deepEqual(workshopLine?.modifiersApplied.map((modifier) => modifier.name), ["High complexity", "Rush"]);
});

test("E3-R30 E3-R31 E3-R32: separates recurring and one-off values", () => {
  const result = price({ ...baseRequest, answers: {} });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.quote.oneOffSubtotalMinor, 240_000);
  assert.equal(result.quote.recurringByFrequency.monthly, 120_000);
  assert.equal(result.quote.recurringAnnualisedMinor, 1_440_000);
});

test("E3-R04 E3-R41: cost-plus rounds up to protect margin", () => {
  const item = { id: "licence", categoryId: "software", name: "Licence", unitLabel: "user", pricingBasis: "cost_plus", costMinor: money.minor(4_801), targetMarginBp: money.bp(4_000), recurrence: "monthly" };
  const result = price({ ...baseRequest, answers: {}, lines: [{ lineId: "licence", item, quantity: 1 }], ruleSet: { ...ruleSet, quantityBands: [], modifiers: [], minimumFees: [], roundingIncrementMinor: money.minor(0) } });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.quote.lines[0]?.baseUnitPriceMinor, 8_002);
});

test("E3-R22 E3-R24: combined discount cap blocks pricing", () => {
  const result = price({ ...baseRequest, role: "quoter", quoteDiscountBp: money.bp(600), lines: [{ lineId: "l2", item: workshop, quantity: 6, discountBp: money.bp(600) }] });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.errors[0]?.code, "pricing.discount_cap_exceeded");
});

test("E3-N02: identical input produces byte-identical output", () => {
  assert.equal(JSON.stringify(price(baseRequest)), JSON.stringify(price(baseRequest)));
});

test("E3-R45: an empty basket is valid and explicit", () => {
  const result = price({ ...baseRequest, lines: [] });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.quote.oneOffSubtotalMinor, 0);
  assert.equal(result.quote.warnings[0]?.code, "pricing.empty_basket");
});

test("advanced CPQ enforces dependencies and incompatible selections", () => {
  const bundle = { ...workshop, id: "bundle", requiredItemIds: ["required"], incompatibleItemIds: ["conflict"] };
  const result = price({ ...baseRequest, answers: {}, lines: [{ lineId: "bundle", item: bundle, quantity: 1 }, { lineId: "conflict", item: { ...retainer, id: "conflict" }, quantity: 1 }] });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.errors.map(error => error.code).sort(), ["pricing.incompatible_items", "pricing.required_item_missing"]);
});

test("advanced CPQ applies item volume tiers, regional currency pricing and tax", () => {
  const item = { ...workshop, baseCurrency: "GBP", volumeTiers: [{ fromQuantity: 10, unitPriceMinor: money.minor(30_000) }], regionalPrices: [{ regionCode: "EU", currency: "EUR", unitPriceMinor: money.minor(40_000) }], taxCode: "VAT20", taxRateBp: money.bp(2_000) };
  const result = price({ ...baseRequest, currency: "EUR", regionCode: "EU", answers: {}, lines: [{ lineId: "tiered", item, quantity: 10 }], ruleSet: { ...ruleSet, quantityBands: [], modifiers: [], minimumFees: [], roundingIncrementMinor: money.minor(0) } });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.quote.lines[0].effectiveUnitPriceMinor, 30_000);
  assert.equal(result.quote.lines[0].taxMinor, 60_000);
  assert.equal(result.quote.lines[0].grossPriceMinor, 360_000);
});

test("advanced CPQ calculates usage overage, minimum commitments and indexation", () => {
  const item = { ...retainer, pricingBasis: "usage", basePriceMinor: money.minor(10_000), includedUnits: 100, overagePriceMinor: money.minor(200), minimumCommitmentMinor: money.minor(25_000), indexation: { method: "fixed", annualRateBp: money.bp(1_000), baseDate: "2025-01-01", intervalMonths: 12 } };
  const result = price({ ...baseRequest, asOfDate: "2026-01-01", answers: {}, lines: [{ lineId: "usage", item, quantity: 120 }], ruleSet: { ...ruleSet, quantityBands: [], modifiers: [], minimumFees: [], roundingIncrementMinor: money.minor(0) } });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.quote.lines[0].baseUnitPriceMinor, 11_000);
  assert.equal(result.quote.lines[0].finalPriceMinor, 25_000);
  assert.ok(result.quote.lines[0].warnings.some(warning => warning.code === "pricing.minimum_commitment_applied"));
});
