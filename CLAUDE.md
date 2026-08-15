# QuoteBench constitution

These controls are mandatory for every change.

## Non-negotiables

- **CON-01 Pricing integrity.** Every displayed or rendered price is an output of `packages/pricing-engine`. Documents never accept manual monetary overrides.
- **CON-02 Engine purity.** `packages/pricing-engine` has no runtime dependencies, imports nothing from `app`, and has no clock, network, filesystem or randomness access.
- **CON-03 Tenant isolation.** Every persistent business table carries `tenant_id NOT NULL` and row-level access control from its first migration.
- **CON-04 Money representation.** Currency uses branded integer minor units. Percentages use integer basis points. Floating-point currency values do not cross a boundary.
- **CON-05 Boundary validation.** Validate API inputs, persistence reads, and engine input and output at their boundaries.
- **CON-06 Test-first packages.** Package behaviour is test-first and every test cites the requirement identifiers it proves.
- **CON-07 Dependency discipline.** Do not introduce per-seat or per-user dependencies. Justify every new package.
- **CON-08 Traceability.** Pull requests and tests cite the requirements delivered.
- **CON-09 Deterministic documents.** Stored inputs reproduce the same document without dependence on render time.
- **CON-10 Language.** British English is used throughout. User-facing copy contains no em dashes.

## Conventions

- TypeScript strict, with no `any`.
- Engine failures are typed results, not thrown exceptions.
- Tests are colocated where practical and begin with requirement identifiers.
- Database migrations are forward-only.
- Secrets are supplied through environment variables only.
- Do not push directly to `main` and never force-push.

## Current implementation boundary

The current release is an executable vertical slice: pure pricing engine, governed catalogue and rules, live quote construction, calculation trace, client document preview and representative activity views. Supabase tenancy, email delivery, storage, PDF queueing, tracking ingestion, billing and third-party integrations remain governed roadmap work and must not be represented as operational until implemented and tested.
