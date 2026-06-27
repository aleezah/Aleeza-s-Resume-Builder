const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

const DB_PATH = path.join(__dirname, '..', 'data.db')
let db

function getDb() {
  if (!db) db = new Database(DB_PATH)
  return db
}

function initDb() {
  const db = getDb()
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS profile_basics (
      profile_id   TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
      full_name    TEXT,
      email        TEXT,
      phone        TEXT,
      location     TEXT,
      linkedin_url TEXT,
      github_url   TEXT,
      gitlab_url   TEXT,
      website      TEXT,
      summary      TEXT,
      updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS documents (
      id            TEXT PRIMARY KEY,
      profile_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      type          TEXT NOT NULL CHECK(type IN ('resume','cover_letter','template')),
      label         TEXT,
      original_name TEXT NOT NULL,
      file_path     TEXT NOT NULL,
      raw_text      TEXT,
      is_template   INTEGER NOT NULL DEFAULT 0,
      created_at    INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS experiences (
      id           TEXT PRIMARY KEY,
      profile_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      company      TEXT NOT NULL,
      title        TEXT NOT NULL,
      location     TEXT,
      start_date   TEXT,
      end_date     TEXT,
      is_current   INTEGER NOT NULL DEFAULT 0,
      description  TEXT,
      achievements TEXT,
      source       TEXT NOT NULL DEFAULT 'manual',
      created_at   INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS education (
      id          TEXT PRIMARY KEY,
      profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      institution TEXT NOT NULL,
      degree      TEXT,
      field       TEXT,
      start_date  TEXT,
      end_date    TEXT,
      gpa         TEXT,
      notes       TEXT,
      source      TEXT NOT NULL DEFAULT 'manual',
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS skills (
      id         TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      category   TEXT,
      source     TEXT NOT NULL DEFAULT 'manual',
      UNIQUE(profile_id, name)
    );

    CREATE TABLE IF NOT EXISTS certifications (
      id           TEXT PRIMARY KEY,
      profile_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      name         TEXT NOT NULL,
      issuer       TEXT,
      issued_date  TEXT,
      expiry_date  TEXT,
      url          TEXT,
      source       TEXT NOT NULL DEFAULT 'manual',
      created_at   INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS projects (
      id          TEXT PRIMARY KEY,
      profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      description TEXT,
      url         TEXT,
      tech_stack  TEXT,
      start_date  TEXT,
      end_date    TEXT,
      source      TEXT NOT NULL DEFAULT 'manual',
      external_id TEXT,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS job_descriptions (
      id         TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      company    TEXT,
      title      TEXT,
      url        TEXT,
      raw_text   TEXT NOT NULL,
      notes      TEXT,
      status     TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','applied','interview','offer','rejected','closed')),
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS generations (
      id               TEXT PRIMARY KEY,
      job_id           TEXT REFERENCES job_descriptions(id) ON DELETE SET NULL,
      profile_id       TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      resume_md        TEXT,
      cover_letter_md  TEXT,
      resume_latex     TEXT,
      ai_provider      TEXT,
      prompt_tokens    INTEGER,
      completion_tokens INTEGER,
      created_at       INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `)

  // Seed a default profile if none exist
  const count = db.prepare('SELECT COUNT(*) as c FROM profiles').get()
  if (count.c === 0) {
    const { v4: uuidv4 } = require('uuid')
    const id = uuidv4()
    db.prepare('INSERT INTO profiles (id, name) VALUES (?, ?)').run(id, 'My Profile')
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('current_profile_id', ?)").run(id)
  }

  console.log('Database initialised at', DB_PATH)
  return db
}

module.exports = { getDb, initDb }
