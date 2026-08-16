# Environment promotion

QuoteBench uses four isolated runtime environments. A release is the same immutable commit moving through each environment; it is not rebuilt from a different branch at every stage.

## Environment responsibilities

| Environment | Purpose | Entry gate | Exit evidence |
|---|---|---|---|
| `dev` | Fast integration of the current `main` commit with development Neon data and Cloudflare resources | QuoteBench CI succeeds on `main` | Build, full automated suite, health check, auth-boundary smoke check |
| `test` | Deliberate functional and regression testing against stable test data | Exact commit has a successful `dev` deployment tag | Automated suite plus tester acceptance of the candidate |
| `preprod` | Production rehearsal using production-shaped configuration without production data | Exact commit has a successful `test` deployment tag | Deployment, auth, recipient-link and operational smoke checks |
| `production` | Customer-facing release | Exact commit has a successful `preprod` deployment tag and is contained in `main` | Health and auth smoke checks plus last-known-good tag |

## Isolation rules

Each environment has its own GitHub environment, Cloudflare Worker, Hyperdrive binding, R2 bucket, Queue, Neon branch, Neon Auth service, cookie secret and public URL. No environment reads another environment's database or storage.

## Promotion workflow

1. A green CI run on `main` deploys its exact commit to `dev` automatically.
2. Promote that same full commit SHA to `test` after integration checks.
3. Promote the unchanged SHA to `preprod` for the release rehearsal.
4. Promote the unchanged SHA to `production` after preprod acceptance.

The workflow writes an immutable `deployed-<environment>-<sha>` tag only after deployment and smoke tests succeed. Every environment after `dev` verifies the preceding environment's tag before it can deploy. This prevents test, preprod or production from being bypassed accidentally.

Rollback uses a previously verified commit and follows the same promotion controls unless an incident requires the documented emergency procedure.
