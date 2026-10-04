import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), username: text("username").notNull(), displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(), passwordSalt: text("password_salt").notNull(),
  role: text("role").notNull().default("consulta"), active: integer("active", { mode: "boolean" }).notNull().default(true),
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_users_username").on(table.username)]);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_sessions_user_id").on(table.userId), index("idx_sessions_expires_at").on(table.expiresAt)]);

export const courts = sqliteTable("courts", {
  id: text("id").primaryKey(), name: text("name").notNull(), color: text("color").notNull().default("#0c6b58"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
}, (table) => [uniqueIndex("idx_courts_name").on(table.name)]);

export const bookingTypes = sqliteTable("booking_types", {
  id: text("id").primaryKey(), name: text("name").notNull(), color: text("color").notNull(), defaultMinutes: integer("default_minutes").notNull().default(60),
  suggestedPrice: real("suggested_price").notNull().default(0), active: integer("active", { mode: "boolean" }).notNull().default(true),
}, (table) => [uniqueIndex("idx_booking_types_name").on(table.name)]);

export const reservations = sqliteTable("reservations", {
  id: text("id").primaryKey(), clientName: text("client_name").notNull(), phone: text("phone").notNull().default(""),
  courtId: text("court_id").notNull().references(() => courts.id), bookingTypeId: text("booking_type_id").notNull().references(() => bookingTypes.id),
  startsAt: text("starts_at").notNull(), endsAt: text("ends_at").notNull(), status: text("status").notNull().default("pendiente"),
  color: text("color").notNull(), notes: text("notes").notNull().default(""), paymentMode: text("payment_mode").notNull().default("por_encuentro"),
  listPrice: real("list_price").notNull().default(0), discountType: text("discount_type").notNull().default("none"), discountValue: real("discount_value").notNull().default(0),
  discountReason: text("discount_reason").notNull().default(""), finalPrice: real("final_price").notNull().default(0),
  responsibleId: text("responsible_id"), seriesId: text("series_id"), source: text("source").notNull().default("app"),
  version: integer("version").notNull().default(1), createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_reservations_court_start").on(table.courtId, table.startsAt), index("idx_reservations_series").on(table.seriesId),
  index("idx_reservations_status").on(table.status), index("idx_reservations_client").on(table.clientName),
]);

export const reservationSlots = sqliteTable("reservation_slots", {
  id: text("id").primaryKey(), reservationId: text("reservation_id").notNull().references(() => reservations.id, { onDelete: "cascade" }),
  courtId: text("court_id").notNull().references(() => courts.id), slotAt: text("slot_at").notNull(),
}, (table) => [uniqueIndex("idx_reservation_slots_court_time").on(table.courtId, table.slotAt), index("idx_reservation_slots_reservation").on(table.reservationId)]);

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(), reservationId: text("reservation_id").references(() => reservations.id, { onDelete: "set null" }),
  seriesId: text("series_id"), period: text("period"), amount: real("amount").notNull(), method: text("method").notNull(),
  paidAt: text("paid_at").notNull(), notes: text("notes").notNull().default(""), createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_payments_paid_at").on(table.paidAt), index("idx_payments_reservation").on(table.reservationId), index("idx_payments_series_period").on(table.seriesId, table.period)]);

export const staff = sqliteTable("staff", {
  id: text("id").primaryKey(), name: text("name").notNull(), phone: text("phone").notNull().default(""), active: integer("active", { mode: "boolean" }).notNull().default(true),
}, (table) => [uniqueIndex("idx_staff_name").on(table.name)]);

export const workLogs = sqliteTable("work_logs", {
  id: text("id").primaryKey(), reservationId: text("reservation_id").references(() => reservations.id, { onDelete: "set null" }),
  staffId: text("staff_id").notNull().references(() => staff.id), startsAt: text("starts_at").notNull(), endsAt: text("ends_at").notNull(),
  functionName: text("function_name").notNull(), notes: text("notes").notNull().default(""), createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_work_logs_staff_start").on(table.staffId, table.startsAt), index("idx_work_logs_reservation").on(table.reservationId)]);

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(), entityType: text("entity_type").notNull(), entityId: text("entity_id").notNull(), action: text("action").notNull(),
  beforeJson: text("before_json"), afterJson: text("after_json"), userId: text("user_id").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_audit_entity").on(table.entityType, table.entityId), index("idx_audit_created_at").on(table.createdAt)]);
