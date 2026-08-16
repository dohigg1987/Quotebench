ALTER TABLE `catalogue_items` ADD `cpq_json` text DEFAULT '{}' NOT NULL;
--> statement-breakpoint
ALTER TABLE `quote_recipients` ADD `signer_role` text DEFAULT 'signatory' NOT NULL;
--> statement-breakpoint
ALTER TABLE `quote_recipients` ADD `signing_order` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `quote_recipients` ADD `signature_required` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `quote_recipients` ADD `signed_at` text;
--> statement-breakpoint
ALTER TABLE `quote_recipients` ADD `accepted_name` text;
--> statement-breakpoint
ALTER TABLE `quote_recipients` ADD `signature_evidence_json` text;
--> statement-breakpoint
ALTER TABLE `quote_recipients` ADD `expires_at` text;
--> statement-breakpoint
ALTER TABLE `quote_recipients` ADD `reminder_interval_days` integer DEFAULT 3 NOT NULL;
--> statement-breakpoint
ALTER TABLE `quote_recipients` ADD `next_reminder_at` text;
--> statement-breakpoint
ALTER TABLE `quote_recipients` ADD `reminder_count` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE `engagement_content` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`content_group_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`jurisdiction` text DEFAULT 'England and Wales' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`content` text NOT NULL,
	`mandatory` integer DEFAULT false NOT NULL,
	`proposal_type_ids_json` text DEFAULT '[]' NOT NULL,
	`effective_from` text,
	`checksum` text,
	`created_by` text NOT NULL,
	`published_by` text,
	`published_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `engagement_content_group_version_unique` ON `engagement_content` (`tenant_id`,`content_group_id`,`version`);
--> statement-breakpoint
CREATE INDEX `engagement_content_tenant_status_idx` ON `engagement_content` (`tenant_id`,`status`,`kind`);
--> statement-breakpoint
CREATE TABLE `ai_provider_configs` (
	`tenant_id` text PRIMARY KEY NOT NULL,
	`provider_name` text NOT NULL,
	`endpoint_url` text NOT NULL,
	`model` text NOT NULL,
	`credential_ciphertext` text,
	`enabled_features_json` text DEFAULT '[]' NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
