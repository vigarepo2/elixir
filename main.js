import { Bot, webhookCallback } from "https://deno.land/x/grammy@v1.21.1/mod.ts";
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const token = Deno.env.get("BOT_TOKEN");
if (!token) throw new Error("Missing BOT_TOKEN");

const bot = new Bot(token);

// Basic commands
bot.command("start", (ctx) => ctx.reply("Welcome! I'm a Deno Deploy bot"));
bot.on("message:text", (ctx) => ctx.reply(`Echo: ${ctx.message.text}`));

// Handle webhook requests
const handleUpdate = webhookCallback(bot, "std/http");

serve(async (req) => {
  try {
    return await handleUpdate(req);
  } catch (err) {
    console.error(err);
    return new Response(err.message, { status: 500 });
  }
});
