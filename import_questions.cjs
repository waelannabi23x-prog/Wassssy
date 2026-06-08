'use strict';
require('dotenv').config();
const { Client } = require('pg');

const QS = [
  {q:'ما هي عاصمة الجزائر؟',a:0,opts:['الجزائر','وهران','قسنطينة','عنابة'],d:1},
  {q:'كم عدد اضلاع المثلث؟',a:1,opts:['4','3','5','6'],d:1},
  {q:'من اكتشف الجاذبية؟',a:2,opts:['انشتاين','داروين','نيوتن','غاليليو'],d:2},
  {q:'اكبر قارة في العالم؟',a:0,opts:['اسيا','افريقيا','اوروبا','امريكا'],d:1},
  {q:'كم تساوي 15x15؟',a:2,opts:['200','215','225','250'],d:2},
  {q:'متى قامت الثورة الجزائرية؟',a:1,opts:['1952','1954','1956','1958'],d:2},
  {q:'اسرع حيوان بري؟',a:0,opts:['الفهد','الاسد','الغزال','الحصان'],d:2},
  {q:'كم حاسة للانسان؟',a:1,opts:['4','5','6','7'],d:1},
  {q:'من كتب البؤساء؟',a:3,opts:['ديكنز','بلزاك','تولستوي','فيكتور هوغو'],d:3},
  {q:'الرمز الكيميائي للذهب؟',a:2,opts:['Gl','Gd','Au','Go'],d:3},
  {q:'اطول نهر في العالم؟',a:0,opts:['النيل','الامازون','المسيسيبي','اليانغتسي'],d:2},
  {q:'برج ايفل في اي بلد؟',a:1,opts:['ايطاليا','فرنسا','اسبانيا','بلجيكا'],d:1},
  {q:'عملة السعودية؟',a:2,opts:['دينار','درهم','ريال','قرش'],d:1},
  {q:'عدد لاعبي كرة القدم لكل فريق؟',a:1,opts:['10','11','12','9'],d:1},
  {q:'من اخترع الهاتف؟',a:0,opts:['غراهام بيل','اديسون','تسلا','ماركوني'],d:2},
  {q:'اكثر معدن ثقلا في الطبيعة؟',a:2,opts:['الرصاص','الذهب','الاوزميوم','البلاتين'],d:4},
  {q:'اقرب كوكب للشمس؟',a:0,opts:['عطارد','الزهرة','الارض','المريخ'],d:2},
  {q:'من بنى الاهرامات؟',a:1,opts:['الرومان','المصريون القدامى','الاغريق','الفرس'],d:1},
  {q:'كم ساعة في الاسبوع؟',a:3,opts:['148','158','162','168'],d:2},
  {q:'عدد ركائز الاسلام؟',a:1,opts:['4','5','6','7'],d:1},
  {q:'عاصمة اليابان؟',a:2,opts:['اوساكا','كيوتو','طوكيو','ناغويا'],d:1},
  {q:'من فاز بكاس العالم 2022؟',a:1,opts:['فرنسا','الارجنتين','البرازيل','المغرب'],d:2},
  {q:'اكبر مدينة في العالم سكانا؟',a:0,opts:['طوكيو','شنغهاي','دلهي','بكين'],d:3},
  {q:'الغاز الاكثر وفرة في الغلاف الجوي؟',a:1,opts:['الاوكسجين','النيتروجين','ثاني اكسيد الكربون','الهيدروجين'],d:3},
  {q:'كم عدد ابراج الفلك؟',a:2,opts:['10','11','12','13'],d:2},
  {q:'من رسم الموناليزا؟',a:0,opts:['ليوناردو دافينشي','مايكل انجلو','رافاييل','بيكاسو'],d:2},
  {q:'اعمق بحيرة في العالم؟',a:1,opts:['بحيرة فيكتوريا','بايكال','تيتيكاكا','سوبيريور'],d:3},
  {q:'عدد عظام الجسم البالغ؟',a:2,opts:['196','200','206','210'],d:3},
  {q:'من كتب الف ليلة وليلة؟',a:3,opts:['ابن سينا','الجاحظ','ابن خلدون','مجهول'],d:3},
  {q:'اعلى قمة في العالم؟',a:0,opts:['ايفرست','k2','كانشنجانغا','لوتسه'],d:2},
  {q:'اول رائد فضاء في التاريخ؟',a:1,opts:['نيل ارمسترونغ','يوري غاغارين','بوز الدرين','فالنتينا'],d:2},
  {q:'عاصمة كندا؟',a:2,opts:['تورنتو','مونتريال','اوتاوا','فانكوفر'],d:2},
  {q:'اكبر محيط في العالم؟',a:0,opts:['الهادي','الاطلسي','الهندي','المتجمد الشمالي'],d:1},
  {q:'كم دقيقة في اليوم؟',a:3,opts:['1200','1320','1400','1440'],d:2},
  {q:'ما هو عدد الكروموسومات في الخلية البشرية؟',a:1,opts:['23','46','48','22'],d:4},
];

const letters = ['a','b','c','d'];
const diffMap = {1:'easy',2:'easy',3:'medium',4:'hard'};

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  // تأكد الجدول موجود
  await client.query(`CREATE TABLE IF NOT EXISTS million_questions (
    id SERIAL PRIMARY KEY, text TEXT NOT NULL,
    option_a TEXT NOT NULL, option_b TEXT NOT NULL,
    option_c TEXT NOT NULL, option_d TEXT NOT NULL,
    correct CHAR(1) NOT NULL, difficulty TEXT DEFAULT 'medium',
    used_count INTEGER DEFAULT 0, is_active SMALLINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  let inserted = 0;
  for (const q of QS) {
    const diff = diffMap[q.d] || 'medium';
    const correct = letters[q.a];
    try {
      await client.query(
        `INSERT INTO million_questions(text,option_a,option_b,option_c,option_d,correct,difficulty)
         VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [q.q, q.opts[0], q.opts[1], q.opts[2], q.opts[3], correct, diff]
      );
      inserted++;
    } catch(e) { console.log('skip:', e.message); }
  }
  
  const count = await client.query('SELECT COUNT(*) FROM million_questions WHERE is_active=1');
  console.log('✅ أضيف:', inserted, '— المجموع:', count.rows[0].count);
  await client.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
