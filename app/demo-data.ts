import {
  money,
  type CatalogueItem,
  type RuleSet,
} from "../packages/pricing-engine/src/index";

export const catalogue: CatalogueItem[] = [
  {
    id: "strategy-workshop",
    categoryId: "advisory",
    name: "Strategy workshop",
    unitLabel: "day",
    pricingBasis: "per_unit",
    basePriceMinor: money.minor(145_000),
    costMinor: money.minor(72_500),
    recurrence: "one_off",
    minQuantity: 1,
    maxQuantity: 12,
  },
  {
    id: "delivery-sprint",
    categoryId: "delivery",
    name: "Delivery sprint",
    unitLabel: "sprint",
    pricingBasis: "per_unit",
    basePriceMinor: money.minor(680_000),
    costMinor: money.minor(392_000),
    recurrence: "one_off",
    minQuantity: 1,
    maxQuantity: 8,
  },
  {
    id: "advisory-retainer",
    categoryId: "advisory",
    name: "Advisory retainer",
    unitLabel: "month",
    pricingBasis: "fixed",
    basePriceMinor: money.minor(425_000),
    costMinor: money.minor(210_000),
    recurrence: "monthly",
    minQuantity: 1,
    maxQuantity: 1,
  },
  {
    id: "platform-licence",
    categoryId: "technology",
    name: "Platform licence",
    unitLabel: "user",
    pricingBasis: "cost_plus",
    costMinor: money.minor(4_800),
    targetMarginBp: money.bp(4_000),
    recurrence: "monthly",
    minQuantity: 5,
    maxQuantity: 500,
  },
];

export const defaultRuleSet: RuleSet = {
  id: "consulting-2026",
  version: 7,
  roundingIncrementMinor: money.minor(500),
  quoteMinimumMinor: money.minor(250_000),
  marginFloorBp: money.bp(3_500),
  discountCaps: {
    owner: money.bp(2_000),
    admin: money.bp(1_500),
    quoter: money.bp(1_000),
  },
  quantityBands: [
    {
      id: "workshop-3-plus",
      itemId: "strategy-workshop",
      fromQuantity: 3,
      toQuantity: 5,
      unitPriceMinor: money.minor(132_500),
      priority: 10,
    },
    {
      id: "workshop-6-plus",
      itemId: "strategy-workshop",
      fromQuantity: 6,
      unitPriceMinor: money.minor(120_000),
      priority: 10,
    },
    {
      id: "licence-25-plus",
      itemId: "platform-licence",
      fromQuantity: 25,
      toQuantity: 99,
      unitPriceMinor: money.minor(7_500),
      priority: 10,
    },
    {
      id: "licence-100-plus",
      itemId: "platform-licence",
      fromQuantity: 100,
      unitPriceMinor: money.minor(6_800),
      priority: 10,
    },
  ],
  modifiers: [
    {
      id: "complexity-high",
      name: "High complexity",
      scope: "all",
      triggerQuestionId: "complexity",
      triggerValue: "high",
      adjustmentKind: "percentage",
      adjustmentValue: 2_000,
      sequence: 10,
    },
    {
      id: "turnaround-priority",
      name: "Priority turnaround",
      scope: "all",
      triggerQuestionId: "turnaround",
      triggerValue: "priority",
      adjustmentKind: "percentage",
      adjustmentValue: 1_500,
      sequence: 20,
    },
  ],
  minimumFees: [
    {
      itemId: "strategy-workshop",
      minimumMinor: money.minor(125_000),
    },
    {
      categoryId: "technology",
      minimumMinor: money.minor(50_000),
    },
  ],
  questions: [
    {
      id: "complexity",
      prompt: "Delivery complexity",
      helpText: "Reflects stakeholder and implementation complexity.",
      inputKind: "single_choice",
      required: true,
      options: [
        { value: "standard", label: "Standard", helpText: "No adjustment" },
        { value: "high", label: "High", helpText: "+20%" },
      ],
    },
    {
      id: "turnaround",
      prompt: "Turnaround",
      helpText: "Priority mobilisation compounds after complexity.",
      inputKind: "single_choice",
      required: true,
      options: [
        { value: "standard", label: "Standard", helpText: "No adjustment" },
        { value: "priority", label: "Priority", helpText: "+15%" },
      ],
    },
  ],
};

export const seedQuotes = [
  { reference: "QB-1048", client: "Northstar Analytics", status: "Viewed", value: "£18,940", activity: "18 minutes ago" },
  { reference: "QB-1047", client: "Aperture Health", status: "Sent", value: "£12,500", activity: "Yesterday" },
  { reference: "QB-1046", client: "Meridian Works", status: "Accepted", value: "£31,680", activity: "12 Aug 2026" },
  { reference: "QB-1045", client: "Common Ground Studio", status: "Draft", value: "£8,750", activity: "11 Aug 2026" },
];
