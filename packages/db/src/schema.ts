import { pgTable, uuid, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';

/** Workspace — each workspace maps to an isolated PostgreSQL schema */
export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  schemaName: text('schema_name').unique().notNull(),
  description: text('description'),
  templateId: uuid('template_id').references(() => workspaceTemplates.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Workspace templates — predefined schemas for quick start */
export const workspaceTemplates = pgTable('workspace_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  schemaSql: text('schema_sql').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Query history — every executed query logged */
export const queryHistory = pgTable('query_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull(),
  sql: text('sql').notNull(),
  durationMs: integer('duration_ms'),
  rowCount: integer('row_count'),
  error: text('error'),
  executedAt: timestamp('executed_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Saved SQL snippets */
export const savedSnippets = pgTable('saved_snippets', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  sql: text('sql').notNull(),
  tags: text('tags').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Seed profiles — saved seeder configurations */
export const seedProfiles = pgTable('seed_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  config: jsonb('config').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Transaction lab sessions */
export const labSessions = pgTable('lab_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name'),
  scenarioId: text('scenario_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/** LLM configurations per workspace */
export const llmConfigs = pgTable('llm_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull(),
  provider: text('provider').default('openrouter').notNull(),
  model: text('model').default('deepseek/deepseek-chat').notNull(),
  apiKeyEncrypted: text('api_key_encrypted'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
