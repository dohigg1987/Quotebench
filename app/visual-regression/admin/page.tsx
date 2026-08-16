import { notFound } from "next/navigation";
import OperatorScreen from "../../operator-screen";
import { QuoteBenchMark } from "../../ui/brand";

export const dynamic = "force-dynamic";

export default function PlatformAdminVisualRegressionPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <span className="admin-brand"><QuoteBenchMark /><strong>QuoteBench</strong></span>
        <div><span>Platform administration</span><span>Customer workspace</span></div>
      </header>
      <OperatorScreen />
    </main>
  );
}
