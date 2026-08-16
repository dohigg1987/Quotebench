/**
 * QuoteBench pricing engine.
 *
 * Pure, deterministic and dependency-free. Money is represented by the
 * branded Minor type and can only be created through the money helpers.
 */

export type Minor = number & { readonly __minor: unique symbol };
export type BasisPoints = number & { readonly __basisPoints: unique symbol };

export const money = {
  minor(value: number): Minor {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError("Money must be a safe integer in minor units");
    }
    return value as Minor;
  },
  bp(value: number): BasisPoints {
    if (!Number.isInteger(value)) {
      throw new TypeError("Percentage values must be integer basis points");
    }
    return value as BasisPoints;
  },
  add(left: Minor, right: Minor): Minor {
    return money.minor(left + right);
  },
  multiply(value: Minor, quantity: number): Minor {
    return money.minor(value * quantity);
  },
  percentage(value: Minor, basisPoints: BasisPoints): Minor {
    return money.minor(Math.floor((value * basisPoints + 5_000) / 10_000));
  },
  discount(value: Minor, basisPoints: BasisPoints): Minor {
    return money.minor(value - money.percentage(value, basisPoints));
  },
  costPlus(cost: Minor, margin: BasisPoints): Minor {
    return money.minor(Math.ceil((cost * 10_000) / (10_000 - margin)));
  },
  awayFromZero(value: Minor, increment: Minor): Minor {
    if (increment === 0) return value;
    if (value === 0) return value;
    const direction = value > 0 ? 1 : -1;
    return money.minor(direction * Math.ceil(Math.abs(value) / increment) * increment);
  },
};

export type Role = "owner" | "admin" | "quoter";
export type Frequency =
  | "one_off"
  | "weekly"
  | "fortnightly"
  | "monthly"
  | "quarterly"
  | "annually";
export type PricingBasis = "fixed" | "per_unit" | "cost_plus" | "retainer" | "usage";

export type VolumeTier = {
  fromQuantity: number;
  toQuantity?: number;
  unitPriceMinor: Minor;
};

export type RegionalPrice = {
  regionCode: string;
  currency: string;
  unitPriceMinor: Minor;
};

export type IndexationPolicy = {
  method: "fixed" | "cpi" | "rpi" | "custom";
  annualRateBp: BasisPoints;
  baseDate: string;
  intervalMonths: number;
};

export type CatalogueItem = {
  id: string;
  categoryId: string;
  subcategoryId?: string;
  name: string;
  description?: string;
  serviceSchedule?: string;
  serviceTerms?: string;
  proposalTypeIds?: string[];
  defaultProposalTypeIds?: string[];
  unitLabel: string;
  pricingBasis: PricingBasis;
  basePriceMinor?: Minor;
  costMinor?: Minor;
  targetMarginBp?: BasisPoints;
  recurrence: Frequency;
  minQuantity?: number;
  maxQuantity?: number;
  bundleItemIds?: string[];
  optionalUpgradeItemIds?: string[];
  requiredItemIds?: string[];
  incompatibleItemIds?: string[];
  volumeTiers?: VolumeTier[];
  regionalPrices?: RegionalPrice[];
  baseCurrency?: string;
  taxCode?: string;
  taxRateBp?: BasisPoints;
  pricesIncludeTax?: boolean;
  includedUnits?: number;
  overagePriceMinor?: Minor;
  minimumCommitmentMinor?: Minor;
  indexation?: IndexationPolicy;
};

export type QuantityBand = {
  id: string;
  itemId?: string;
  categoryId?: string;
  fromQuantity: number;
  toQuantity?: number;
  unitPriceMinor: Minor;
  priority: number;
};

export type Modifier = {
  id: string;
  name: string;
  scope: "item" | "category" | "all";
  itemId?: string;
  categoryId?: string;
  triggerQuestionId: string;
  triggerValue: string;
  adjustmentKind: "percentage" | "fixed";
  adjustmentValue: number;
  sequence: number;
};

export type MinimumFee = {
  itemId?: string;
  categoryId?: string;
  minimumMinor: Minor;
};

export type RuleQuestion = {
  id: string;
  prompt: string;
  helpText?: string;
  inputKind: "single_choice";
  required: boolean;
  options: Array<{ value: string; label: string; helpText?: string }>;
};

