CREATE TABLE `pricing_rule_sets` (
	`tenant_id` text NOT NULL,
	`id` text NOT NULL,
	`version` integer NOT NULL,
	`status` text NOT NULL,
	`rule_json` text NOT NULL,
	`updated_by` text NOT NULL,
	`published_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pricing_rule_sets_tenant_version_unique` ON `pricing_rule_sets` (`tenant_id`,`id`,`version`);--> statement-breakpoint
CREATE INDEX `pricing_rule_sets_tenant_status_idx` ON `pricing_rule_sets` (`tenant_id`,`status`);