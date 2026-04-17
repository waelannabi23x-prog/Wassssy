const db = require("../database/db");
const filesDb = require("../database/files");
const adminsDb = require("../database/admins");
const { btn, build } = require("../utils/keyboard");

async function resolveSmartPath(parts) {
  let specs = await db.all("SELECT id, name FROM specialties WHERE is_deleted=0");
  let m1 = specs.filter(s => s.name.toLowerCase().includes(parts[0].toLowerCase()));
  if(m1.length !== 1) return { err: "التخصص", choices: m1 };
  
  let years = await db.all("SELECT id, name FROM years WHERE specialty_id=$1 AND is_deleted=0", [m1[0].id]);
  let m2 = years.filter(y => y.name.toLowerCase().includes(parts[1].toLowerCase()));
  if(m2.length !== 1) return { err: "السنة", choices: m2 };
  
  let sems = await db.all("SELECT id, name FROM semesters WHERE year_id=$1 AND is_deleted=0", [m2[0].id]);
  let m3 = sems.filter(s => s.name.toLowerCase().includes(parts[2].toLowerCase()));
  if(m3.length !== 1) return { err: "الفصل", choices: m3 };
  
  let subs = await db.all("SELECT id, name FROM subjects WHERE semester_id=$1 AND is_deleted=0", [m3[0].id]);
  let m4 = subs.filter(s => s.name.toLowerCase().includes(parts[3].toLowerCase()));
  if(m4.length !== 1) return { err: "المادة", choices: m4 };
  
  let cats = await db.all("SELECT id, name FROM categories WHERE subject_id=$1 AND is_deleted=0", [m4[0].id]);
  let m5 = cats.filter(c => c.name.toLowerCase().includes(parts[4].toLowerCase()));
  if(m5.length !== 1) return { err: "القسم", choices: m5 };
  
  return { catId: m5[0].id, path: m1[0].name+" > "+m2[0].name+" > "+m3[0].name+" > "+m4[0].name+" > "+m5[0].name };
}

