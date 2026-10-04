CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_entity` ON `audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_created_at` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `booking_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`default_minutes` integer DEFAULT 60 NOT NULL,
	`suggested_price` real DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_booking_types_name` ON `booking_types` (`name`);--> statement-breakpoint
CREATE TABLE `courts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#0c6b58' NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_courts_name` ON `courts` (`name`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`reservation_id` text,
	`series_id` text,
	`period` text,
	`amount` real NOT NULL,
	`method` text NOT NULL,
	`paid_at` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`reservation_id`) REFERENCES `reservations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_payments_paid_at` ON `payments` (`paid_at`);--> statement-breakpoint
CREATE INDEX `idx_payments_reservation` ON `payments` (`reservation_id`);--> statement-breakpoint
CREATE INDEX `idx_payments_series_period` ON `payments` (`series_id`,`period`);--> statement-breakpoint
CREATE TABLE `reservation_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`reservation_id` text NOT NULL,
	`court_id` text NOT NULL,
	`slot_at` text NOT NULL,
	FOREIGN KEY (`reservation_id`) REFERENCES `reservations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`court_id`) REFERENCES `courts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_reservation_slots_court_time` ON `reservation_slots` (`court_id`,`slot_at`);--> statement-breakpoint
CREATE INDEX `idx_reservation_slots_reservation` ON `reservation_slots` (`reservation_id`);--> statement-breakpoint
CREATE TABLE `reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`client_name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`court_id` text NOT NULL,
	`booking_type_id` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`status` text DEFAULT 'pendiente' NOT NULL,
	`color` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`payment_mode` text DEFAULT 'por_encuentro' NOT NULL,
	`list_price` real DEFAULT 0 NOT NULL,
	`discount_type` text DEFAULT 'none' NOT NULL,
	`discount_value` real DEFAULT 0 NOT NULL,
	`discount_reason` text DEFAULT '' NOT NULL,
	`final_price` real DEFAULT 0 NOT NULL,
	`responsible_id` text,
	`series_id` text,
	`source` text DEFAULT 'app' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`court_id`) REFERENCES `courts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`booking_type_id`) REFERENCES `booking_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_reservations_court_start` ON `reservations` (`court_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `idx_reservations_series` ON `reservations` (`series_id`);--> statement-breakpoint
CREATE INDEX `idx_reservations_status` ON `reservations` (`status`);--> statement-breakpoint
CREATE INDEX `idx_reservations_client` ON `reservations` (`client_name`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_user_id` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_expires_at` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `staff` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_staff_name` ON `staff` (`name`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`role` text DEFAULT 'consulta' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`must_change_password` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_username` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `work_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`reservation_id` text,
	`staff_id` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`function_name` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`reservation_id`) REFERENCES `reservations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_work_logs_staff_start` ON `work_logs` (`staff_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `idx_work_logs_reservation` ON `work_logs` (`reservation_id`);
--> statement-breakpoint
PRAGMA optimize;
