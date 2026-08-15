# QuoteBench

QuoteBench is a governed pricing and quoting platform for service and product businesses. It occupies the gap between spreadsheet-based judgement and enterprise CPQ: configure the catalogue and pricing rules once, then construct consistent, margin-aware quotes through selection.

## Current release

This public repository contains the first executable vertical slice:

- a pure TypeScript pricing engine with zero runtime dependencies
- integer-minor-unit money and integer-basis-point percentages
- fixed, per-unit and cost-plus pricing
- whole-quantity bands and sequenced compounding modifiers
- role-based discount caps, minimum fees, recurrence separation and margin controls
- a responsive quote-building application with explanation traces
- catalogue, pricing governance, activity and client-document views
- requirement-citing engine and rendered-application tests

The underlying specification packs and detailed fixture files are intentionally excluded from this public repository. External services also remain out of scope for this release. Authentication, tenant persistence, delivery, tracking ingestion, PDF queues, storage, billing and integrations are not simulated as operational services.

## Run locally

Requirements: Node.js 22.13 or later.

```bash
npm ci
npm run dev
```

Run the deterministic engine suite:

```bash
npm run test:engine
```

Run all application and artifact checks:

```bash
npm test
```

## Architecture

```text
app/                         Vinext and Next.js application
packages/pricing-engine/     pure pricing domain package
tests/                       engine and rendered-application checks
```

The project constitution is recorded in `CLAUDE.md`. Its governing rule is that monetary values displayed to a user or rendered in a document originate from the pricing engine and cannot be manually overwritten.

## Delivery roadmap

The current release establishes the controlled baseline and core product loop. Subsequent pull requests should progress through tenancy and persistence, delivery and tracking, document generation, acceptance, monetisation and integration layers, with each change citing the delivered requirement identifiers.
