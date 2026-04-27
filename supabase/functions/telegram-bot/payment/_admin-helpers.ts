// Helper: Try sending message via multiple bot tokens
export async function sendToUser(tokens: string[], chatId: number, text: string) {
  for (const token of tokens) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      });
      const result = await res.json();
      if (result.ok) return true;
      console.log(`sendToUser token attempt failed for chat ${chatId}:`, result.description);
    } catch (e) {
      console.error(`sendToUser error:`, e);
    }
  }
  return false;
}

// Resolve which bot tokens to use for an order based on origin
export async function resolveOrderTokens(supabase: any, order: any, mainToken: string) {
  const resaleToken = Deno.env.get("RESALE_BOT_TOKEN");
  const isResaleOrder = !!order.reseller_telegram_id;
  const isChildBotOrder = order.username?.startsWith("child_bot:");
  let tokensToTry: string[];
  let userToken: string;

  if (isChildBotOrder) {
    const childBotId = order.username.replace("child_bot:", "");
    const { data: childBot } = await supabase.from("child_bots").select("bot_token").eq("id", childBotId).single();
    if (childBot?.bot_token) {
      tokensToTry = [childBot.bot_token, mainToken];
      userToken = childBot.bot_token;
    } else {
      tokensToTry = [mainToken];
      userToken = mainToken;
    }
  } else if (isResaleOrder && resaleToken && resaleToken !== mainToken) {
    tokensToTry = [resaleToken, mainToken];
    userToken = resaleToken;
  } else {
    tokensToTry = [mainToken];
    if (resaleToken && resaleToken !== mainToken) tokensToTry.push(resaleToken);
    userToken = mainToken;
  }
  return { tokensToTry, userToken, isResaleOrder, isChildBotOrder };
}
