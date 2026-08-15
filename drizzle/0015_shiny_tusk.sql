CREATE TABLE `metered_events` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`metric` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`source_id` text NOT NULL,
	`occurred_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `metered_events_tenant_metric_source_unique` ON `metered_events` (`tenant_id`,`metric`,`source_id`);--> statement-breakpoint
CREATE INDEX `metered_events_tenant_time_idx` ON `metered_events` (`tenant_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`bucket_key` text PRIMARY KEY NOT NULL,
	`window_started_at` text NOT NULL,
	`count` integer NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `security_events` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text,
	`actor_email` text,
	`event_type` text NOT NULL,
	`resource_type` text,
	`resource_id` text,
	`outcome` text NOT NULL,
	`details_json` text DEFAULT '{}' NOT NULL,
	`request_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `security_events_tenant_created_idx` ON `security_events` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`currency` text NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`tracking_enabled` integer DEFAULT true NOT NULL,
	`deleted_at` text,
	`purge_after` text,
	`billing_anniversary_day` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
