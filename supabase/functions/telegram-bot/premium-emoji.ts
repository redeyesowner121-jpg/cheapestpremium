// ===== PREMIUM CUSTOM EMOJI (Bot API 9.4+) =====
// Uses <tg-emoji> HTML tags with fallback Unicode emoji
// Requires bot owner to have Telegram Premium subscription

// Custom emoji IDs from popular Telegram emoji packs
const EMOJI_IDS: Record<string, string> = {
  // Shopping & Products
  shopping_bag: "5282843764451376558",   // 🛍️
  cart: "5283048666498706498",            // 🛒
  package: "5283006301489576058",         // 📦
  folder: "5282968915043498793",          // 📂
  tag: "5283153889095934567",             // 🏷️
  diamond: "5283061637548269901",         // 💎

  // Money & Wallet
  money_bag: "5282924005498773755",       // 💰
  dollar: "5283098383120498767",          // 💵
  chart_up: "5283159671125668879",        // 📈
  credit_card: "5282981076632412697",     // 💳

  // Status & Actions
  check_green: "5282946082361566740",     // ✅
  cross_red: "5283044531022791898",       // ❌
  star: "5282879821065975754",            // ⭐
  fire: "5283063936085758722",            // 🔥
  lightning: "5282909748739154373",        // ⚡
  rocket: "5283039036498881764",          // 🚀
  sparkles: "5283010685282789588",        // ✨

  // Communication
  chat: "5282973979684722841",            // 💬
  phone: "5282989403843825516",           // 📞
  bell: "5283000783028009848",            // 🔔
  megaphone: "5283069720623298179",       // 📢

  // Security & System
  lock: "5282987098419423655",            // 🔒
  key: "5282969437296893665",             // 🔑
  shield: "5283078395989866498",          // 🛡️
  globe: "5282877959765693955",           // 🌐

  // Misc
  gift: "5283024704945597547",            // 🎁
  trophy: "5282916127823017068",          // 🏆
  heart: "5282945531923628671",           // ❤️
  eyes: "5283057889975455389",            // 👀
  clock: "5282966791428602859",           // ⏰
  link: "5283138297252022857",            // 🔗
  pencil: "5283097458975266488",          // ✏️
  warning: "5283013750389201684",         // ⚠️
  hourglass: "5282992375936478854",       // ⏳
  camera: "5282969969164067024",          // 📸
  mail: "5283093968316050070",            // 📩
  crown: "5283124097451479698",           // 👑
  pin: "5282947832750907432",             // 📌
  airplane: "5283016693001470270",        // ✈️
};

/**
 * Returns an HTML <tg-emoji> tag with fallback
 * Example: pe("star", "⭐") → <tg-emoji emoji-id="5282879821065975754">⭐</tg-emoji>
 */
export function pe(name: string, fallback: string): string {
  const id = EMOJI_IDS[name];
  if (!id) return fallback;
  return `<tg-emoji emoji-id="${id}">${fallback}</tg-emoji>`;
}

/**
 * Convenience: returns just the emoji ID for entities approach
 */
export function getEmojiId(name: string): string | null {
  return EMOJI_IDS[name] || null;
}
