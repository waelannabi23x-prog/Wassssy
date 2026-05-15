const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "../data");
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
const FILE = path.join(DIR, "bot.db");

let db;

async function initDB() {
  const SQL = await initSqlJs();
  db = fs.existsSync(FILE)
    ? new SQL.Database(fs.readFileSync(FILE))
    : new SQL.Database();

  db.run(`
    CREATE TABLE IF NOT EXISTS subjects (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      icon TEXT NOT NULL DEFAULT '📘'
    );
    CREATE TABLE IF NOT EXISTS lessons (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      sid   INTEGER NOT NULL,
      type  TEXT NOT NULL,
      title TEXT NOT NULL,
      body  TEXT DEFAULT '',
      mtype TEXT DEFAULT 'text',
      fid   TEXT,
      FOREIGN KEY(sid) REFERENCES subjects(id) ON DELETE CASCADE
    );
  `);
  save();
  console.log("✅ DB ready");
}

function save() {
  fs.writeFileSync(FILE, Buffer.from(db.export()));
}

function run(sql, p = []) { db.run(sql, p); save(); }
function get(sql, p = []) {
  const s = db.prepare(sql); s.bind(p);
  const r = s.step() ? s.getAsObject() : null; s.free(); return r;
}
function all(sql, p = []) {
  const s = db.prepare(sql); s.bind(p);
  const r = []; while (s.step()) r.push(s.getAsObject()); s.free(); return r;
}
function lid() { return get("SELECT last_insert_rowid() AS id").id; }

// ── Subjects ──────────────────────────────────────────────────────────────────
const subj = {
  add:    (n, i="📘") => { run("INSERT INTO subjects(name,icon)VALUES(?,?)",[n,i]); return lid(); },
  get:    (id)        => get("SELECT * FROM subjects WHERE id=?",[id]),
  all:    ()          => all("SELECT * FROM subjects ORDER BY name"),
  rename: (id,n)      => run("UPDATE subjects SET name=? WHERE id=?",[n,id]),
  icon:   (id,i)      => run("UPDATE subjects SET icon=? WHERE id=?",[i,id]),
  del:    (id)        => run("DELETE FROM subjects WHERE id=?",[id]),
};

// ── Lessons ───────────────────────────────────────────────────────────────────
const les = {
  add:  (sid,type,title,body,mtype,fid) => {
    run("INSERT INTO lessons(sid,type,title,body,mtype,fid)VALUES(?,?,?,?,?,?)",
        [sid,type,title,body||"",mtype||"text",fid||null]);
    return lid();
  },
  get:    (id)        => get("SELECT * FROM lessons WHERE id=?",[id]),
  list:   (sid,type)  => type
    ? all("SELECT * FROM lessons WHERE sid=? AND type=? ORDER BY rowid DESC",[sid,type])
    : all("SELECT * FROM lessons WHERE sid=? ORDER BY type,rowid DESC",[sid]),
  rename: (id,t)      => run("UPDATE lessons SET title=? WHERE id=?",[t,id]),
  body:   (id,b)      => run("UPDATE lessons SET body=? WHERE id=?",[b,id]),
  del:    (id)        => run("DELETE FROM lessons WHERE id=?",[id]),
  search: (q)         => all(
    `SELECT l.*,s.name sname,s.icon sicon FROM lessons l
     JOIN subjects s ON s.id=l.sid
     WHERE l.title LIKE ? OR l.body LIKE ? LIMIT 20`,
    [`%${q}%`,`%${q}%`]
  ),
  count:  (sid)       => ({
    cours: get("SELECT COUNT(*) n FROM lessons WHERE sid=? AND type='cours'",[sid])?.n||0,
    td:    get("SELECT COUNT(*) n FROM lessons WHERE sid=? AND type='td'",[sid])?.n||0,
    tp:    get("SELECT COUNT(*) n FROM lessons WHERE sid=? AND type='tp'",[sid])?.n||0,
  }),
};

// ── Stats ─────────────────────────────────────────────────────────────────────
const stats = () => ({
  subjects: get("SELECT COUNT(*) n FROM subjects")?.n||0,
  total:    get("SELECT COUNT(*) n FROM lessons")?.n||0,
  cours:    get("SELECT COUNT(*) n FROM lessons WHERE type='cours'")?.n||0,
  td:       get("SELECT COUNT(*) n FROM lessons WHERE type='td'")?.n||0,
  tp:       get("SELECT COUNT(*) n FROM lessons WHERE type='tp'")?.n||0,
  rows: all(`SELECT s.icon,s.name,
    SUM(l.type='cours') cours,SUM(l.type='td') td,SUM(l.type='tp') tp,COUNT(l.id) total
    FROM subjects s LEFT JOIN lessons l ON l.sid=s.id
    GROUP BY s.id ORDER BY total DESC`),
});

module.exports = { initDB, subj, les, stats };
