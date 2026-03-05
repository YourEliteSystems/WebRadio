const path = require("path");
const Database = require("better-sqlite3");

const db = new Database(path.join(__dirname, "..", "data", "webradio.db"));

// Tabelle für Favoriten erstellen
db.prepare(`
  CREATE TABLE IF NOT EXISTS favorites (
    id TEXT PRIMARY KEY,
    name TEXT,
    url TEXT,
    country TEXT
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS history (
    id TEXT PRIMARY KEY,
    name TEXT,
    url TEXT,
    country TEXT,
    lastPlayed TEXT
  )
`).run();

module.exports = db;
