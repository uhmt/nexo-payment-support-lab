import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
// Each demo is a bounded aggregate, updated atomically with a version check.
export const demoSessions = sqliteTable('demo_sessions', {
  id: text('id').primaryKey(),
  stateJson: text('state_json').notNull(),
  version: integer('version').notNull().default(1),
  csrf: text('csrf').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
