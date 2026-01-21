/**
 * Database Schema
 * Table definitions and initialization for SQLite
 */

import type Database from 'better-sqlite3'

/**
 * Initialize database schema
 * Creates all required tables if they don't exist
 */
export function initializeSchema(db: Database.Database): void {
  db.exec(`
    -- Data sources (Zabbix connection info)
    CREATE TABLE IF NOT EXISTS data_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'zabbix',
      url TEXT NOT NULL,
      token TEXT,
      poll_interval INTEGER NOT NULL DEFAULT 30000,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- Topologies
    CREATE TABLE IF NOT EXISTS topologies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      yaml_content TEXT NOT NULL,
      data_source_id TEXT REFERENCES data_sources(id) ON DELETE SET NULL,
      mapping_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- Dashboards
    CREATE TABLE IF NOT EXISTS dashboards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      layout_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- Settings (key-value store)
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Create indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_topologies_data_source ON topologies(data_source_id);
    CREATE INDEX IF NOT EXISTS idx_topologies_name ON topologies(name);
    CREATE INDEX IF NOT EXISTS idx_data_sources_name ON data_sources(name);
  `)
}

/**
 * Run database migrations
 * Handles schema updates for existing databases
 */
export function runMigrations(db: Database.Database): void {
  // Get current schema version
  const versionResult = db.prepare("SELECT value FROM settings WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined
  const currentVersion = versionResult ? Number.parseInt(versionResult.value, 10) : 0

  // Apply migrations
  if (currentVersion < 1) {
    // Initial schema - already created in initializeSchema
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '1')").run()
  }

  // Future migrations can be added here:
  // if (currentVersion < 2) {
  //   db.exec(`ALTER TABLE ...`)
  //   db.prepare("UPDATE settings SET value = '2' WHERE key = 'schema_version'").run()
  // }
}
