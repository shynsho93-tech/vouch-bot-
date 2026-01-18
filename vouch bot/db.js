const Database = require("better-sqlite3");
const db = new Database("vouch.sqlite");

db.exec(`
CREATE TABLE IF NOT EXISTS vouches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  from_user TEXT NOT NULL,
  to_user TEXT NOT NULL,
  type TEXT NOT NULL,
  reason TEXT NOT NULL,
  proof TEXT,
  timestamp INTEGER NOT NULL
);
`);

module.exports = db;
