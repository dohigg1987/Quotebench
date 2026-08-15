# QuoteBench

QuoteBench is a governed pricing and quoting platform for service and product businesses. It occupies the gap between spreadsheet-based judgement and enterprise CPQ: configure the catalogue and pricing rules once, then construct consistent, margin-aware quotes through selection.

## Complete product release

This repository contains the governed vertical slice and its first durable workflow:

- a pure TypeScript pricing engine with zero runtime dependencies
- integer-minor-unit money and integer-basis-point percentages
- fixed, per-unit and cost-plus pricing
- whole-quantity bands and sequenced compounding modifiers
- role-based discount caps, minimum fees, recurrence separation and margin controls
- a responsive quote-building application with explanation traces
- catalogue, pricing governance, activity and client-document views
- ChatGPT identity-aware write boundaries for workspace users
- tenant-scoped D1 quote records, immutable pricing snapshots and lifecycle audit events
- server-side repricing before Draft or Ready records are accepted
- recipient-specific high-entropy links, resend and revocation controls
- scanner suppression, three-second qualified views and section dwell analytics
- recipient-facing responsive proposal documents with print-to-PDF support
- R2-backed attachments, queued PDF generation and expiring downloads
- governed document blocks, multiple brand profiles, colour contrast enforcement and sending-domain status
- four transactionally provisioned launch-industry configurations and resumable onboarding
- typed-name, multiple-option, deposit-aware and offline acceptance with immutable evidence snapshots
- signed webhook endpoints, delivery logs and revocable tenant-scoped read API keys
- stackable lifetime deal entitlements, Stripe Checkout adapter, grace-band metering and owner-only cohort economics
- server-enforced workspace entitlements across quote creation and current usage reporting
- deterministic engine and rendered-application tests
- authenticated multi-workspace tenancy with server-side membership enforcement
- hashed-token and API-key rate limiting, privacy controls and security audit events
- exponential webhook recovery, scheduled retention and full tenant purge across D1 and R2
- deployment security headers, health checks and GitHub CI release gates
- a multi-page proposal studio with reusable templates, flexible page formats and structured content, proof, media, pricing, option, term and acceptance blocks

Provider-backed transactional email and Stripe Checkout activate when their production credentials are supplied. Without them, secure recipient links, delivery governance, all acceptance workflows, metering, exports and the rest of the application remain runnable. The operator dashboard is sign-in gated and requires an authorised email SHA-256 digest in `OPERATOR_EMAIL_SHA256`, while recipient proposals are protected by distinct high-entropy tokens.

Production: https://quotebench-app.doh87.chatgpt.site

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
db/                          D1 schema and tenant-scoped quote store
drizzle/                     generated, reviewable database migration
packages/pricing-engine/     pure pricing domain package
tests/                       engine and rendered-application checks
```

The project constitution is recorded in `CLAUDE.md`. The governing rule is that monetary values displayed to a user or rendered in a document originate from the pricing engine and cannot be manually overwritten.

The implemented enterprise control set, platform boundaries and production release gates are recorded in `docs/enterprise-readiness.md`.

## Deployment boundaries

The repository deliberately excludes the supplied specification packs and fixture files. Runtime configuration and secrets are managed by the deployment platform and must never be committed.
