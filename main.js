// main.ts - Telegram Button Maker Bot
import { Bot, InlineKeyboard, session } from "https://deno.land/x/grammy@v1.18.1/mod.ts";

// Define session structure
interface SessionData {
  buttonCreationMode: boolean;
  pendingMessage: string | null;
  buttons: Array<{ text: string; url: string }>;
}

// Initialize bot with token from environment
const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
if (!token) throw new Error("TELEGRAM_BOT_TOKEN is unset");

const bot = new Bot(token);

// Set up session for storing user state
bot.use(session({
  initial: (): SessionData => ({
    buttonCreationMode: false,
    pendingMessage: null,
    buttons: [],
  })
}));

// Start command - introduction
bot.command("start", async (ctx) => {
  await ctx.reply(
    "Welcome to Button Maker Bot! 🚀\n\n" +
    "I can help you create messages with custom buttons. Here's how to use me:\n\n" +
    "1. Send /create to start creating a new message with buttons\n" +
    "2. Send your message text\n" +
    "3. Then add buttons using: /addbutton Button Text | https://example.com\n" +
    "4. When you're done, send /done to get your message with buttons\n\n" +
    "You can cancel anytime with /cancel"
  );
});

// Create command - start the button creation process
bot.command("create", async (ctx) => {
  ctx.session.buttonCreationMode = true;
  ctx.session.pendingMessage = null;
  ctx.session.buttons = [];
  await ctx.reply("Great! Send me the text for your message.");
});

// Add button command - add a button to the message
bot.command("addbutton", async (ctx) => {
  if (!ctx.session.buttonCreationMode) {
    await ctx.reply("You need to start message creation first. Send /create to begin.");
    return;
  }

  if (!ctx.session.pendingMessage) {
    await ctx.reply("Please send your message text first, then add buttons.");
    return;
  }

  const commandText = ctx.message?.text || "";
  const commandArgs = commandText.substring("/addbutton".length).trim();
  
  const parts = commandArgs.split('|');
  if (parts.length !== 2) {
    await ctx.reply(
      "Please use the format: /addbutton Button Text | https://example.com"
    );
    return;
  }

  const buttonText = parts[0].trim();
  const buttonUrl = parts[1].trim();
  
  if (!buttonUrl.startsWith("http://") && !buttonUrl.startsWith("https://")) {
    await ctx.reply("The URL must start with http:// or https://");
    return;
  }

  ctx.session.buttons.push({ text: buttonText, url: buttonUrl });
  await ctx.reply(
    `Button "${buttonText}" with URL "${buttonUrl}" added. You now have ${ctx.session.buttons.length} button(s).\n\n` +
    "You can add more buttons with /addbutton or send /done when finished."
  );
});

// Done command - finalize and send the message with buttons
bot.command("done", async (ctx) => {
  if (!ctx.session.buttonCreationMode || !ctx.session.pendingMessage) {
    await ctx.reply("You haven't created a message yet. Send /create to begin.");
    return;
  }

  if (ctx.session.buttons.length === 0) {
    await ctx.reply("Your message doesn't have any buttons. Add at least one button with /addbutton.");
    return;
  }

  // Create an inline keyboard with the defined buttons
  const keyboard = new InlineKeyboard();
  
  // Add buttons, one per row
  for (let i = 0; i < ctx.session.buttons.length; i++) {
    const button = ctx.session.buttons[i];
    keyboard.url(button.text, button.url);
    
    // Add a new row after each button except the last one
    if (i < ctx.session.buttons.length - 1) {
      keyboard.row();
    }
  }

  // Send the final message with buttons
  await ctx.reply(ctx.session.pendingMessage, {
    reply_markup: keyboard,
  });

  // Reset the session
  ctx.session.buttonCreationMode = false;
  ctx.session.pendingMessage = null;
  ctx.session.buttons = [];
  
  await ctx.reply("Message with buttons created successfully! Send /create to make another one.");
});

// Cancel command - abort the button creation process
bot.command("cancel", async (ctx) => {
  ctx.session.buttonCreationMode = false;
  ctx.session.pendingMessage = null;
  ctx.session.buttons = [];
  await ctx.reply("Message creation cancelled. Send /create to start again.");
});

// Handle regular text messages
bot.on("message:text", async (ctx) => {
  // Skip handling commands
  if (ctx.message?.text?.startsWith("/")) {
    return;
  }
  
  // If in button creation mode and no pending message, save the text
  if (ctx.session.buttonCreationMode && !ctx.session.pendingMessage) {
    ctx.session.pendingMessage = ctx.message?.text || "";
    await ctx.reply(
      "Message text saved!\n\n" +
      "Now add buttons with the /addbutton command. Format:\n" +
      "/addbutton Button Text | https://example.com\n\n" +
      "When you're done adding buttons, send /done"
    );
    return;
  }

  // Default response for text that doesn't match any command
  await ctx.reply(
    "I don't understand that command. Send /start for help."
  );
});

// Error handling
bot.catch((err) => {
  console.error("Bot error:", err);
});

// Determine if we're in production or development
const isProduction = Deno.env.get("DENO_ENV") === "production";

if (isProduction) {
  // Production: Set up webhook for Deno Deploy
  const webhookUrl = Deno.env.get("WEBHOOK_URL");
  if (!webhookUrl) {
    throw new Error("WEBHOOK_URL is required in production mode");
  }
  
  // Set the webhook with Telegram
  bot.api.setWebhook(`${webhookUrl}/${token}`);
  
  // Handle webhook requests
  Deno.serve(async (req) => {
    const url = new URL(req.url);
    
    // Only process POST requests to the webhook path
    if (req.method === "POST" && url.pathname === `/${token}`) {
      try {
        const update = await req.json();
        await bot.handleUpdate(update);
        return new Response("OK", { status: 200 });
      } catch (error) {
        console.error("Error processing update:", error);
        return new Response("Error processing update", { status: 500 });
      }
    }
    
    // Default response for other requests
    return new Response("Telegram Button Maker Bot is running", { status: 200 });
  });
} else {
  // Development: Use long polling
  console.log("Starting bot in development mode with long polling");
  bot.start();
}
