'use strict';
const { run, all } = require('../database/db');

const STATE_TTL_HOURS = 24; // يمسح الحالات القديمة بعد 24 ساعة
const MAX_RAM_STATES = 1000; // حماية الرام من التعب (LRU Cache)

// ربط الـ Map القديم ليكون هو الكاش تاعنا
if (!global.userStates) global.userStates = new Map();

async function initPersistentStates() {
  try {
    // إنشاء الجدول لو مش موجود
    await run(`CREATE TABLE IF NOT EXISTS bot_states (
      uid INTEGER PRIMARY KEY,
      state TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // 1. تحميل الحالات المحفوظة من الداتابيز إلى الرام عند تشغيل البوت
    const rows = await all("SELECT uid, state FROM bot_states WHERE updated_at > NOW() - INTERVAL '" + STATE_TTL_HOURS + " hours'");
    for (const row of rows) {
      try {
        global.userStates.set(row.uid, JSON.parse(row.state));
      } catch (e) {}
    }

    // 2. مسح الحالات المنتهية صلاحيتها من الداتابيز في الخلفية
    run("DELETE FROM bot_states WHERE updated_at <= NOW() - INTERVAL '" + STATE_TTL_HOURS + " hours'").catch(() => {});

    console.log(`[StateMgr] ✅ Loaded ${rows.length} states into RAM. DB persistence active.`);
  } catch (e) {
    console.log("[StateMgr] ⚠️ DB states failed, using RAM only.");
  }
}

// إعادة كتابة دالة الحفظ (Fire-and-Forget) عشان ما نضطر نغير async في كل ملفات البوت
const originalSetState = global.setState;
global.setState = function(uid, stateObj) {
  // حماية الرام: إذا زادت عن 1000، يحذف أول واحد
  if (global.userStates.size >= MAX_RAM_STATES) {
    const firstKey = global.userStates.keys().next().value;
    global.userStates.delete(firstKey);
  }
  
  // حفظ في الرام (فوري)
  global.userStates.set(uid, stateObj);
  
  // حفظ في الداتابيز (في الخلفية بدون ما يوقف الكود)
  run("INSERT INTO bot_states (uid, state) VALUES ($1, $2) ON CONFLICT(uid) DO UPDATE SET state=$2, updated_at=CURRENT_TIMESTAMP", 
    [uid, JSON.stringify(stateObj)]
  ).catch(() => {});
};

// إعادة كتابة دالة المسح
const originalDelState = global.delState;
global.delState = function(uid) {
  // مسح من الرام
  global.userStates.delete(uid);
  // مسح من الداتابيز (في الخلفية)
  run("DELETE FROM bot_states WHERE uid=$1", [uid]).catch(() => {});
};

module.exports = { initPersistentStates };
