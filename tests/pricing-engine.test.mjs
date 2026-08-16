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

const noControls = {
  ...ruleSet,
  roundingIncrementMinor: money.minor(0),
  quoteMinimumMinor: money.minor(0),
  marginFloorBp: undefined,
  quantityBands: [],
  modifiers: [],
  minimumFees: [],
};

function priceSingle(item, overrides = {}) {
  return price({ ...baseRequest, answers: {}, lines: [{ lineId: "single", item, quantity: 1 }], ruleSet: noControls, ...overrides });
}

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

test("money primitives reject fractional and unsafe minor-unit values", () => {
  assert.throws(() => money.minor(1.2), /safe integer/);
  assert.throws(() => money.minor(Number.MAX_SAFE_INTEGER + 1), /safe integer/);
  assert.throws(() => money.bp(10.5), /integer basis points/);
});

test("presentation rounding is symmetric away from zero", () => {
  assert.equal(money.awayFromZero(money.minor(1_001), money.minor(500)), 1_500);
  assert.equal(money.awayFromZero(money.minor(-1_001), money.minor(500)), -1_500);
  assert.equal(money.awayFromZero(money.minor(0), money.minor(500)), 0);
  assert.equal(money.awayFromZero(money.minor(1_001), money.minor(0)), 1_001);
});

test("invalid quantities are rejected at zero, negative and fractional boundaries", () => {
  for (const quantity of [0, -1, 1.5]) {
    const result = price({ ...baseRequest, answers: {}, lines: [{ lineId: `q-${quantity}`, item: workshop, quantity }], ruleSet: noControls });
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.errors.some(error => error.code === "pricing.invalid_quantity"));
  }
});

test("catalogue minimum and maximum quantities are enforced inclusively", () => {
  const bounded = { ...workshop, minQuantity: 2, maxQuantity: 4 };
  for (const quantity of [1, 5]) {
    const result = price({ ...baseRequest, answers: {}, lines: [{ lineId: `bounded-${quantity}`, item: bounded, quantity }], ruleSet: noControls });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.errors[0]?.code, "pricing.quantity_out_of_range");
  }
  for (const quantity of [2, 4]) assert.equal(price({ ...baseRequest, answers: {}, lines: [{ lineId: `valid-${quantity}`, item: bounded, quantity }], ruleSet: noControls }).ok, true);
});

test("currency codes must be exactly three uppercase letters", () => {
  for (const currency of ["gbp", "GB", "GBP1", ""]) {
    const result = price({ ...baseRequest, currency, answers: {}, lines: [] });
    assert.equal(result.ok, false);
    if (!result.ok) assert.deepEqual(result.errors[0], { code: "pricing.validation", path: "currency" });
  }
});

test("negative line and quote discounts are rejected", () => {
  const quoteResult = price({ ...baseRequest, answers: {}, quoteDiscountBp: money.bp(-1), lines: [{ lineId: "line", item: workshop, quantity: 1 }], ruleSet: noControls });
  assert.equal(quoteResult.ok, false);
  if (!quoteResult.ok) assert.ok(quoteResult.errors.some(error => error.path === "quoteDiscountBp"));
  const lineResult = price({ ...baseRequest, answers: {}, lines: [{ lineId: "line", item: workshop, quantity: 1, discountBp: money.bp(-1) }], ruleSet: noControls });
  assert.equal(lineResult.ok, false);
  if (!lineResult.ok) assert.ok(lineResult.errors.some(error => error.lineId === "line" && error.code === "pricing.invalid_discount"));
});

test("a role discount exactly at its cap is allowed", () => {
  const result = price({ ...baseRequest, role: "quoter", answers: {}, lines: [{ lineId: "line", item: workshop, quantity: 1, discountBp: money.bp(1_000) }], ruleSet: noControls });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.quote.lines[0].finalPriceMinor, 40_500);
});

