export const PLAN_LIMITS = {
  Trial: { clients: 5, seats: 2, quotes: 10, pdfs: 10, emails: 50, storage: 100_000_000 },
  Starter: { clients: 25, seats: 2, quotes: 20, pdfs: 20, emails: 100, storage: 250_000_000 },
  Professional: { clients: 250, seats: 5, quotes: 100, pdfs: 100, emails: 1_000, storage: 2_000_000_000 },
  Scale: { clients: 2_500, seats: 20, quotes: 500, pdfs: 500, emails: 10_000, storage: 10_000_000_000 },
} as const;

export type PlanName = keyof typeof PLAN_LIMITS;
export type UsageMetricKey = keyof (typeof PLAN_LIMITS)[PlanName];

export const PLAN_MONTHLY_PRICE_MINOR: Record<PlanName, number> = {
  Trial: 0,
  Starter: 4_900,
  Professional: 14_900,
  Scale: 39_900,
};

export function isPlanName(value: unknown): value is PlanName {
  return typeof value === "string" && value in PLAN_LIMITS;
}

export function planRank(plan: PlanName | null) {
  return plan === "Scale" ? 4 : plan === "Professional" ? 3 : plan === "Starter" ? 2 : plan === "Trial" ? 1 : 0;
}

export function mostGenerousPlan(...plans: Array<PlanName | null | undefined>): PlanName {
  return plans.filter((plan): plan is PlanName => Boolean(plan)).sort((a, b) => planRank(b) - planRank(a))[0] ?? "Trial";
}
