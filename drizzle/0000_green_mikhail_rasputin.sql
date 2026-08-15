CREATE TABLE `quote_events` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`quote_reference` text NOT NULL,
	`actor_email` text NOT NULL,
	`event_type` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `quote_events_tenant_created_idx` ON `quote_events` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`owner_email` text NOT NULL,
	`reference` text NOT NULL,
	`client_name` text NOT NULL,
	`contact_name` text NOT NULL,
	`valid_until` text NOT NULL,
	`status` text NOT NULL,
	`currency` text DEFAULT 'GBP' NOT NULL,
	`one_off_total_minor` integer NOT NULL,
	`recurring_annualised_minor` integer NOT NULL,
	`margin_bp` integer,
	`line_items_json` text NOT NULL,
	`answers_json` text NOT NULL,
	`pricing_snapshot_json` text NOT NULL,
	`rule_set_id` text NOT NULL,
	`rule_set_version` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_tenant_reference_unique` ON `quotes` (`tenant_id`,`reference`);--> statement-breakpoint
CREATE INDEX `quotes_tenant_updated_idx` ON `quotes` (`tenant_id`,`updated_at`);