test("foreign currency without a matching regional price fails closed", () => {
  const result = priceSingle({ ...workshop, baseCurrency: "GBP" }, { currency: "USD", regionCode: "US" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.deepEqual(result.errors[0], { code: "pricing.unpriceable_item", detail: "design-day:USD:US", lineId: "single" });
});

test("regional pricing prefers an exact region and then the global currency fallback", () => {
  const regional = { ...workshop, baseCurrency: "GBP", regionalPrices: [
    { regionCode: "GLOBAL", currency: "USD", unitPriceMinor: money.minor(50_000) },
    { regionCode: "US", currency: "USD", unitPriceMinor: money.minor(55_000) },
  ] };
  const exact = priceSingle(regional, { currency: "USD", regionCode: "US" });
  const fallback = priceSingle(regional, { currency: "USD", regionCode: "CA" });
  assert.equal(exact.ok, true);
  assert.equal(fallback.ok, true);
  if (exact.ok && fallback.ok) {
    assert.equal(exact.quote.lines[0].baseUnitPriceMinor, 55_000);
    assert.equal(fallback.quote.lines[0].baseUnitPriceMinor, 50_000);
  }
});

test("cost-plus rejects missing inputs and an impossible 100 percent margin", () => {
  const missing = priceSingle({ ...workshop, pricingBasis: "cost_plus", basePriceMinor: undefined, costMinor: undefined, targetMarginBp: undefined });
  const impossible = priceSingle({ ...workshop, pricingBasis: "cost_plus", basePriceMinor: undefined, targetMarginBp: money.bp(10_000) });
  assert.equal(missing.ok, false);
  assert.equal(impossible.ok, false);
  if (!missing.ok) assert.equal(missing.errors[0]?.code, "pricing.unpriceable_item");
  if (!impossible.ok) assert.equal(impossible.errors[0]?.code, "pricing.margin_unachievable");
});

test("item bands override category bands and lowest priority wins overlaps", () => {
  const controlled = { ...noControls, quantityBands: [
    { id: "category", categoryId: "agency", fromQuantity: 1, unitPriceMinor: money.minor(41_000), priority: 1 },
    { id: "item-late", itemId: "design-day", fromQuantity: 1, unitPriceMinor: money.minor(39_000), priority: 20 },
    { id: "item-first", itemId: "design-day", fromQuantity: 1, unitPriceMinor: money.minor(38_000), priority: 10 },
  ] };
  const result = price({ ...baseRequest, answers: {}, lines: [{ lineId: "line", item: workshop, quantity: 2 }], ruleSet: controlled });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.quote.lines[0].effectiveUnitPriceMinor, 38_000);
  assert.ok(result.quote.lines[0].warnings.some(warning => warning.code === "pricing.band_overlap"));
});

test("a configured but unmatched band produces an explicit warning", () => {
  const controlled = { ...noControls, quantityBands: [{ id: "large", itemId: "design-day", fromQuantity: 10, unitPriceMinor: money.minor(30_000), priority: 1 }] };
  const result = price({ ...baseRequest, answers: {}, lines: [{ lineId: "line", item: workshop, quantity: 2 }], ruleSet: controlled });
  assert.equal(result.ok, true);
  if (result.ok) assert.ok(result.quote.lines[0].warnings.some(warning => warning.code === "pricing.band_miss"));
});

test("modifiers apply by scope and sequence, and never make a price negative", () => {
  const controlled = { ...noControls, modifiers: [
    { id: "second", name: "Second", scope: "item", itemId: "design-day", triggerQuestionId: "apply", triggerValue: "yes", adjustmentKind: "fixed", adjustmentValue: -100_000, sequence: 20 },
    { id: "first", name: "First", scope: "category", categoryId: "agency", triggerQuestionId: "apply", triggerValue: "yes", adjustmentKind: "percentage", adjustmentValue: 1_000, sequence: 10 },
    { id: "ignored", name: "Ignored", scope: "item", itemId: "other", triggerQuestionId: "apply", triggerValue: "yes", adjustmentKind: "fixed", adjustmentValue: 999_999, sequence: 1 },
  ] };
  const result = price({ ...baseRequest, answers: { apply: "yes" }, lines: [{ lineId: "line", item: workshop, quantity: 1 }], ruleSet: controlled });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.quote.lines[0].finalPriceMinor, 0);
  assert.deepEqual(result.quote.lines[0].modifiersApplied.map(modifier => modifier.name), ["First", "Second"]);
});

test("line minimum is applied after discounts and before presentation rounding", () => {
  const controlled = { ...noControls, roundingIncrementMinor: money.minor(500), minimumFees: [{ itemId: "design-day", minimumMinor: money.minor(42_250) }] };
  const result = price({ ...baseRequest, answers: {}, lines: [{ lineId: "line", item: workshop, quantity: 1, discountBp: money.bp(1_000) }], ruleSet: controlled });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.quote.lines[0].finalPriceMinor, 42_500);
  assert.ok(result.quote.lines[0].warnings.some(warning => warning.code === "pricing.line_minimum_applied"));
  assert.deepEqual(result.quote.lines[0].trace.slice(-2).map(step => step.label), ["Line minimum", "Presentation rounding"]);
});

test("quote minimum changes one-off totals but never recurring totals", () => {
  const controlled = { ...noControls, quoteMinimumMinor: money.minor(100_000) };
  const result = price({ ...baseRequest, answers: {}, lines: [
    { lineId: "one-off", item: workshop, quantity: 1 },
    { lineId: "monthly", item: retainer, quantity: 1 },
  ], ruleSet: controlled });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.quote.oneOffSubtotalMinor, 100_000);
  assert.equal(result.quote.recurringByFrequency.monthly, 120_000);
  assert.ok(result.quote.warnings.some(warning => warning.code === "pricing.quote_minimum_applied"));
});

