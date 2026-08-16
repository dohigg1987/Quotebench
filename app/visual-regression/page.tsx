import { notFound } from "next/navigation";
import QuoteBench, { type BuilderStep, type Screen } from "../quote-bench";

export const dynamic = "force-dynamic";

/**
 * Local visual QA surface. This route is deliberately unavailable in
 * production so it cannot weaken the application authentication boundary.
 */
const screens = new Set<Screen>(["builder", "quotes", "clients", "catalogue", "rules", "activity", "integrations", "team", "usage", "documents", "delivery", "templates", "billing", "governance", "engagement", "ai"]);
const builderSteps = new Set<BuilderStep>(["client", "services", "proposal", "governance", "review"]);

function PricingLayoutFixture({ recipient = false }: { recipient?: boolean }) {
  const documentClass = recipient ? "recipient-document" : "horizon-client-document";
  const scopeClass = recipient ? "recipient-scope service-schedule-scope" : "document-scope service-schedule-scope";
  const totalsClass = recipient ? "recipient-totals" : "document-totals";
  return (
    <main className="horizon-preview-shell">
      <article className={documentClass} style={{ margin: "0 auto" }}>
        <section className="recipient-page">
          <div className="recipient-content-block">
            <h2>Scope and investment</h2>
            <section className={scopeClass}>
              <div className="proposal-service-line">
                <div><span><strong>Strategy workshop</strong><small>1 day</small></span><strong>£1,450</strong></div>
              </div>
              <div className="proposal-service-line">
                <div><span><strong>Delivery sprint</strong><small>1 sprint</small></span><strong>£6,800</strong></div>
              </div>
            </section>
            <section className={totalsClass}>
              <div><small>ONE-OFF INVESTMENT</small><strong>£8,250</strong></div>
            </section>
          </div>
        </section>
      </article>
    </main>
  );
}

export default async function VisualRegressionPage({ searchParams }: { searchParams: Promise<{ screen?: string; step?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const requested = await searchParams;
  if (requested.screen === "pricing-preview") return <PricingLayoutFixture />;
  if (requested.screen === "pricing-recipient") return <PricingLayoutFixture recipient />;
  const requestedScreen = requested.screen;
  const initialScreen = requestedScreen && screens.has(requestedScreen as Screen) ? requestedScreen as Screen : "builder";
  const initialBuilderStep = requested.step && builderSteps.has(requested.step as BuilderStep) ? requested.step as BuilderStep : "client";
  return <QuoteBench currentUser={null} operatorAccess initialScreen={initialScreen} initialBuilderStep={initialBuilderStep} />;
}
