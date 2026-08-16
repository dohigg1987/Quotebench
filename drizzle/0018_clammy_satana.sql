CREATE TABLE IF NOT EXISTS `billing_events` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`provider_event_id` text NOT NULL,
	`event_type` text NOT NULL,
	`outcome` text NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `billing_events_provider_unique` ON `billing_events` (`provider_event_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `billing_events_tenant_created_idx` ON `billing_events` (`tenant_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `billing_invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`stripe_customer_id` text,
	`stripe_invoice_id` text NOT NULL,
	`number` text,
	`status` text NOT NULL,
	`currency` text DEFAULT 'gbp' NOT NULL,
	`subtotal_minor` integer DEFAULT 0 NOT NULL,
	`tax_minor` integer DEFAULT 0 NOT NULL,
	`total_minor` integer DEFAULT 0 NOT NULL,
	`amount_paid_minor` integer DEFAULT 0 NOT NULL,
	`amount_due_minor` integer DEFAULT 0 NOT NULL,
	`hosted_invoice_url` text,
	`invoice_pdf_url` text,
	`period_start` text,
	`period_end` text,
	`due_at` text,
	`paid_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `billing_invoices_provider_unique` ON `billing_invoices` (`stripe_invoice_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `billing_invoices_tenant_created_idx` ON `billing_invoices` (`tenant_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `operator_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`body` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `operator_notes_tenant_created_idx` ON `operator_notes` (`tenant_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `platform_admin_events` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text,
	`reason` text NOT NULL,
	`before_json` text DEFAULT '{}' NOT NULL,
	`after_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `platform_admin_events_tenant_created_idx` ON `platform_admin_events` (`tenant_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tenant_entitlement_overrides` (
	`tenant_id` text PRIMARY KEY NOT NULL,
	`plan_name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`reason` text NOT NULL,
	`expires_at` text,
	`updated_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
