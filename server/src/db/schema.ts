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
  // Salesforce Ids for lgc-ci scoping: realtor Contact for agents, User for loan officers
  sfContactId: varchar('sf_contact_id', { length: 18 }),
  sfUserId: varchar('sf_user_id', { length: 18 }),
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

// Notes on a borrower, kept in Lead Lens only. Nothing here is written to Salesforce: a
// write there can text the realtor, and the team's own notes in lgc-ci stay internal.
export const notes = pgTable('notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  // The borrower row's Lead or Contact Id (ContactRow.id)
  sfRecordId: varchar('sf_record_id', { length: 18 }).notNull(),
  authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
  // Kept with the note so it still reads right after the author's login is deleted
  authorName: varchar('author_name', { length: 255 }).notNull(),
  authorRole: varchar('author_role', { length: 20 }).notNull(),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('notes_record_idx').on(table.sfRecordId, table.createdAt),
]);

export const sfMetadataCache = pgTable('sf_metadata_cache', {
  objectName: varchar('object_name', { length: 100 }).notNull(),
  fieldName: varchar('field_name', { length: 100 }).notNull(),
  metadata: jsonb('metadata').notNull(),
  cachedAt: timestamp('cached_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.objectName, table.fieldName] }),
]);
