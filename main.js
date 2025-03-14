import { Bot } from "https://deno.land/x/grammy@v1.33.0/mod.ts";

// Get the bot token from environment variable
const token = Deno.env.get("BOT_TOKEN");
if (!token) throw new Error("BOT_TOKEN is not set");

// Create a bot instance
const bot = new Bot(token);

// Handle the /start command
bot.command("start", (ctx) => ctx.reply("Hello! I'm a simple Telegram bot."));

// Handle text messages
bot.on("message:text", (ctx) => ctx.reply("You said: " + ctx.message.text));

// Start the bot
bot.start();
