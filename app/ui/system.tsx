import type { ReactNode } from "react";

export type WorkflowStep<T extends string> = {
  id: T;
  label: string;
  description: string;
  complete?: boolean;
};

export function WorkflowSteps<T extends string>({
  steps,
  current,
  onChange,
}: {
  steps: WorkflowStep<T>[];
  current: T;
  onChange: (step: T) => void;
}) {
  const currentIndex = steps.findIndex((step) => step.id === current);
  return (
    <nav className="quote-workflow" aria-label="Quote workflow">
      {steps.map((step, index) => {
        const state = step.id === current ? "active" : step.complete || index < currentIndex ? "complete" : "";
        return (
          <button key={step.id} className={state} aria-current={step.id === current ? "step" : undefined} onClick={() => onChange(step.id)}>
            <span>{step.complete || index < currentIndex ? "✓" : index + 1}</span>
            <span><strong>{step.label}</strong><small>{step.description}</small></span>
          </button>
        );
      })}
    </nav>
  );
}

export function GovernanceCheck({
  title,
  description,
  status,
  children,
}: {
  title: string;
  description: string;
  status: "Ready" | "Review";
  children?: ReactNode;
}) {
  return (
    <article className="governance-check">
      <span className={`governance-check-icon ${status === "Ready" ? "ready" : ""}`}>{status === "Ready" ? "✓" : "!"}</span>
      <div><strong>{title}</strong><p>{description}</p>{children}</div>
      <span className={`control-status ${status === "Ready" ? "ready" : "attention"}`}>{status}</span>
    </article>
  );
}