export type RuleSet = {
  id: string;
  version: number;
  roundingIncrementMinor: Minor;
  quoteMinimumMinor: Minor;
  marginFloorBp?: BasisPoints;
  discountCaps: Record<Role, BasisPoints>;
  quantityBands: QuantityBand[];
  modifiers: Modifier[];
  minimumFees: MinimumFee[];
  questions?: RuleQuestion[];
};

export type RequestLine = {
  lineId: string;
  item: CatalogueItem;
  quantity: number;
  discountBp?: BasisPoints;
};

export type PriceRequest = {
  ruleSet: RuleSet;
  currency: string;
  role: Role;
  answers: Record<string, string>;
  lines: RequestLine[];
  quoteDiscountBp?: BasisPoints;
  trace?: boolean;
  regionCode?: string;
  asOfDate?: string;
};

export type WarningCode =
  | "pricing.empty_basket"
  | "pricing.band_miss"
  | "pricing.band_overlap"
  | "pricing.line_minimum_applied"
  | "pricing.quote_minimum_applied"
  | "pricing.margin_incomplete"
  | "pricing.margin_below_floor"
  | "pricing.negative_margin"
  | "pricing.indexation_applied"
  | "pricing.minimum_commitment_applied";

export type PriceErrorCode =
  | "pricing.invalid_quantity"
  | "pricing.quantity_out_of_range"
  | "pricing.margin_unachievable"
  | "pricing.unpriceable_item"
  | "pricing.discount_cap_exceeded"
  | "pricing.invalid_discount"
  | "pricing.validation"
  | "pricing.required_item_missing"
  | "pricing.bundle_item_missing"
  | "pricing.incompatible_items";

export type PriceWarning = {
  code: WarningCode;
  lineId?: string;
  detail?: string;
};

export type PriceError = {
  code: PriceErrorCode;
  lineId?: string;
  path?: string;
  detail?: string;
};

export type TraceStep = {
  label: string;
  beforeMinor: Minor;
  afterMinor: Minor;
};

export type AppliedModifier = {
  id: string;
  name: string;
  adjustmentKind: "percentage" | "fixed";
  adjustmentValue: number;
  beforeMinor: Minor;
  afterMinor: Minor;
};

export type PricedLine = {
  lineId: string;
  itemName: string;
  categoryId: string;
  subcategoryId?: string;
  description?: string;
  serviceSchedule?: string;
  serviceTerms?: string;
  unitLabel: string;
  baseUnitPriceMinor: Minor;
  effectiveUnitPriceMinor: Minor;
  quantity: number;
  subtotalMinor: Minor;
  modifiersApplied: AppliedModifier[];
  discountBp: BasisPoints;
  finalPriceMinor: Minor;
  recurrence: Frequency;
  marginBp: BasisPoints | null;
  warnings: PriceWarning[];
  trace: TraceStep[];
  taxCode: string;
  taxRateBp: BasisPoints;
  taxMinor: Minor;
  grossPriceMinor: Minor;
  pricingModel: PricingBasis;
};

export type PricedQuote = {
  currency: string;
  ruleSetVersion: number;
  lines: PricedLine[];
  oneOffSubtotalMinor: Minor;
  recurringByFrequency: Record<Frequency, Minor>;
  recurringAnnualisedMinor: Minor;
  quoteDiscountBp: BasisPoints;
  marginBp: BasisPoints | null;
  warnings: PriceWarning[];
  taxTotalMinor: Minor;
  grossOneOffTotalMinor: Minor;
  grossRecurringByFrequency: Record<Frequency, Minor>;
};

export type PriceResult =
  | { ok: true; quote: PricedQuote }
  | { ok: false; errors: PriceError[] };

const annualMultipliers: Record<Frequency, number> = {
  one_off: 0,
  weekly: 52,
  fortnightly: 26,
  monthly: 12,
  quarterly: 4,
  annually: 1,
};

function scopedToItem<T extends { itemId?: string; categoryId?: string }>(
  candidates: T[],
  item: CatalogueItem,
): T[] {
  const itemRules = candidates.filter((candidate) => candidate.itemId === item.id);
  if (itemRules.length > 0) return itemRules;
  return candidates.filter((candidate) => candidate.categoryId === item.categoryId);
}

