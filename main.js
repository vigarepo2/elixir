// main.js - Telegram Button Maker Bot for Deno Deploy
import { Bot, InlineKeyboard, session } from "https://deno.land/x/grammy@v1.18.1/mod.ts";

// Bot token directly in code
const token = "7958850882:AAEyzWIpIO1AT0QcDEE8uZiYAP3fahvR5fc";
const bot = new Bot(token);

// Set up session for storing user state
bot.use(session({
  initial: () => ({
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

// Help command
bot.command("help", async (ctx) => {
  await ctx.reply(
    "Button Maker Bot Commands:\n\n" +
    "/create - Start creating a new message with buttons\n" +
    "/addbutton Text | URL - Add a button to your message\n" +
    "/done - Finish and receive your message with buttons\n" +
    "/cancel - Cancel the current message creation\n" +
    "/help - Show this help message"
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
    "I don't understand that command. Send /start or /help for assistance."
  );
});

// Error handling
bot.catch((err) => {
  console.error("Bot error:", err);
});

// Handle incoming webhook requests for Deno Deploy
Deno.serve(async (req) => {
  const url = new URL(req.url);
  console.log(`Received request to: ${url.pathname}`);
  
  // Handle the specific SetWebhook path
  if (url.pathname === "/SetWebhook") {
    if (req.method === "POST") {
      try {
        const update = await req.json();
        console.log("Received update:", JSON.stringify(update).slice(0, 200) + "...");
        await bot.handleUpdate(update);
        return new Response("OK", { status: 200 });
      } catch (error) {
        console.error("Error processing update:", error);
        return new Response(`Error processing update: ${error.message}`, { status: 500 });
      }
    } else {
      return new Response("Webhook endpoint is working", { status: 200 });
    }
  }
  
  // Root path returns status
  if (url.pathname === "/") {
    return new Response("Telegram Button Maker Bot is running! Set webhook to /SetWebhook path.", { status: 200 });
  }
  
  // Default response for other requests
  return new Response("Not found", { status: 404 });
});
