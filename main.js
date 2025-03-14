// @deno-types="npm:@types/node-telegram-bot-api@0.64.7"
import TelegramBot from "node-telegram-bot-api";
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const token = Deno.env.get("BOT_TOKEN") || "";
const bot = new TelegramBot(token, { webHook: true });

// Set webhook path
const webhookUrl = Deno.env.get("DENO_DEPLOYMENT_URL") + "/webhook";

// Initialize webhook
bot.setWebHook(webhookUrl);

// Bot commands
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "🟢 Bot activated!");
});

bot.on("message", (msg) => {
  if (msg.text && !msg.text.startsWith("/")) {
    bot.sendMessage(msg.chat.id, `📤 Echo: ${msg.text}`);
  }
});

// HTTP server
serve(async (req) => {
  if (req.method === "POST" && new URL(req.url).pathname === "/webhook") {
    try {
      const update = await req.json();
      bot.processUpdate(update);
      return new Response("OK");
    } catch (err) {
      console.error("Error:", err);
      return new Response("Error", { status: 500 });
    }
  }
  return new Response("Telegram Bot Server");
});
