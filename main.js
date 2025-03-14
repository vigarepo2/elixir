import { Bot, webhookCallback } from "grammy";
import { serve } from "http";

// Initialize bot with environment token
const bot = new Bot(Deno.env.get("BOT_TOKEN") || "");

// Basic commands
bot.command("start", (ctx) => 
  ctx.reply("🚀 Welcome! I'm a Deno Deploy powered bot\n" +
            "Try sending any message!"));

// Echo handler
bot.on("message:text", (ctx) => {
  const text = ctx.message.text;
  ctx.reply(`🔊 Echo: ${text}`);
});

// Error handling
bot.catch((err) => {
  console.error(`Error in bot:`, err);
});

// Webhook configuration
const handleWebhook = webhookCallback(bot, "std/http");

// HTTP server setup
serve(async (req) => {
  try {
    return await handleWebhook(req);
  } catch (err) {
    console.error("Server error:", err);
    return new Response(err.message, { status: 500 });
  }
});

console.log("🤖 Bot server started successfully");