function resolvedBand(
  ruleSet: RuleSet,
  item: CatalogueItem,
  quantity: number,
): { band?: QuantityBand; overlap: boolean } {
  const matching = scopedToItem(ruleSet.quantityBands, item)
    .filter(
      (band) =>
        quantity >= band.fromQuantity &&
        (band.toQuantity === undefined || quantity <= band.toQuantity),
    )
    .sort((left, right) => left.priority - right.priority);
  return { band: matching[0], overlap: matching.length > 1 };
}

function resolvedItemTier(item: CatalogueItem, quantity: number): VolumeTier | undefined {
  return (item.volumeTiers ?? [])
    .filter((tier) => quantity >= tier.fromQuantity && (tier.toQuantity === undefined || quantity <= tier.toQuantity))
    .sort((left, right) => right.fromQuantity - left.fromQuantity)[0];
}

function regionalPrice(item: CatalogueItem, currency: string, regionCode?: string): RegionalPrice | undefined {
  const prices = item.regionalPrices ?? [];
  return prices.find((entry) => entry.currency === currency && entry.regionCode === (regionCode ?? "GLOBAL"))
    ?? prices.find((entry) => entry.currency === currency && entry.regionCode === "GLOBAL");
}

function elapsedIndexationCycles(policy: IndexationPolicy | undefined, asOfDate?: string): number {
  if (!policy || !asOfDate || policy.intervalMonths <= 0) return 0;
  const base = new Date(`${policy.baseDate}T00:00:00Z`);
  const asOf = new Date(`${asOfDate}T00:00:00Z`);
  if (!Number.isFinite(base.getTime()) || !Number.isFinite(asOf.getTime()) || asOf <= base) return 0;
  const calendarMonths = (asOf.getUTCFullYear() - base.getUTCFullYear()) * 12 + asOf.getUTCMonth() - base.getUTCMonth();
  const months = calendarMonths - (asOf.getUTCDate() < base.getUTCDate() ? 1 : 0);
  return Math.max(0, Math.floor(months / policy.intervalMonths));
}

function applyIndexation(value: Minor, policy: IndexationPolicy | undefined, asOfDate?: string): Minor {
  const cycles = elapsedIndexationCycles(policy, asOfDate);
  if (!policy || cycles === 0) return value;
  return money.minor(Math.round(value * Math.pow(1 + policy.annualRateBp / 10_000, cycles)));
}

function lineMinimum(ruleSet: RuleSet, item: CatalogueItem): MinimumFee | undefined {
  return scopedToItem(ruleSet.minimumFees, item)[0];
}

function modifierMatches(modifier: Modifier, item: CatalogueItem): boolean {
  if (modifier.scope === "all") return true;
  if (modifier.scope === "item") return modifier.itemId === item.id;
  return modifier.categoryId === item.categoryId;
}

function validate(request: PriceRequest): PriceError[] {
  const errors: PriceError[] = [];
  if (!/^[A-Z]{3}$/.test(request.currency)) {
    errors.push({ code: "pricing.validation", path: "currency" });
  }
  const quoteDiscount = request.quoteDiscountBp ?? money.bp(0);
  if (quoteDiscount < 0) {
    errors.push({ code: "pricing.invalid_discount", path: "quoteDiscountBp" });
  }
  const selectedIds = new Set(request.lines.map((line) => line.item.id));
  for (const line of request.lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      errors.push({ code: "pricing.invalid_quantity", lineId: line.lineId });
    }
    if (
      (line.item.minQuantity !== undefined && line.quantity < line.item.minQuantity) ||
      (line.item.maxQuantity !== undefined && line.quantity > line.item.maxQuantity)
    ) {
      errors.push({
        code: "pricing.quantity_out_of_range",
        lineId: line.lineId,
        detail: `${line.item.minQuantity ?? 1}:${line.item.maxQuantity ?? "unbounded"}`,
      });
    }
    const lineDiscount = line.discountBp ?? money.bp(0);
    if (lineDiscount < 0) {
      errors.push({ code: "pricing.invalid_discount", lineId: line.lineId });
    }
    const combinedDiscount = Math.round(
      10_000 - ((10_000 - lineDiscount) * (10_000 - quoteDiscount)) / 10_000,
    );
    const cap = request.ruleSet.discountCaps[request.role];
    if (combinedDiscount > cap) {
      errors.push({
        code: "pricing.discount_cap_exceeded",
        lineId: line.lineId,
        detail: `${combinedDiscount}:${cap}`,
      });
    }
    for (const requiredId of line.item.requiredItemIds ?? []) {
      if (!selectedIds.has(requiredId)) errors.push({ code: "pricing.required_item_missing", lineId: line.lineId, detail: requiredId });
    }
    for (const bundledId of line.item.bundleItemIds ?? []) {
      if (!selectedIds.has(bundledId)) errors.push({ code: "pricing.bundle_item_missing", lineId: line.lineId, detail: bundledId });
    }
    for (const incompatibleId of line.item.incompatibleItemIds ?? []) {
      if (selectedIds.has(incompatibleId)) errors.push({ code: "pricing.incompatible_items", lineId: line.lineId, detail: incompatibleId });
    }
  }
  return errors;
}

