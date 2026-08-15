CREATE TABLE `quote_recipients` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`quote_reference` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`token` text NOT NULL,
	`status` text NOT NULL,
	`delivered_at` text,
	`first_viewed_at` text,
	`revoked_at` text,
	`last_sent_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quote_recipients_token_unique` ON `quote_recipients` (`token`);--> statement-breakpoint
CREATE INDEX `quote_recipients_quote_idx` ON `quote_recipients` (`tenant_id`,`quote_reference`);--> statement-breakpoint
CREATE TABLE `tracking_events` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`quote_reference` text NOT NULL,
	`recipient_id` text,
	`event_type` text NOT NULL,
	`section` text,
	`duration_ms` integer,
	`device_hash` text,
	`coarse_location` text,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tracking_events_quote_created_idx` ON `tracking_events` (`tenant_id`,`quote_reference`,`created_at`);