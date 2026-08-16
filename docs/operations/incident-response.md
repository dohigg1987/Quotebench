# Incident response

## Severity

- SEV-1: confirmed or credible tenant-isolation failure, credential disclosure, acceptance-evidence corruption, destructive data loss or widespread outage.
- SEV-2: material feature outage, delayed proposal delivery, payment-state failure or security control degradation without confirmed disclosure.
- SEV-3: contained defect with a workaround and no material confidentiality, integrity or availability impact.

## Response lifecycle

1. Detect and record the time, reporter, affected surface and initial evidence.
2. Triage severity, scope and whether personal data may be involved.
3. Contain access, traffic or integrations without destroying evidence.
4. Eradicate the root cause and rotate affected secrets.
5. Recover from a verified release and validate tenant boundaries, pricing and recipient decisions.
6. Notify workspace operators, processors, regulators and individuals where the documented legal assessment requires it.
7. Complete a blameless review within five business days for SEV-1 and SEV-2 incidents.

## Evidence handling

Use request identifiers and hashed recipient tokens. Restrict access to logs containing email addresses, proposal metadata or IP-derived evidence. Record who accessed or exported incident evidence. Keep public issue content free of customer data.

## Review outputs

The review records timeline, impact, detection gap, root cause, contributing controls, recovery evidence, customer communication, owners and due dates. A corrective action is not closed until its automated or procedural control is demonstrated.
