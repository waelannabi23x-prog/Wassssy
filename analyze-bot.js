const Groq = require("groq-sdk");
const fs = require("fs");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const files = [
  "index.js",
  "handlers/manage.js",
  "handlers/browse.js",
  "handlers/search.js",
  "database/db.js",
  "utils/cache.js"
];

async function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  // خذ غير أول 3000 حرف
  const chunk = content.substring(0, 3000);
  
  const res = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 1000,
    messages: [{
      role: "user",
      content: `حلل هذا الكود Node.js بإيجاز، اذكر فقط الأخطاء ومشاكل الأداء:\n\n${chunk}`
    }]
  });
  
  return res.choices[0].message.content;
}

async function main() {
  for (const f of files) {
    console.log(`\n===== ${f} =====`);
    try {
      const result = await analyzeFile(f);
      console.log(result);
      // انتظر ثانية بين كل طلب
      await new Promise(r => setTimeout(r, 2000));
    } catch(e) {
      console.log("خطأ:", e.message);
    }
  }
}

main();
