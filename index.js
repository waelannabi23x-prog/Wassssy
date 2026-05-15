require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const db = require("./src/database");
const { handleCallback } = require("./src/callbackHandler");
const { handleMessage } = require("./src/messageHandler");
const { sendMainMenu } = require("./src/menus");

const TOKEN = process.env.BOT_TOKEN || "8277106809:AAG3Bee4CopUvTBgAKQWssj3ZmbxbdGOTfM";
const bot = new TelegramBot(TOKEN, { polling: true });

// ── Session store ─────────────────────────────────────────────────────────────
const sessions = {};
global.bot = bot;
global.sessions = sessions;

// ── /start ────────────────────────────────────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  sessions[chatId] = { state: "IDLE", data: {} };
  const name = msg.from.first_name || "طالب";
  await bot.sendMessage(
    chatId,
    `🎓 *أهلاً ${name}!*\nمرحباً في بوت الدراسة الاحترافي\n\n_اختر من القائمة أدناه:_`,
    { parse_mode: "Markdown" }
  );
  await sendMainMenu(chatId);
});

// ── /menu ─────────────────────────────────────────────────────────────────────
bot.onText(/\/menu/, async (msg) => {
  sessions[msg.chat.id] = { state: "IDLE", data: {} };
  await sendMainMenu(msg.chat.id);
});

// ── Callback queries ──────────────────────────────────────────────────────────
bot.on("callback_query", async (query) => {
  try {
    await bot.answerCallbackQuery(query.id);
    await handleCallback(query, sessions);
  } catch (e) {
    console.error("Callback error:", e.message);
  }
});

// ── Text messages ─────────────────────────────────────────────────────────────
bot.on("message", async (msg) => {
  if (msg.text?.startsWith("/")) return;
  try {
    await handleMessage(msg, sessions);
  } catch (e) {
    console.error("Message error:", e.message);
  }
});

// ── Media messages ────────────────────────────────────────────────────────────
for (const t of ["photo", "document", "audio", "video"]) {
  bot.on(t, async (msg) => {
    try {
      await handleMessage(msg, sessions, t);
    } catch (e) {
      console.error(`${t} error:`, e.message);
    }
  });
}

bot.on("polling_error", (e) => console.error("Polling:", e.message));
console.log("🤖 Study Bot v2 is running...");
