import Database from 'better-sqlite3';
import config from '../config';

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  _db = new Database(config.dbPath);

  // Enable WAL mode for better concurrent read performance
  _db.pragma('journal_mode = WAL');

  // Enforce foreign key constraints
  _db.pragma('foreign_keys = ON');

  console.log(`✓ Database connected: ${config.dbPath}`);

  return _db;
}

const db: Database.Database = getDb();

export default db;
