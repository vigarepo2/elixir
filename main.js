// main.js - Direct Telegram API bot for Deno Deploy

// Your bot token
const TOKEN = "7958850882:AAEyzWIpIO1AT0QcDEE8uZiYAP3fahvR5fc";
const API_URL = `https://api.telegram.org/bot${TOKEN}`;

// Simple in-memory storage for user sessions
const sessions = new Map();

// Function to call Telegram API methods
async function callTelegramApi(method, params = {}) {
  const response = await fetch(`${API_URL}/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  
  return await response.json();
}

// Process incoming updates
async function processUpdate(update) {
  console.log("Processing update:", JSON.stringify(update).slice(0, 200) + "...");
  
  // Handle message updates
  if (update.message) {
    const chatId = update.message.chat.id;
    const text = update.message.text || '';
    
    // Initialize session if not exists
    if (!sessions.has(chatId)) {
      sessions.set(chatId, {
        buttonCreationMode: false,
        pendingMessage: null,
        buttons: []
      });
    }
    
    const session = sessions.get(chatId);
    
    // Handle commands
    if (text.startsWith('/')) {
      if (text === '/start' || text === '/help') {
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: "Welcome to Button Maker Bot! 🚀\n\n" +
                "I can help you create messages with custom buttons. Here's how to use me:\n\n" +
                "1. Send /create to start creating a new message with buttons\n" +
                "2. Send your message text\n" +
                "3. Then add buttons using: /addbutton Button Text | https://example.com\n" +
                "4. When you're done, send /done to get your message with buttons\n\n" +
                "You can cancel anytime with /cancel"
        });
      } else if (text === '/create') {
        session.buttonCreationMode = true;
        session.pendingMessage = null;
        session.buttons = [];
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: "Great! Send me the text for your message."
        });
      } else if (text.startsWith('/addbutton')) {
        if (!session.buttonCreationMode) {
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: "You need to start message creation first. Send /create to begin."
          });
          return;
        }
        
        if (!session.pendingMessage) {
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: "Please send your message text first, then add buttons."
          });
          return;
        }
        
        const commandArgs = text.substring('/addbutton'.length).trim();
        const parts = commandArgs.split('|');
        
        if (parts.length !== 2) {
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: "Please use the format: /addbutton Button Text | https://example.com"
          });
          return;
        }
        
        const buttonText = parts[0].trim();
        const buttonUrl = parts[1].trim();
        
        if (!buttonUrl.startsWith("http://") && !buttonUrl.startsWith("https://")) {
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: "The URL must start with http:// or https://"
          });
          return;
        }
        
        session.buttons.push({ text: buttonText, url: buttonUrl });
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: `Button "${buttonText}" with URL "${buttonUrl}" added. You now have ${session.buttons.length} button(s).\n\n` +
                "You can add more buttons with /addbutton or send /done when finished."
        });
      } else if (text === '/done') {
        if (!session.buttonCreationMode || !session.pendingMessage) {
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: "You haven't created a message yet. Send /create to begin."
          });
          return;
        }
        
        if (session.buttons.length === 0) {
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: "Your message doesn't have any buttons. Add at least one button with /addbutton."
          });
          return;
        }
        
        // Create inline keyboard markup
        const inlineKeyboard = [];
        for (const button of session.buttons) {
          inlineKeyboard.push([{ text: button.text, url: button.url }]);
        }
        
        // Send message with buttons
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: session.pendingMessage,
          reply_markup: {
            inline_keyboard: inlineKeyboard
          }
        });
        
        // Reset session
        session.buttonCreationMode = false;
        session.pendingMessage = null;
        session.buttons = [];
        
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: "Message with buttons created successfully! Send /create to make another one."
        });
      } else if (text === '/cancel') {
        session.buttonCreationMode = false;
        session.pendingMessage = null;
        session.buttons = [];
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: "Message creation cancelled. Send /create to start again."
        });
      }
    } else if (session.buttonCreationMode && !session.pendingMessage) {
      // Save message text
      session.pendingMessage = text;
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: "Message text saved!\n\n" +
              "Now add buttons with the /addbutton command. Format:\n" +
              "/addbutton Button Text | https://example.com\n\n" +
              "When you're done adding buttons, send /done"
      });
    } else {
      // Default response
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: "I don't understand that command. Send /start or /help for assistance."
      });
    }
  }
}

// Set up webhook for your bot
async function setWebhook(url) {
  const result = await callTelegramApi('setWebhook', {
    url: url
  });
  console.log("Webhook setup result:", result);
  return result;
}

// Handle webhook requests
Deno.serve(async (req) => {
  const url = new URL(req.url);
  console.log(`Received request to: ${url.pathname}`);
  
  if (url.pathname === "/SetWebhook") {
    if (req.method === "POST") {
      try {
        const update = await req.json();
        await processUpdate(update);
        return new Response("OK", { status: 200 });
      } catch (error) {
        console.error("Error processing update:", error);
        return new Response(`Error: ${error.message}`, { status: 500 });
      }
    } else if (req.method === "GET") {
      const deployURL = `https://${req.headers.get("host")}/SetWebhook`;
      const result = await setWebhook(deployURL);
      return new Response(JSON.stringify(result, null, 2), { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  
  if (url.pathname === "/") {
    return new Response("Button Maker Bot is running. Visit /SetWebhook to configure webhook.", { 
      status: 200 
    });
  }
  
  return new Response("Not found", { status: 404 });
});
