CREATE TABLE `workshop_accounts` (
  `id` text PRIMARY KEY NOT NULL,
  `code_hash` text NOT NULL,
  `name` text NOT NULL,
  `rev` integer NOT NULL,
  `state` text NOT NULL,
  `last_seen` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workshop_accounts_code_hash_idx` ON `workshop_accounts` (`code_hash`);
--> statement-breakpoint
CREATE INDEX `workshop_accounts_last_seen_idx` ON `workshop_accounts` (`last_seen`);
--> statement-breakpoint
CREATE TABLE `workshop_world` (
  `id` integer PRIMARY KEY NOT NULL,
  `rev` integer NOT NULL,
  `state` text NOT NULL
);
