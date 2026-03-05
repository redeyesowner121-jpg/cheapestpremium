const TELEGRAM_API = (token: string) => `https://api.telegram.org/bot${token}`;
const USERNAME_CACHE_TTL_MS = 5 * 60 * 1000;

const usernameCache = new Map<string, { username: string | null; expiresAt: number }>();

function normalizeUsername(username: string | null | undefined): string {
  return (username || "").replace(/^@/, "").trim().toLowerCase();
}

export type ResolveTelegramBotTokensInput = {
  configuredMainToken: string | null;
  configuredResaleToken: string | null;
  expectedMainUsername: string;
  expectedResaleUsername: string;
};

export async function getTelegramBotUsername(token: string | null | undefined): Promise<string | null> {
  if (!token) return null;

  const now = Date.now();
  const cached = usernameCache.get(token);
  if (cached && cached.expiresAt > now) {
    return cached.username;
  }

  try {
    const res = await fetch(`${TELEGRAM_API(token)}/getMe`);
    const data = await res.json();
    const username = data?.ok ? data?.result?.username || null : null;

    usernameCache.set(token, {
      username,
      expiresAt: now + USERNAME_CACHE_TTL_MS,
    });

    return username;
  } catch {
    usernameCache.set(token, {
      username: null,
      expiresAt: now + USERNAME_CACHE_TTL_MS,
    });
    return null;
  }
}

export async function resolveTelegramBotTokens(input: ResolveTelegramBotTokensInput) {
  const configuredMainToken = input.configuredMainToken?.trim() || null;
  const configuredResaleToken = input.configuredResaleToken?.trim() || null;

  const [configuredMainTokenUsername, configuredResaleTokenUsername] = await Promise.all([
    getTelegramBotUsername(configuredMainToken),
    getTelegramBotUsername(configuredResaleToken),
  ]);

  const expectedMain = normalizeUsername(input.expectedMainUsername);
  const expectedResale = normalizeUsername(input.expectedResaleUsername);

  const mainTokenName = normalizeUsername(configuredMainTokenUsername);
  const resaleTokenName = normalizeUsername(configuredResaleTokenUsername);

  let mainBotToken: string | null = null;
  let resaleBotToken: string | null = null;

  if (configuredMainToken && mainTokenName === expectedMain) mainBotToken = configuredMainToken;
  if (configuredResaleToken && resaleTokenName === expectedMain) mainBotToken = configuredResaleToken;

  if (configuredMainToken && mainTokenName === expectedResale) resaleBotToken = configuredMainToken;
  if (configuredResaleToken && resaleTokenName === expectedResale) resaleBotToken = configuredResaleToken;

  if (!mainBotToken) {
    mainBotToken = configuredMainToken || configuredResaleToken || null;
  }

  if (!resaleBotToken) {
    resaleBotToken = configuredResaleToken || configuredMainToken || null;
  }

  if (
    mainBotToken &&
    resaleBotToken &&
    mainBotToken === resaleBotToken &&
    configuredMainToken &&
    configuredResaleToken &&
    configuredMainToken !== configuredResaleToken
  ) {
    resaleBotToken = mainBotToken === configuredMainToken ? configuredResaleToken : configuredMainToken;
  }

  return {
    mainBotToken,
    resaleBotToken,
    tokenUsernames: {
      configuredMainTokenUsername,
      configuredResaleTokenUsername,
    },
  };
}
