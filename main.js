// Advanced Multi-Feature Telegram Bot
// A single file containing all functionalities from A to Z

// Core configuration
const TOKEN = "YOUR_BOT_TOKEN";
const API_URL = `https://api.telegram.org/bot${TOKEN}`;
const FILE_API_URL = `https://api.telegram.org/file/bot${TOKEN}`;

// Storage (in-memory for simplicity, would use Deno KV or another DB in production)
const sessions = new Map();
const userSettings = new Map();
const groupSettings = new Map();
const activePolls = new Map();
const messageCache = new Map();

// Language packs
const languages = {
  en: {
    welcome: "Welcome to the Advanced Telegram Bot! Send /help to see all commands.",
    help_title: "Available Commands",
    help_create: "Create a message with buttons",
    help_extract: "Extract components from a message",
    // Additional language strings would be defined here
  },
  es: {
    welcome: "¡Bienvenido al Bot Avanzado de Telegram! Envía /help para ver todos los comandos.",
    help_title: "Comandos Disponibles",
    help_create: "Crear un mensaje con botones",
    help_extract: "Extraer componentes de un mensaje",
    // Additional language strings would be defined here
  }
  // Other languages would be added here
};

// Helper functions for API calls
async function callTelegramApi(method, params = {}) {
  try {
    const response = await fetch(`${API_URL}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    
    return await response.json();
  } catch (error) {
    console.error(`Error calling API method ${method}:`, error);
    return { ok: false, error: error.message };
  }
}

async function getFile(fileId) {
  const result = await callTelegramApi('getFile', { file_id: fileId });
  if (!result.ok) return null;
  return `${FILE_API_URL}/${result.result.file_path}`;
}

// User session management
function getUserSession(userId) {
  if (!sessions.has(userId)) {
    sessions.set(userId, {
      state: 'idle',
      language: 'en',
      buttonCreationMode: false,
      pendingMessage: null,
      buttons: [],
      lastMessageId: null,
      lastCommand: null,
      adminGroups: [],
      extractMode: false,
      pollCreation: null
    });
  }
  return sessions.get(userId);
}

function getUserLanguage(userId) {
  const session = getUserSession(userId);
  return session.language || 'en';
}

function getTranslation(key, userId) {
  const lang = getUserLanguage(userId);
  return languages[lang]?.[key] || languages.en[key] || key;
}

// Command processors
async function processStartCommand(chatId, userId) {
  const session = getUserSession(userId);
  
  // Reset any ongoing operations
  session.buttonCreationMode = false;
  session.extractMode = false;
  session.pollCreation = null;
  
  // Create welcome keyboard with language options
  const keyboard = {
    inline_keyboard: [
      [
        { text: "📚 Help", callback_data: "help_main" },
        { text: "🌐 Language", callback_data: "lang_select" }
      ],
      [
        { text: "🔘 Create Buttons", callback_data: "create_buttons" },
        { text: "🔍 Extract Message", callback_data: "extract_message" }
      ]
    ]
  };
  
  await callTelegramApi('sendMessage', {
    chat_id: chatId,
    text: getTranslation('welcome', userId),
    reply_markup: keyboard
  });
}

async function processHelpCommand(chatId, userId, args) {
  const helpCategory = args?.[0] || 'main';
  let helpText = "";
  let keyboard = {
    inline_keyboard: []
  };
  
  switch (helpCategory) {
    case 'main':
      helpText = `${getTranslation('help_title', userId)}:\n\n` +
        "• /create - Create messages with custom buttons\n" +
        "• /extract - Extract components from forwarded messages\n" +
        "• /poll - Create interactive polls\n" +
        "• /translate - Translate text to different languages\n" +
        "• /media - Download media from various sources\n" +
        "• /convert - Convert files between formats\n\n" +
        "Use /help [command] for detailed information about a specific command.";
      
      keyboard.inline_keyboard = [
        [
          { text: "Message Creation", callback_data: "help_msg" },
          { text: "Group Management", callback_data: "help_group" }
        ],
        [
          { text: "Media Tools", callback_data: "help_media" },
          { text: "Utilities", callback_data: "help_utils" }
        ],
        [
          { text: "Settings", callback_data: "help_settings" },
          { text: "Advanced Features", callback_data: "help_advanced" }
        ]
      ];
      break;
      
    case 'msg':
      helpText = "📝 Message Creation Commands:\n\n" +
        "• /create - Start creating a message with buttons\n" +
        "• /addbutton [text] | [URL] - Add a button to your message\n" +
        "• /done - Finalize and receive your message with buttons\n" +
        "• /cancel - Cancel the current creation process\n" +
        "• /template [name] - Use a saved message template";
      keyboard.inline_keyboard = [[{ text: "« Back to Help", callback_data: "help_main" }]];
      break;
      
    case 'extract':
      helpText = "🔍 Extraction Commands:\n\n" +
        "• /extract - Reply to a message to extract its components\n" +
        "• Forward any message to the bot and use /extract to analyze it\n" +
        "• Use /extractjson for JSON output format\n" +
        "• Use /extractbuttons to only extract button data";
      keyboard.inline_keyboard = [[{ text: "« Back to Help", callback_data: "help_main" }]];
      break;
      
    // Additional help categories would be defined here
  }
  
  await callTelegramApi('sendMessage', {
    chat_id: chatId,
    text: helpText,
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

// Button creation features
async function processCreateCommand(chatId, userId) {
  const session = getUserSession(userId);
  session.buttonCreationMode = true;
  session.pendingMessage = null;
  session.buttons = [];
  
  await callTelegramApi('sendMessage', {
    chat_id: chatId,
    text: "Great! Send me the text for your message.",
    reply_markup: {
      keyboard: [[{ text: "❌ Cancel Creation" }]],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  });
}

async function processAddButtonCommand(chatId, userId, text) {
  const session = getUserSession(userId);
  
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
  
  const previewKeyboard = [];
  for (const button of session.buttons) {
    previewKeyboard.push([{ text: button.text, url: button.url }]);
  }
  
  await callTelegramApi('sendMessage', {
    chat_id: chatId,
    text: `Button "${buttonText}" with URL "${buttonUrl}" added. You now have ${session.buttons.length} button(s).\n\nCurrent buttons preview:`,
    reply_markup: {
      inline_keyboard: previewKeyboard
    }
  });
  
  await callTelegramApi('sendMessage', {
    chat_id: chatId,
    text: "You can add more buttons with /addbutton or send /done when finished.",
    reply_markup: {
      keyboard: [
        [{ text: "✅ Done" }, { text: "❌ Cancel" }],
        [{ text: "👀 Preview Message" }]
      ],
      resize_keyboard: true
    }
  });
}

async function processDoneCommand(chatId, userId) {
  const session = getUserSession(userId);
  
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
  
  // Create inline keyboard
  const inlineKeyboard = [];
  for (const button of session.buttons) {
    inlineKeyboard.push([{ text: button.text, url: button.url }]);
  }
  
  // Send message with buttons
  await callTelegramApi('sendMessage', {
    chat_id: chatId,
    text: session.pendingMessage,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: inlineKeyboard
    }
  });
  
  // Reset session
  session.buttonCreationMode = false;
  
  // Ask if user wants to save this as a template
  await callTelegramApi('sendMessage', {
    chat_id: chatId,
    text: "Message with buttons created successfully! Would you like to save this as a template for future use?",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Yes, save template", callback_data: "save_template" },
          { text: "No, thank you", callback_data: "no_template" }
        ]
      ]
    }
  });
}

// Extraction features - the most advanced part requested
async function processExtractCommand(chatId, userId, messageId, replyToMessage) {
  if (!replyToMessage) {
    await callTelegramApi('sendMessage', {
      chat_id: chatId,
      text: "Please reply to a message you want to extract components from.",
      reply_to_message_id: messageId
    });
    return;
  }
  
  // Store message in cache for processing
  messageCache.set(`${userId}_extract`, replyToMessage);
  
  // Analyze message components
  const extractionResult = extractMessageComponents(replyToMessage);
  
  // First send a simplified text version
  let responseText = "📊 Message Analysis:\n\n";
  
  if (extractionResult.text) {
    responseText += `📝 <b>Text Content:</b>\n${extractionResult.text.substring(0, 100)}${extractionResult.text.length > 100 ? '...' : ''}\n\n`;
  }
  
  if (extractionResult.entities && extractionResult.entities.length > 0) {
    responseText += `🔗 <b>Entities:</b> ${extractionResult.entities.length} found\n`;
    
    const entityTypes = extractionResult.entities.map(e => e.type);
    const entityCounts = entityTypes.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    
    for (const [type, count] of Object.entries(entityCounts)) {
      responseText += `- ${type}: ${count}\n`;
    }
    responseText += '\n';
  }
  
  if (extractionResult.buttons && extractionResult.buttons.length > 0) {
    responseText += `🔘 <b>Buttons:</b> ${extractionResult.buttons.length} found\n`;
    for (let i = 0; i < Math.min(extractionResult.buttons.length, 3); i++) {
      const button = extractionResult.buttons[i];
      responseText += `- "${button.text}" → ${button.url}\n`;
    }
    
    if (extractionResult.buttons.length > 3) {
      responseText += `... and ${extractionResult.buttons.length - 3} more\n`;
    }
    responseText += '\n';
  }
  
  if (extractionResult.media) {
    responseText += `�attachments <b>Media:</b> ${extractionResult.media.type}\n`;
    if (extractionResult.media.caption) {
      responseText += `Caption: ${extractionResult.media.caption.substring(0, 50)}${extractionResult.media.caption.length > 50 ? '...' : ''}\n`;
    }
  }
  
  // Send the analysis
  await callTelegramApi('sendMessage', {
    chat_id: chatId,
    text: responseText,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Get JSON Format", callback_data: "extract_json" },
          { text: "Extract Buttons Only", callback_data: "extract_buttons" }
        ],
        [
          { text: "Copy This Message", callback_data: "extract_copy" },
          { text: "Copy With New Text", callback_data: "extract_copyedit" }
        ]
      ]
    }
  });
}

function extractMessageComponents(message) {
  const result = {
    message_id: message.message_id,
    from: message.from,
    text: message.text || message.caption || "",
    entities: message.entities || message.caption_entities || [],
    buttons: [],
    media: null,
    date: message.date
  };
  
  // Extract inline keyboard buttons if present
  if (message.reply_markup && message.reply_markup.inline_keyboard) {
    for (const row of message.reply_markup.inline_keyboard) {
      for (const button of row) {
        if (button.url) {
          result.buttons.push({
            text: button.text,
            url: button.url
          });
        } else if (button.callback_data) {
          result.buttons.push({
            text: button.text,
            callback_data: button.callback_data
          });
        }
      }
    }
  }
  
  // Check for media
  if (message.photo) {
    result.media = {
      type: 'photo',
      file_id: message.photo[message.photo.length - 1].file_id,
      caption: message.caption
    };
  } else if (message.video) {
    result.media = {
      type: 'video',
      file_id: message.video.file_id,
      caption: message.caption
    };
  } else if (message.document) {
    result.media = {
      type: 'document',
      file_id: message.document.file_id,
      file_name: message.document.file_name,
      mime_type: message.document.mime_type,
      caption: message.caption
    };
  } else if (message.audio) {
    result.media = {
      type: 'audio',
      file_id: message.audio.file_id,
      caption: message.caption
    };
  } else if (message.voice) {
    result.media = {
      type: 'voice',
      file_id: message.voice.file_id,
      caption: message.caption
    };
  } else if (message.sticker) {
    result.media = {
      type: 'sticker',
      file_id: message.sticker.file_id
    };
  }
  
  return result;
}

async function processExtractJsonCommand(chatId, userId) {
  const cachedMessage = messageCache.get(`${userId}_extract`);
  if (!cachedMessage) {
    await callTelegramApi('sendMessage', {
      chat_id: chatId,
      text: "No message to extract. Please reply to a message with /extract first."
    });
    return;
  }
  
  const extractionResult = extractMessageComponents(cachedMessage);
  const jsonOutput = JSON.stringify(extractionResult, null, 2);
  
  // Send formatted JSON
  await callTelegramApi('sendMessage', {
    chat_id: chatId,
    text: `<pre>${escapeHtml(jsonOutput)}</pre>`,
    parse_mode: 'HTML'
  });
}

// Helper functions
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Main update processing function
async function processUpdate(update) {
  console.log("Processing update:", JSON.stringify(update).slice(0, 200) + "...");
  
  try {
    // Handle messages
    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const userId = message.from.id;
      const text = message.text || '';
      
      // Get or initialize user session
      const session = getUserSession(userId);
      
      // Handle commands
      if (text.startsWith('/')) {
        const [command, ...args] = text.split(' ');
        
        switch (command) {
          case '/start':
            await processStartCommand(chatId, userId);
            break;
            
          case '/help':
            await processHelpCommand(chatId, userId, args);
            break;
            
          case '/create':
            await processCreateCommand(chatId, userId);
            break;
            
          case '/addbutton':
            await processAddButtonCommand(chatId, userId, text);
            break;
            
          case '/done':
            await processDoneCommand(chatId, userId);
            break;
            
          case '/cancel':
            session.buttonCreationMode = false;
            session.extractMode = false;
            session.pollCreation = null;
            await callTelegramApi('sendMessage', {
              chat_id: chatId,
              text: "Operation cancelled.",
              reply_markup: { remove_keyboard: true }
            });
            break;
            
          case '/extract':
          case '/extractjson':
            await processExtractCommand(chatId, userId, message.message_id, message.reply_to_message);
            break;
            
          // Additional commands would be handled here
            
          default:
            await callTelegramApi('sendMessage', {
              chat_id: chatId,
              text: `Unknown command. Send /help to see available commands.`
            });
        }
        return;
      }
      
      // Handle text in button creation mode
      if (session.buttonCreationMode && !session.pendingMessage) {
        session.pendingMessage = text;
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: "Message text saved!\n\nNow add buttons with the /addbutton command. Format:\n/addbutton Button Text | https://example.com\n\nWhen you're done adding buttons, send /done",
          reply_markup: {
            keyboard: [
              [{ text: "/addbutton Button 1 | https://example.com" }],
              [{ text: "✅ /done" }, { text: "❌ /cancel" }]
            ],
            resize_keyboard: true
          }
        });
        return;
      }
      
      // Handle forwarded messages automatically
      if (message.forward_from || message.forward_from_chat) {
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: "I received a forwarded message. Reply with /extract to analyze its components.",
          reply_to_message_id: message.message_id,
          reply_markup: {
            inline_keyboard: [
              [{ text: "Extract Components", callback_data: `extract_msg_${message.message_id}` }]
            ]
          }
        });
        return;
      }
      
      // Default response
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: "I'm here to help! Send /help to see available commands."
      });
    }
    
    // Handle callback queries (button clicks)
    else if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const data = callbackQuery.data;
      const chatId = callbackQuery.message.chat.id;
      const userId = callbackQuery.from.id;
      const messageId = callbackQuery.message.message_id;
      
      // Handle different callback actions
      if (data.startsWith('help_')) {
        const helpCategory = data.substring(5);
        await processHelpCommand(chatId, userId, [helpCategory]);
      }
      else if (data === 'extract_json') {
        await processExtractJsonCommand(chatId, userId);
      }
      else if (data.startsWith('extract_msg_')) {
        const targetMessageId = parseInt(data.substring(12));
        // Find the message in cache or fetch it
        // This would need implementation to retrieve the message
      }
      // Additional callback handlers would be implemented here
      
      // Acknowledge the callback query
      await callTelegramApi('answerCallbackQuery', {
        callback_query_id: callbackQuery.id
      });
    }
  } catch (error) {
    console.error("Error in processUpdate:", error);
  }
}

// Server to handle webhook
Deno.serve(async (req) => {
  const url = new URL(req.url);
  
  // Serve root path with status
  if (url.pathname === "/" && req.method === "GET") {
    return new Response("Advanced Telegram Bot is running!", { 
      status: 200 
    });
  }
  
  // Handle webhook updates
  if (url.pathname === "/SetWebhook" && req.method === "POST") {
    try {
      const update = await req.json();
      await processUpdate(update);
      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("Error processing webhook update:", error);
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  }
  
  // Setup the webhook
  if (url.pathname === "/SetWebhook" && req.method === "GET") {
    const deployURL = `https://${req.headers.get("host")}/SetWebhook`;
    const result = await callTelegramApi('setWebhook', {
      url: deployURL
    });
    return new Response(JSON.stringify(result, null, 2), { 
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
  
  // Default response for unhandled paths
  return new Response("Not found", { status: 404 });
});
