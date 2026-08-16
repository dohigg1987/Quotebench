# Backup and restore procedure

## Objectives

The operator must approve an RPO and RTO before processing live customer data. The initial operating target is an RPO of 24 hours and an RTO of four hours; tighter contractual targets require corresponding monitoring and recovery automation.

## Backup layers

1. Use the hosting platform's supported D1 point-in-time recovery capability for database records.
2. Retain R2 objects under tenant-scoped prefixes and verify object inventory against `stored_files` records.
3. Produce an owner-authorised QuoteBench JSON export after material configuration changes and before destructive migrations.
4. Keep deployment source and generated migrations in the protected repository.

## Restore drill

1. Select a non-production recovery target and record the recovery point.
2. Restore D1 using the platform-supported recovery mechanism.
3. Verify tenant, membership, catalogue, quote, pricing snapshot, recipient, acceptance and audit-record counts.
4. Verify a representative PDF and attachment from each R2 prefix.
5. Run tenant-isolation, pricing-determinism and recipient-link tests.
6. Record actual recovery time, data loss interval, failed checks and corrective actions.
7. Never overwrite production during a drill.

## Release gate

Production use with real customer data requires a successful drill from an independently retained recovery point. A documented procedure without a successful drill is not sufficient evidence.
