# Privacy accountability pack

## Roles

The workspace operator determines why proposal-recipient and client data is processed and is normally the controller. QuoteBench and its hosting or delivery providers act according to the contractual role established by the operator. Each deployment must identify the actual legal entity before live processing.

## Processing record

| Purpose | Data | Subjects | Retention | Safeguards |
|---|---|---|---|---|
| Prepare and issue proposals | names, business email, proposal content, pricing | clients and recipients | customer relationship plus configured retention | tenant isolation, role checks, TLS |
| Record decisions | signatory name, timestamp, user agent, hashed IP and token evidence | proposal signatories | contractual evidence period | immutable proposal snapshot and restricted access |
| Engagement analytics | qualified view and section duration, device hash, coarse location | recipients | 24 months by default, optional | workspace opt-out, export and deletion |
| Service operations | request IDs, security and API events | users and recipients | 30 to 90 days by event type | least privilege and bounded payloads |
| Billing | workspace identifiers and subscription references | customers | statutory and provider requirements | signed provider webhooks and restricted owner access |

## DPIA screening

Engagement tracking and possible-forward detection create monitoring risk. Before enabling these features for live recipients, document lawful basis, necessity, transparency, expected recipient impact, retention, opt-out arrangements and controller approval. Disable engagement tracking where the assessment does not support it.

## Required deployment records

- controller legal name and contact details;
- privacy notice and lawful-basis decision;
- controller-processor agreement and security schedule;
- approved subprocessor list and transfer mechanism;
- retention exceptions and deletion owner;
- incident and rights-request contacts;
- completed restore drill and access review.

## Rights handling

Use the recipient event export and deletion controls for access and erasure requests, preserving contractual acceptance evidence only where a documented legal basis requires it. Record the request, identity verification, scope, decision and completion date outside public issue trackers.
