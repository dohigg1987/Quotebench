ALTER TABLE `quotes` ADD `share_token` text;--> statement-breakpoint
ALTER TABLE `quotes` ADD `issued_at` text;--> statement-breakpoint
ALTER TABLE `quotes` ADD `first_viewed_at` text;--> statement-breakpoint
ALTER TABLE `quotes` ADD `accepted_at` text;--> statement-breakpoint
ALTER TABLE `quotes` ADD `accepted_by` text;--> statement-breakpoint
ALTER TABLE `quotes` ADD `acceptance_evidence_json` text;--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_share_token_unique` ON `quotes` (`share_token`);