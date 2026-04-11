with open('database/db.js', 'r') as f:
    content = f.read()

old = """    let reconnectDelay = 3000;
    pgPool.on('error', (err) => {
      console.error('PG pool error:', err.message);
      // reconnect تلقائي
      setTimeout(()=>{
        try{
          pgPool.connect().then(c=>c.release()).catch(()=>{
            reconnectDelay *= 2;
            if(reconnectDelay > 30000) reconnectDelay = 30000;
          });
        }catch{}
      }, reconnectDelay);
    });"""

new = """    pgPool.on('error', (err) => {
      console.error('PG pool error:', err.message);
    });
    pgPool.on('connect', () => {
      console.log('✅ PG new connection established');
    });"""

if old in content:
    content = content.replace(old, new)
    with open('database/db.js', 'w') as f:
        f.write(content)
    print("✅ Fixed")
else:
    print("❌ Not found")
