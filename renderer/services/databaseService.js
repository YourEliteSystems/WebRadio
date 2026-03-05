const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(process.cwd(), "data", "webradio.db");
const db = new Database(dbPath);


// Initialisierung
db.prepare(`
  CREATE TABLE IF NOT EXISTS favorites (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT,
    streamUrl TEXT NOT NULL,
    favicon TEXT
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS history (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT,
    streamUrl TEXT NOT NULL,
    favicon TEXT,
    lastPlayed INTEGER NOT NULL
  )
`).run();


export default db;