exports.trySmartUpload = async (ctx) => {
  if(!ctx.isOwner) return false;
  const msg = ctx.message;
  const caption = (msg.text || msg.caption || "").trim();
  if(!caption.match(/تخصص:|سنة:|فصل:|مادة:|قسم:|spec:|year:|sem:|mat:|cat:|spé|année|semestre|matière|catégorie/i) return false;

  ctx.reply("🔍 جاري تحليل المسار...").catch(()=>{});
  let cleanCaption = caption.replace(/تخصص:|سنة:|فصل:|مادة:|قسم:/gi, "").trim();
  let parts = cleanCaption.split(/[|,]/).map(p=>p.trim()).filter(p=>p);
  
  if(parts.length < 5) {
    return ctx.reply("⚠️ صيغة غير مكتملة (يجب 5 أقسام مفصولة بـ |).\n\n🇩🇩 عربي:\nتخصص: LMD | سنة: 2 | فصل: 1 | مادة: الغوا | قسم: سيري\n\n🇫🇷 فرنسي:\nspec: LMD | année: 2 | semestre: 1 | matière: Algo | catégorie: Serie\n\n🇬🇧 إنجليزي:\nspec: LMD | year: 2 | sem: 1 | mat: Algo | cat: Serie");
  }

  let fileId, fileType, fileName = "";
  if(msg.document) { fileId = msg.document.file_id; fileType = "document"; fileName = msg.document.file_name || "ملف"; }
  else if(msg.photo) { fileId = msg.photo[msg.photo.length-1].file_id; fileType = "photo"; fileName = "صورة"; }
  else return ctx.reply("يرجى إرفاق ملف مع المسار.");

  const res = await resolveSmartPath(parts);
  
  if(res.err) {
    let text = "❓ وجدت عدة خيارات لـ *"+res.err+"*، اختر الصحيح:\n";
    const rows = res.choices.slice(0,6).map(c => [btn(c.name, "smart_fix_"+res.err.toLowerCase()+"_"+c.id+"_"+parts.join("_"))]);
    return ctx.reply(text, { parse_mode: "Markdown", ...build(rows) });
  }

  try {
    let finalTitle = fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
    await filesDb.addFile(res.catId, finalTitle, "", fileId, fileType, ctx.uid);
    await ctx.reply("✅ تم الرفع بنجاح!\n\n📍 المسار: "+res.path+"\n📄 الملف: "+finalTitle);
  } catch(e) {
    ctx.reply("❌ فشل الرفع: " + (e.message==="exists" ? "الملف موجود مسبقاً!" : e.message));
  }
  return true;
};

exports.fixSmartPath = async (ctx, data) => {
  const p = data.replace("smart_fix_", "").split("_");
  const type = p[0]; const id = p[1]; const parts = p.slice(2);
  
  // إعادة بناء أجزاء المسار مع الإصلاح
  if(type==="التخصص") parts[0] = (await db.all("SELECT name FROM specialties WHERE id=$1",[id]))[0]?.name || parts[0];
  if(type==="السنة") parts[1] = (await db.all("SELECT name FROM years WHERE id=$1",[id]))[0]?.name || parts[1];
  if(type==="الفصل") parts[2] = (await db.all("SELECT name FROM semesters WHERE id=$1",[id]))[0]?.name || parts[2];
  if(type==="المادة") parts[3] = (await db.all("SELECT name FROM subjects WHERE id=$1",[id]))[0]?.name || parts[3];
  if(type==="القسم") parts[4] = (await db.all("SELECT name FROM categories WHERE id=$1",[id]))[0]?.name || parts[4];

  ctx.deleteMessage().catch(()=>{});
  ctx.reply("✅ تم التصحيح! أعد إرسال الملف مع المسار:\n\nتخصص: "+parts[0]+" | سنة: "+parts[1]+" | فصل: "+parts[2]+" | مادة: "+parts[3]+" | قسم: "+parts[4]);
};

exports.batchPromote = async (ctx) => {
  const text = ctx.message.text.replace(/\/promote/gi, "").trim();
  const ids = text.split(/\s+/).map(Number).filter(n => !isNaN(n));
  if(!ids.length) return ctx.reply("استخدم: /promote ID1 ID2 ID3");
  ctx.reply("جاري الإضافة...");
  let done = 0;
  for(const id of ids) { try { await adminsDb.add(id, ctx.uid); done++; } catch(e){} }
  ctx.reply("✅ تم إضافة "+done+" مشرف.");
};

exports.listGroups = async (ctx) => {
  const groups = await db.all("SELECT gc.chat_id, gc.title, sp.name as spec FROM group_chats gc LEFT JOIN specialties sp ON gc.specialty_id=sp.id");
  if(!groups.length) return ctx.reply("البوت ليس في أي قروب.");
  let text = "👥 قروبات البوت:\n\n";
  const rows = [];
  groups.forEach(g => {
    text += "🆔 `"+g.chat_id+"`\n📝 "+(g.title||"بدون اسم")+"\n🎓 "+(g.spec||"غير محدد")+"\n\n";
    rows.push([btn("مغادرة: "+(g.title||g.chat_id).substring(0,20), "leave_grp_"+g.chat_id)]);
  });
  ctx.reply(text, { parse_mode: "Markdown", ...build(rows) });
};

exports.leaveGroup = async (ctx) => {
  const id = parseInt(ctx.message.text.replace(/\/leavegroup/gi, "").trim());
  if(isNaN(id)) return ctx.reply("استخدم: /leavegroup <ID>");
  try {
    await ctx.telegram.leaveChat(id);
    await db.run("DELETE FROM group_chats WHERE chat_id=$1", [id]);
    ctx.reply("✅ تم الخروج من القروب "+id);
  } catch(e) { ctx.reply("❌ فشل: "+e.message); }
};