function resolveBase(item: CatalogueItem, request: PriceRequest): Minor | PriceError {
  const configuredRegionalPrice = regionalPrice(item, request.currency, request.regionCode);
  if (configuredRegionalPrice) return applyIndexation(configuredRegionalPrice.unitPriceMinor, item.indexation, request.asOfDate);
  if (request.currency !== (item.baseCurrency ?? "GBP")) return { code: "pricing.unpriceable_item", detail: `${item.id}:${request.currency}:${request.regionCode ?? "GLOBAL"}` };
  if (item.pricingBasis === "cost_plus") {
    if (
      item.costMinor === undefined ||
      item.targetMarginBp === undefined ||
      item.targetMarginBp >= 10_000
    ) {
      return {
        code:
          item.targetMarginBp !== undefined && item.targetMarginBp >= 10_000
            ? "pricing.margin_unachievable"
            : "pricing.unpriceable_item",
        detail: item.id,
      };
    }
    return applyIndexation(money.costPlus(item.costMinor, item.targetMarginBp), item.indexation, request.asOfDate);
  }
  return item.basePriceMinor === undefined
    ? { code: "pricing.unpriceable_item", detail: item.id }
    : applyIndexation(item.basePriceMinor, item.indexation, request.asOfDate);
}

function calculateMargin(finalPrice: Minor, item: CatalogueItem, quantity: number): BasisPoints | null {
  if (item.costMinor === undefined || finalPrice === 0) return null;
  const cost = item.pricingBasis === "fixed" ? item.costMinor : money.multiply(item.costMinor, quantity);
  return money.bp(Math.round(((finalPrice - cost) * 10_000) / finalPrice));
}

