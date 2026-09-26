CREATE TABLE `demo_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`state_json` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`csrf` text NOT NULL,
	`updated_at` integer NOT NULL
);
