# Pricing engine

The QuoteBench engine is a pure TypeScript package with zero runtime dependencies. It accepts a complete catalogue and rule-set snapshot and returns either a fully priced quote or an aggregated typed error result.

Implemented controls include fixed, per-unit and cost-plus pricing, whole-quantity bands, sequenced compounding modifiers, role-based discount caps, line and quote minimums, recurrence separation, annualisation, presentation rounding, margin warnings and an explanation trace.

The application imports the package directly. It does not calculate price in the interface layer.