function priceLine(request: PriceRequest, line: RequestLine): PricedLine | PriceError {
  const base = resolveBase(line.item, request);
  if (typeof base !== "number") return { ...base, lineId: line.lineId };

  const warnings: PriceWarning[] = [];
  const trace: TraceStep[] = [];
  const bandResult = resolvedBand(request.ruleSet, line.item, line.quantity);
  const itemTier = resolvedItemTier(line.item, line.quantity);
  const effectiveUnit = applyIndexation(itemTier?.unitPriceMinor ?? bandResult.band?.unitPriceMinor ?? base, line.item.indexation, itemTier || bandResult.band ? request.asOfDate : undefined);
  if (request.ruleSet.quantityBands.some((band) => band.itemId === line.item.id || band.categoryId === line.item.categoryId) && !bandResult.band) {
    warnings.push({ code: "pricing.band_miss", lineId: line.lineId });
  }
  if (bandResult.overlap) {
    warnings.push({ code: "pricing.band_overlap", lineId: line.lineId });
  }

  let running = line.item.pricingBasis === "fixed" || line.item.pricingBasis === "retainer"
    ? effectiveUnit
    : line.item.pricingBasis === "usage"
      ? money.add(effectiveUnit, money.multiply(line.item.overagePriceMinor ?? effectiveUnit, Math.max(0, line.quantity - (line.item.includedUnits ?? 0))))
      : money.multiply(effectiveUnit, line.quantity);
  const initial = running;
  trace.push({ label: "Base and quantity", beforeMinor: money.minor(0), afterMinor: running });
  if (elapsedIndexationCycles(line.item.indexation, request.asOfDate) > 0) warnings.push({ code: "pricing.indexation_applied", lineId: line.lineId, detail: line.item.indexation?.method });

  const applied: AppliedModifier[] = [];
  const modifiers = request.ruleSet.modifiers
    .filter(
      (modifier) =>
        modifierMatches(modifier, line.item) &&
        request.answers[modifier.triggerQuestionId] === modifier.triggerValue,
    )
    .sort((left, right) => left.sequence - right.sequence);

  for (const modifier of modifiers) {
    const before = running;
    running =
      modifier.adjustmentKind === "percentage"
        ? money.add(running, money.percentage(running, money.bp(modifier.adjustmentValue)))
        : money.add(running, money.minor(modifier.adjustmentValue));
    if (running < 0) running = money.minor(0);
    applied.push({
      id: modifier.id,
      name: modifier.name,
      adjustmentKind: modifier.adjustmentKind,
      adjustmentValue: modifier.adjustmentValue,
      beforeMinor: before,
      afterMinor: running,
    });
    trace.push({ label: modifier.name, beforeMinor: before, afterMinor: running });
  }

  const lineDiscount = line.discountBp ?? money.bp(0);
  if (lineDiscount > 0) {
    const before = running;
    running = money.discount(running, lineDiscount);
    trace.push({ label: "Line discount", beforeMinor: before, afterMinor: running });
  }

  const quoteDiscount = request.quoteDiscountBp ?? money.bp(0);
  if (quoteDiscount > 0) {
    const before = running;
    running = money.discount(running, quoteDiscount);
    trace.push({ label: "Quote discount", beforeMinor: before, afterMinor: running });
  }

  const minimum = lineMinimum(request.ruleSet, line.item);
  if (minimum && running < minimum.minimumMinor) {
    warnings.push({
      code: "pricing.line_minimum_applied",
      lineId: line.lineId,
      detail: String(running),
    });
    const before = running;
    running = minimum.minimumMinor;
    trace.push({ label: "Line minimum", beforeMinor: before, afterMinor: running });
  }

  if (line.item.minimumCommitmentMinor !== undefined && running < line.item.minimumCommitmentMinor) {
    const before = running;
    running = line.item.minimumCommitmentMinor;
    warnings.push({ code: "pricing.minimum_commitment_applied", lineId: line.lineId, detail: String(before) });
    trace.push({ label: "Minimum commitment", beforeMinor: before, afterMinor: running });
  }

  const beforeRounding = running;
  running = money.awayFromZero(running, request.ruleSet.roundingIncrementMinor);
  if (beforeRounding !== running) {
    trace.push({ label: "Presentation rounding", beforeMinor: beforeRounding, afterMinor: running });
  }

  const marginBp = calculateMargin(running, line.item, line.quantity);
  if (marginBp !== null && marginBp < 0) {
    warnings.push({ code: "pricing.negative_margin", lineId: line.lineId });
  }
  if (
    marginBp !== null &&
    request.ruleSet.marginFloorBp !== undefined &&
    marginBp < request.ruleSet.marginFloorBp
  ) {
    warnings.push({ code: "pricing.margin_below_floor", lineId: line.lineId });
  }

  const taxRate = line.item.taxRateBp ?? money.bp(0);
  const taxMinor = line.item.pricesIncludeTax
    ? money.minor(Math.round(running - running * 10_000 / (10_000 + taxRate)))
    : money.percentage(running, taxRate);
  const grossPriceMinor = line.item.pricesIncludeTax ? running : money.add(running, taxMinor);

  return {
    lineId: line.lineId,
    itemName: line.item.name,
    categoryId: line.item.categoryId,
    ...(line.item.subcategoryId ? { subcategoryId: line.item.subcategoryId } : {}),
    ...(line.item.description ? { description: line.item.description } : {}),
    ...(line.item.serviceSchedule ? { serviceSchedule: line.item.serviceSchedule } : {}),
    ...(line.item.serviceTerms ? { serviceTerms: line.item.serviceTerms } : {}),
    unitLabel: line.item.unitLabel,
    baseUnitPriceMinor: base,
    effectiveUnitPriceMinor: effectiveUnit,
    quantity: line.quantity,
    subtotalMinor: initial,
    modifiersApplied: applied,
    discountBp: lineDiscount,
    finalPriceMinor: running,
    recurrence: line.item.recurrence,
    marginBp,
    warnings,
    trace,
    taxCode: line.item.taxCode ?? "OUT_OF_SCOPE",
    taxRateBp: taxRate,
    taxMinor,
    grossPriceMinor,
    pricingModel: line.item.pricingBasis,
  };
}

