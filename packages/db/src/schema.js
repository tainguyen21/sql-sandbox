"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.llmConfigs = exports.labSessions = exports.seedProfiles = exports.savedSnippets = exports.queryHistory = exports.workspaceTemplates = exports.workspaces = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.workspaces = (0, pg_core_1.pgTable)('workspaces', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    name: (0, pg_core_1.text)('name').notNull(),
    schemaName: (0, pg_core_1.text)('schema_name').unique().notNull(),
    description: (0, pg_core_1.text)('description'),
    templateId: (0, pg_core_1.uuid)('template_id').references(() => exports.workspaceTemplates.id, { onDelete: 'set null' }),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.workspaceTemplates = (0, pg_core_1.pgTable)('workspace_templates', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    name: (0, pg_core_1.text)('name').notNull(),
    schemaSql: (0, pg_core_1.text)('schema_sql').notNull(),
    description: (0, pg_core_1.text)('description'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.queryHistory = (0, pg_core_1.pgTable)('query_history', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    workspaceId: (0, pg_core_1.uuid)('workspace_id')
        .references(() => exports.workspaces.id, { onDelete: 'cascade' })
        .notNull(),
    sql: (0, pg_core_1.text)('sql').notNull(),
    durationMs: (0, pg_core_1.integer)('duration_ms'),
    rowCount: (0, pg_core_1.integer)('row_count'),
    error: (0, pg_core_1.text)('error'),
    executedAt: (0, pg_core_1.timestamp)('executed_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.savedSnippets = (0, pg_core_1.pgTable)('saved_snippets', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    workspaceId: (0, pg_core_1.uuid)('workspace_id')
        .references(() => exports.workspaces.id, { onDelete: 'cascade' })
        .notNull(),
    name: (0, pg_core_1.text)('name').notNull(),
    sql: (0, pg_core_1.text)('sql').notNull(),
    tags: (0, pg_core_1.text)('tags').array(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.seedProfiles = (0, pg_core_1.pgTable)('seed_profiles', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    workspaceId: (0, pg_core_1.uuid)('workspace_id')
        .references(() => exports.workspaces.id, { onDelete: 'cascade' })
        .notNull(),
    name: (0, pg_core_1.text)('name').notNull(),
    config: (0, pg_core_1.jsonb)('config').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.labSessions = (0, pg_core_1.pgTable)('lab_sessions', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    workspaceId: (0, pg_core_1.uuid)('workspace_id')
        .references(() => exports.workspaces.id, { onDelete: 'cascade' })
        .notNull(),
    name: (0, pg_core_1.text)('name'),
    scenarioId: (0, pg_core_1.text)('scenario_id'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.llmConfigs = (0, pg_core_1.pgTable)('llm_configs', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    workspaceId: (0, pg_core_1.uuid)('workspace_id')
        .references(() => exports.workspaces.id, { onDelete: 'cascade' })
        .notNull(),
    provider: (0, pg_core_1.text)('provider').default('openrouter').notNull(),
    model: (0, pg_core_1.text)('model').default('deepseek/deepseek-chat').notNull(),
    apiKeyEncrypted: (0, pg_core_1.text)('api_key_encrypted'),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
});
//# sourceMappingURL=schema.js.map