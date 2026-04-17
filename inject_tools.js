const fs = require("fs");
let idx = fs.readFileSync("./index.js", "utf8");

if (!idx.includes("require('./handlers/owner_tools')")) {
  idx = idx.replace(
    "const { handleAiChat, resetChat } = require('./handlers/ai_chat');",
    "const { handleAiChat, resetChat } = require('./handlers/ai_chat');\nconst tools = require('./handlers/owner_tools');"
  );
}

if (!idx.includes("tools.trySmartUpload")) {
  idx = idx.replace(
    "if (state?.type === 'mg_bulk_files') return manage.handleBulkUpload(ctx);",
    "if (await tools.trySmartUpload(ctx)) return;\n  if (state?.type === 'mg_bulk_files') return manage.handleBulkUpload(ctx);"
  );
}

if (!idx.includes("tools.batchPromote")) {
  idx = idx.replace(
    "bot.command('cancel', ctx => {",
    "bot.command('promote', tools.batchPromote);\nbot.command('cancel', ctx => {"
  );
}

if (!idx.includes("tools.listGroups")) {
  idx = idx.replace(
    "bot.command('leaveall', async ctx => {",
    "bot.command('mygroups', tools.listGroups);\nbot.command('leavegroup', tools.leaveGroup);\nbot.command('leaveall', async ctx => {"
  );
}

if (!idx.includes("tools.fixSmartPath")) {
  idx = idx.replace(
    "if(data.startsWith('mg_ttype_'))",
    "if(data.startsWith('smart_fix_')) { return tools.fixSmartPath(ctx, data); }\n  if(data.startsWith('mg_ttype_'))"
  );
}

fs.writeFileSync("./index.js", idx);
console.log("Done");