export function price(request: PriceRequest): PriceResult {
  const errors = validate(request);
  if (errors.length > 0) return { ok: false, errors };

  if (request.lines.length === 0) {
    return {
      ok: true,
      quote: {
        currency: request.currency,
        ruleSetVersion: request.ruleSet.version,
        lines: [],
        oneOffSubtotalMinor: money.minor(0),
        recurringByFrequency: emptyFrequencyTotals(),
        recurringAnnualisedMinor: money.minor(0),
        quoteDiscountBp: request.quoteDiscountBp ?? money.bp(0),
        marginBp: null,
        warnings: [{ code: "pricing.empty_basket" }],
        taxTotalMinor: money.minor(0),
        grossOneOffTotalMinor: money.minor(0),
        grossRecurringByFrequency: emptyFrequencyTotals(),
      },
    };
  }

  const lineResults = request.lines.map((line) => priceLine(request, line));
  const lineErrors = lineResults.filter((result): result is PriceError => !("finalPriceMinor" in result));
  if (lineErrors.length > 0) return { ok: false, errors: lineErrors };

  const lines = lineResults as PricedLine[];
  const recurringByFrequency = emptyFrequencyTotals();
  const grossRecurringByFrequency = emptyFrequencyTotals();
  let oneOffSubtotal = money.minor(0);
  let grossOneOffTotal = money.minor(0);
  let taxTotal = money.minor(0);
  for (const line of lines) {
    taxTotal = money.add(taxTotal, line.taxMinor);
    if (line.recurrence === "one_off") {
      oneOffSubtotal = money.add(oneOffSubtotal, line.finalPriceMinor);
      grossOneOffTotal = money.add(grossOneOffTotal, line.grossPriceMinor);
    } else {
      recurringByFrequency[line.recurrence] = money.add(
        recurringByFrequency[line.recurrence],
        line.finalPriceMinor,
      );
      grossRecurringByFrequency[line.recurrence] = money.add(grossRecurringByFrequency[line.recurrence], line.grossPriceMinor);
    }
  }

  const warnings = lines.flatMap((line) => line.warnings);
  if (oneOffSubtotal < request.ruleSet.quoteMinimumMinor && oneOffSubtotal > 0) {
    warnings.push({
      code: "pricing.quote_minimum_applied",
      detail: String(oneOffSubtotal),
    });
    grossOneOffTotal = money.add(grossOneOffTotal, money.minor(request.ruleSet.quoteMinimumMinor - oneOffSubtotal));
    oneOffSubtotal = request.ruleSet.quoteMinimumMinor;
  }

  let annualised = money.minor(0);
  for (const frequency of Object.keys(recurringByFrequency) as Frequency[]) {
    annualised = money.add(
      annualised,
      money.multiply(recurringByFrequency[frequency], annualMultipliers[frequency]),
    );
  }

  const margins = lines.map((line) => line.marginBp);
  let marginBp: BasisPoints | null = null;
  if (!margins.some((margin) => margin === null)) {
    const totalPrice = lines.reduce(
      (sum, line) => money.add(sum, line.finalPriceMinor),
      money.minor(0),
    );
    const totalCost = request.lines.reduce((sum, line) => {
      if (line.item.costMinor === undefined) return sum;
      const cost =
        line.item.pricingBasis === "fixed"
          ? line.item.costMinor
          : money.multiply(line.item.costMinor, line.quantity);
      return money.add(sum, cost);
    }, money.minor(0));
    marginBp = totalPrice === 0
      ? money.bp(0)
      : money.bp(Math.round(((totalPrice - totalCost) * 10_000) / totalPrice));
  }
  if (marginBp === null) {
    warnings.push({
      code: "pricing.margin_incomplete",
      detail: lines.filter((line) => line.marginBp === null).map((line) => line.lineId).join(","),
    });
  }

  return {
    ok: true,
    quote: {
      currency: request.currency,
      ruleSetVersion: request.ruleSet.version,
      lines,
      oneOffSubtotalMinor: oneOffSubtotal,
      recurringByFrequency,
      recurringAnnualisedMinor: annualised,
      quoteDiscountBp: request.quoteDiscountBp ?? money.bp(0),
      marginBp,
      warnings,
      taxTotalMinor: taxTotal,
      grossOneOffTotalMinor: grossOneOffTotal,
      grossRecurringByFrequency,
    },
  };
}

function emptyFrequencyTotals(): Record<Frequency, Minor> {
  return {
    one_off: money.minor(0),
    weekly: money.minor(0),
    fortnightly: money.minor(0),
    monthly: money.minor(0),
    quarterly: money.minor(0),
    annually: money.minor(0),
  };
}
