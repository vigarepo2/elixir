import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const BOT_TOKEN = Deno.env.get("BOT_TOKEN");
if (!BOT_TOKEN) throw new Error("BOT_TOKEN is not set");

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function handleUpdate(update) {
  const { message } = update;
  if (message?.text) {
    const chatId = message.chat.id;
    let responseText = "";

    if (message.text === "/start") {
      responseText = "Hello! I'm a simple Telegram bot.";
    } else {
      responseText = `You said: ${message.text}`;
    }

    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: responseText,
      }),
    });
  }
}

serve(async (req) => {
  if (req.method === "POST") {
    const update = await req.json();
    await handleUpdate(update);
    return new Response("OK", { status: 200 });
  }
  return new Response("Hello, this is a Telegram bot!", { status: 200 });
});
