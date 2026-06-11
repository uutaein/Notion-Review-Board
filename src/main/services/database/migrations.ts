import type Database from 'better-sqlite3'

interface Migration {
  version: number
  up: string
}

const migrations: Migration[] = [
  {
    version: 1,
    up: `
      CREATE TABLE review_sources (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        notion_target_id TEXT NOT NULL UNIQUE,
        notion_target_url TEXT,
        notion_target_type TEXT NOT NULL CHECK (notion_target_type IN ('database', 'data_source', 'unknown')),
        enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
        collection_mode TEXT NOT NULL CHECK (collection_mode IN ('tag', 'checkbox', 'all')),
        title_property_name TEXT NOT NULL,
        url_property_name TEXT,
        category_property_name TEXT,
        tag_property_name TEXT,
        source_property_name TEXT,
        review_checkbox_property_name TEXT,
        filter_property_name TEXT,
        filter_operator TEXT CHECK (filter_operator IN ('equals', 'contains', 'checked') OR filter_operator IS NULL),
        filter_value TEXT,
        last_synced_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE review_items (
        id TEXT PRIMARY KEY,
        notion_page_id TEXT NOT NULL UNIQUE,
        notion_url TEXT NOT NULL,
        title TEXT NOT NULL,
        primary_source_id TEXT NOT NULL REFERENCES review_sources(id),
        source_ids_json TEXT NOT NULL,
        due_at TEXT NOT NULL,
        fsrs_state_json TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active', 'changed', 'missing', 'deleted', 'sync_error', 'archived')),
        category TEXT,
        tags_json TEXT NOT NULL,
        origin_label TEXT,
        last_reviewed_at TEXT,
        notion_last_edited_at TEXT,
        last_synced_at TEXT,
        missing_detected_at TEXT,
        deleted_detected_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE review_logs (
        id TEXT PRIMARY KEY,
        review_item_id TEXT NOT NULL REFERENCES review_items(id),
        rating TEXT NOT NULL CHECK (rating IN ('again', 'hard', 'good', 'easy')),
        reviewed_at TEXT NOT NULL,
        previous_due_at TEXT NOT NULL,
        next_due_at TEXT NOT NULL,
        previous_fsrs_state_json TEXT NOT NULL,
        next_fsrs_state_json TEXT NOT NULL,
        source_id TEXT REFERENCES review_sources(id),
        category TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE sync_events (
        id TEXT PRIMARY KEY,
        source_id TEXT REFERENCES review_sources(id),
        review_item_id TEXT REFERENCES review_items(id),
        event_type TEXT NOT NULL CHECK (event_type IN (
          'created', 'updated', 'changed_detected', 'missing_detected',
          'deleted_detected', 'sync_error', 'reviewed', 'user_action'
        )),
        severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error')),
        message TEXT NOT NULL,
        technical_message TEXT,
        occurred_at TEXT NOT NULL
      );

      CREATE INDEX idx_review_items_due_at ON review_items(status, due_at);
      CREATE INDEX idx_review_logs_item_reviewed_at ON review_logs(review_item_id, reviewed_at DESC);
      CREATE INDEX idx_sync_events_occurred_at ON sync_events(occurred_at DESC);
      CREATE INDEX idx_sync_events_source_id ON sync_events(source_id);
    `
  },
  {
    version: 2,
    up: `
      ALTER TABLE review_sources ADD COLUMN last_edited_property_name TEXT;
    `
  }
]

export function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `)

  const appliedVersions = new Set(
    database
      .prepare('SELECT version FROM schema_migrations')
      .all()
      .map((row) => (row as { version: number }).version)
  )
  const applyMigration = database.transaction((migration: Migration) => {
    database.exec(migration.up)
    database
      .prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
      .run(migration.version, new Date().toISOString())
  })

  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      applyMigration(migration)
    }
  }
}
