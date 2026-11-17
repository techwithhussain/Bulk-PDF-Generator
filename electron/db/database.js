const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')
const { app } = require('electron')

let db = null

function getDbPath() {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'studio.db')
}

function getDb() {
  if (!db) throw new Error('Database not initialized')
  return db
}

async function initDatabase() {
  const dbPath = getDbPath()
  const dbDir = path.dirname(dbPath)
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  db = new Database(dbPath, { verbose: null })

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')

  runMigrations(db)
  console.log('[DB] Database initialized at:', dbPath)
  return db
}

function runMigrations(db) {
  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `)

  const migrations = [
    { version: 1, sql: migration_001 },
    { version: 2, sql: migration_002 },
  ]

  const applied = db.prepare('SELECT version FROM schema_migrations').all().map(r => r.version)

  for (const migration of migrations) {
    if (!applied.includes(migration.version)) {
      console.log(`[DB] Running migration v${migration.version}`)
      db.exec(migration.sql)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
        .run(migration.version, new Date().toISOString())
    }
  }
}

const migration_001 = `
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mode TEXT NOT NULL CHECK(mode IN ('identical', 'personalized')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    settings_json TEXT NOT NULL DEFAULT '{}',
    last_batch_status TEXT,
    last_batch_at TEXT
  );

  CREATE TABLE IF NOT EXISTS source_revisions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    content_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT 'autosave',
    description TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_revisions_project ON source_revisions(project_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS datasets (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT,
    columns_json TEXT NOT NULL DEFAULT '[]',
    row_count INTEGER NOT NULL DEFAULT 0,
    sheet_name TEXT,
    header_row INTEGER NOT NULL DEFAULT 0,
    delimiter TEXT,
    encoding TEXT DEFAULT 'UTF-8',
    imported_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS dataset_rows (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    row_index INTEGER NOT NULL,
    data_json TEXT NOT NULL,
    is_excluded INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_dataset_rows ON dataset_rows(dataset_id, row_index);

  CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    dataset_id TEXT REFERENCES datasets(id),
    mode TEXT NOT NULL CHECK(mode IN ('identical', 'personalized')),
    quantity INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','done','failed','canceled')),
    source_revision_id TEXT REFERENCES source_revisions(id),
    settings_json TEXT NOT NULL DEFAULT '{}',
    filename_pattern TEXT NOT NULL DEFAULT 'Document_{number}.pdf',
    placeholder_map_json TEXT,
    created_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    total_count INTEGER NOT NULL DEFAULT 0,
    done_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    canceled_count INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_batches_project ON batches(project_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS pdf_items (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    item_index INTEGER NOT NULL,
    filename TEXT NOT NULL,
    file_path TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','done','failed','canceled')),
    page_count INTEGER,
    source_revision_id TEXT REFERENCES source_revisions(id),
    row_data_json TEXT,
    row_index INTEGER,
    error_message TEXT,
    generated_at TEXT,
    exported_at TEXT,
    export_path TEXT,
    is_outdated INTEGER NOT NULL DEFAULT 0,
    is_customized INTEGER NOT NULL DEFAULT 0,
    custom_content_json TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_items_batch ON pdf_items(batch_id, item_index);
  CREATE INDEX IF NOT EXISTS idx_items_project ON pdf_items(project_id, generated_at DESC);

  CREATE TABLE IF NOT EXISTS replace_events (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    find_text TEXT NOT NULL,
    replace_text TEXT NOT NULL,
    scope TEXT NOT NULL,
    match_count INTEGER NOT NULL DEFAULT 0,
    affected_pdfs INTEGER NOT NULL DEFAULT 0,
    before_revision_id TEXT REFERENCES source_revisions(id),
    after_revision_id TEXT REFERENCES source_revisions(id),
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES
    ('default_export_folder', '', datetime('now')),
    ('default_page_size', 'A4', datetime('now')),
    ('default_orientation', 'portrait', datetime('now')),
    ('default_margin_top', '20', datetime('now')),
    ('default_margin_right', '20', datetime('now')),
    ('default_margin_bottom', '20', datetime('now')),
    ('default_margin_left', '20', datetime('now')),
    ('default_font_family', 'Arial', datetime('now')),
    ('autosave_interval', '3000', datetime('now')),
    ('low_memory_mode', '0', datetime('now')),
    ('max_concurrent_workers', '2', datetime('now'));
`

const migration_002 = `
  CREATE TABLE IF NOT EXISTS global_airlines (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_global_airlines_order ON global_airlines(sort_order);
`

module.exports = { initDatabase, getDb, getDbPath }

