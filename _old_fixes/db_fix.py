with open('database/db.js', 'r') as f:
    content = f.read()

old_all = """async function all(sql, params=[]) {
  const pg = getPg();
  if(pg) {
    const converted = toPgCached(sql);
    try {
      const name = pgPrepared.get(converted);
      const res = name
        ? await pg.query({ name, text: converted, values: params })
        : await pg.query(converted, params);
      return res.rows;
    } catch(e) { console.error('DB all error:', e.message, '| SQL:', converted.substring(0,100)); return []; }
  }
  try {
    const db = getSqlite();
    if(db) return Promise.resolve(db.prepare(sql).all(...params));
    const stmt = sqlJs.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while(stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return Promise.resolve(rows);
  } catch(e) { console.error('DB all error:', e.message); return []; }
}"""

old_run = """async function run(sql, params=[]) {
  const pg = getPg();
  if(pg) {
    const converted = toPgCached(sql);
    try { await pg.query(converted, params); return; }
    catch(e) { console.error('DB run error:', e.message); throw e; }
  }
  try {
    const db = getSqlite();
    if(db) { db.prepare(sql).run(...params); return; }
    sqlJs.run(sql, params);
    scheduleSave();
  } catch(e) { console.error('DB run error:', e.message); throw e; }
}"""

new_all = """async function withRetry(fn, label='query') {
  const MAX = 3;
  for (let i = 0; i < MAX; i++) {
    try { return await fn(); }
    catch (e) {
      const isRetryable = e.message?.includes('timeout') || e.message?.includes('terminated') || e.message?.includes('ECONNRESET');
      if (!isRetryable || i === MAX - 1) throw e;
      const wait = 500 * Math.pow(2, i);
      console.warn(`⚠️ DB ${label} retry ${i+1}/${MAX} in ${wait}ms — ${e.message}`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

async function all(sql, params=[]) {
  const pg = getPg();
  if(pg) {
    const converted = toPgCached(sql);
    return withRetry(async () => {
      const name = pgPrepared.get(converted);
      const res = name
        ? await pg.query({ name, text: converted, values: params })
        : await pg.query(converted, params);
      return res.rows;
    }, 'all').catch(e => {
      console.error('DB all FAILED:', e.message, '| SQL:', converted.substring(0,100));
      return [];
    });
  }
  try {
    const db = getSqlite();
    if(db) return Promise.resolve(db.prepare(sql).all(...params));
    const stmt = sqlJs.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while(stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return Promise.resolve(rows);
  } catch(e) { console.error('DB all error:', e.message); return []; }
}"""

new_run = """async function run(sql, params=[]) {
  const pg = getPg();
  if(pg) {
    const converted = toPgCached(sql);
    return withRetry(async () => {
      await pg.query(converted, params);
    }, 'run').catch(e => {
      console.error('DB run FAILED:', e.message);
      throw e;
    });
  }
  try {
    const db = getSqlite();
    if(db) { db.prepare(sql).run(...params); return; }
    sqlJs.run(sql, params);
    scheduleSave();
  } catch(e) { console.error('DB run error:', e.message); throw e; }
}"""

if old_all in content and old_run in content:
    content = content.replace(old_all, new_all).replace(old_run, new_run)
    with open('database/db.js', 'w') as f:
        f.write(content)
    print("✅ Retry logic added to all() and run()")
else:
    print("❌ Pattern not found")
    if old_all not in content: print("  - all() not matched")
    if old_run not in content: print("  - run() not matched")
