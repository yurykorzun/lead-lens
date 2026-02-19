import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  primaryKey,
  check,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('loan_officer'),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  sfField: varchar('sf_field', { length: 255 }),
  sfValue: varchar('sf_value', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
}, (table) => [
  check('users_role_check', sql`${table.role} IN ('admin', 'loan_officer', 'agent')`),
  check('users_status_check', sql`${table.status} IN ('active', 'disabled')`),
  index('users_role_idx').on(table.role),
  unique('users_email_role_unique').on(table.email, table.role),
]);

export const auditLog = pgTable('audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  sfRecordId: varchar('sf_record_id', { length: 18 }),
  action: varchar('action', { length: 50 }).notNull(),
  beforeJson: jsonb('before_json'),
  afterJson: jsonb('after_json'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  ip: varchar('ip', { length: 45 }),
  userAgent: text('user_agent'),
});

export const sfMetadataCache = pgTable('sf_metadata_cache', {
  objectName: varchar('object_name', { length: 100 }).notNull(),
  fieldName: varchar('field_name', { length: 100 }).notNull(),
  metadata: jsonb('metadata').notNull(),
  cachedAt: timestamp('cached_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.objectName, table.fieldName] }),
]);