test("fixed pricing ignores quantity while per-unit pricing scales monotonically", () => {
  for (const quantity of [1, 2, 10, 100]) {
    const fixed = price({ ...baseRequest, answers: {}, lines: [{ lineId: `fixed-${quantity}`, item: retainer, quantity }], ruleSet: noControls });
    const unit = price({ ...baseRequest, answers: {}, lines: [{ lineId: `unit-${quantity}`, item: workshop, quantity }], ruleSet: noControls });
    assert.equal(fixed.ok, true);
    assert.equal(unit.ok, true);
    if (fixed.ok && unit.ok) {
      assert.equal(fixed.quote.lines[0].finalPriceMinor, 120_000);
      assert.equal(unit.quote.lines[0].finalPriceMinor, 45_000 * quantity);
    }
  }
});

test("tax-exclusive and tax-inclusive prices produce consistent gross values", () => {
  const exclusive = priceSingle({ ...workshop, taxCode: "VAT20", taxRateBp: money.bp(2_000) });
  const inclusive = priceSingle({ ...workshop, basePriceMinor: money.minor(120_000), taxCode: "VAT20", taxRateBp: money.bp(2_000), pricesIncludeTax: true });
  assert.equal(exclusive.ok, true);
  assert.equal(inclusive.ok, true);
  if (exclusive.ok && inclusive.ok) {
    assert.equal(exclusive.quote.lines[0].taxMinor, 9_000);
    assert.equal(exclusive.quote.lines[0].grossPriceMinor, 54_000);
    assert.equal(inclusive.quote.lines[0].taxMinor, 20_000);
    assert.equal(inclusive.quote.lines[0].grossPriceMinor, 120_000);
  }
});

test("margin warnings distinguish incomplete, below-floor and negative margin", () => {
  const incomplete = priceSingle({ ...workshop, costMinor: undefined }, { ruleSet: { ...noControls, marginFloorBp: money.bp(3_500) } });
  const below = priceSingle({ ...workshop, basePriceMinor: money.minor(30_000), costMinor: money.minor(25_000) }, { ruleSet: { ...noControls, marginFloorBp: money.bp(3_500) } });
  const negative = priceSingle({ ...workshop, basePriceMinor: money.minor(20_000), costMinor: money.minor(25_000) }, { ruleSet: { ...noControls, marginFloorBp: money.bp(3_500) } });
  assert.equal(incomplete.ok, true);
  assert.equal(below.ok, true);
  assert.equal(negative.ok, true);
  if (incomplete.ok) assert.ok(incomplete.quote.warnings.some(warning => warning.code === "pricing.margin_incomplete"));
  if (below.ok) assert.ok(below.quote.lines[0].warnings.some(warning => warning.code === "pricing.margin_below_floor"));
  if (negative.ok) assert.ok(negative.quote.lines[0].warnings.some(warning => warning.code === "pricing.negative_margin"));
});

test("every recurring frequency annualises with the documented multiplier", () => {
  const frequencies = { weekly: 52, fortnightly: 26, monthly: 12, quarterly: 4, annually: 1 };
  for (const [recurrence, multiplier] of Object.entries(frequencies)) {
    const result = priceSingle({ ...retainer, id: recurrence, recurrence, basePriceMinor: money.minor(10_000) });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.quote.recurringAnnualisedMinor, 10_000 * multiplier);
  }
});

test("indexation applies only after complete elapsed policy intervals", () => {
  const indexed = { ...workshop, basePriceMinor: money.minor(100_000), indexation: { method: "fixed", annualRateBp: money.bp(1_000), baseDate: "2025-01-15", intervalMonths: 12 } };
  const before = priceSingle(indexed, { asOfDate: "2026-01-14" });
  const once = priceSingle(indexed, { asOfDate: "2026-01-15" });
  const twice = priceSingle(indexed, { asOfDate: "2027-01-15" });
  assert.equal(before.ok, true);
  assert.equal(once.ok, true);
  assert.equal(twice.ok, true);
  if (before.ok && once.ok && twice.ok) {
    assert.equal(before.quote.lines[0].baseUnitPriceMinor, 100_000);
    assert.equal(once.quote.lines[0].baseUnitPriceMinor, 110_000);
    assert.equal(twice.quote.lines[0].baseUnitPriceMinor, 121_000);
  }
});

test("simple per-unit prices are monotonic and deterministic across a broad quantity range", () => {
  let previous = -1;
  for (let quantity = 1; quantity <= 250; quantity += 1) {
    const request = { ...baseRequest, answers: {}, lines: [{ lineId: "property", item: workshop, quantity }], ruleSet: noControls };
    const first = price(request);
    const second = price(request);
    assert.deepEqual(first, second);
    assert.equal(first.ok, true);
    if (!first.ok) continue;
    assert.ok(first.quote.lines[0].finalPriceMinor > previous);
    previous = first.quote.lines[0].finalPriceMinor;
  }
});
