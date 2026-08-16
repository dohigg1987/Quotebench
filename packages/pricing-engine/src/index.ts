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
export type PricingBasis = "fixed" | "per_unit" | "cost_plus";

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
};

export type WarningCode =
  | "pricing.empty_basket"
  | "pricing.band_miss"
  | "pricing.band_overlap"
  | "pricing.line_minimum_applied"
  | "pricing.quote_minimum_applied"
  | "pricing.margin_incomplete"
  | "pricing.margin_below_floor"
  | "pricing.negative_margin";

export type PriceErrorCode =
  | "pricing.invalid_quantity"
  | "pricing.quantity_out_of_range"
  | "pricing.margin_unachievable"
  | "pricing.unpriceable_item"
  | "pricing.discount_cap_exceeded"
  | "pricing.invalid_discount"
  | "pricing.validation";

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
  }
  return errors;
}

function resolveBase(item: CatalogueItem): Minor | PriceError {
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
    return money.costPlus(item.costMinor, item.targetMarginBp);
  }
  return item.basePriceMinor ?? { code: "pricing.unpriceable_item", detail: item.id };
}

function calculateMargin(finalPrice: Minor, item: CatalogueItem, quantity: number): BasisPoints | null {
  if (item.costMinor === undefined || finalPrice === 0) return null;
  const cost = item.pricingBasis === "fixed" ? item.costMinor : money.multiply(item.costMinor, quantity);
  return money.bp(Math.round(((finalPrice - cost) * 10_000) / finalPrice));
}

function priceLine(request: PriceRequest, line: RequestLine): PricedLine | PriceError {
  const base = resolveBase(line.item);
  if (typeof base !== "number") return { ...base, lineId: line.lineId };

  const warnings: PriceWarning[] = [];
  const trace: TraceStep[] = [];
  const bandResult = resolvedBand(request.ruleSet, line.item, line.quantity);
  const effectiveUnit = bandResult.band?.unitPriceMinor ?? base;
  if (request.ruleSet.quantityBands.some((band) => band.itemId === line.item.id || band.categoryId === line.item.categoryId) && !bandResult.band) {
    warnings.push({ code: "pricing.band_miss", lineId: line.lineId });
  }
  if (bandResult.overlap) {
    warnings.push({ code: "pricing.band_overlap", lineId: line.lineId });
  }

  let running =
    line.item.pricingBasis === "fixed"
      ? effectiveUnit
      : money.multiply(effectiveUnit, line.quantity);
  const initial = running;
  trace.push({ label: "Base and quantity", beforeMinor: money.minor(0), afterMinor: running });

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
      },
    };
  }

  const lineResults = request.lines.map((line) => priceLine(request, line));
  const lineErrors = lineResults.filter((result): result is PriceError => !("finalPriceMinor" in result));
  if (lineErrors.length > 0) return { ok: false, errors: lineErrors };

  const lines = lineResults as PricedLine[];
  const recurringByFrequency = emptyFrequencyTotals();
  let oneOffSubtotal = money.minor(0);
  for (const line of lines) {
    if (line.recurrence === "one_off") {
      oneOffSubtotal = money.add(oneOffSubtotal, line.finalPriceMinor);
    } else {
      recurringByFrequency[line.recurrence] = money.add(
        recurringByFrequency[line.recurrence],
        line.finalPriceMinor,
      );
    }
  }

  const warnings = lines.flatMap((line) => line.warnings);
  if (oneOffSubtotal < request.ruleSet.quoteMinimumMinor && oneOffSubtotal > 0) {
    warnings.push({
      code: "pricing.quote_minimum_applied",
      detail: String(oneOffSubtotal),
    });
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
