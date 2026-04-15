// ===== CONSTANTS & TRANSLATIONS =====
import { pe } from "./premium-emoji.ts";

export const SUPER_ADMIN_ID = 6898461453;
export const BOT_USERNAME = "Air1_Premium_bot";
export const RESALE_BOT_USERNAME = "AIR1XOTT_bot";
export const REQUIRED_CHANNELS = ["@pocket_money27", "@RKRxOTT"];
export const UPI_ID = "8900684167@ibl";
export const UPI_NAME = "Asif Ikbal Rubaiul Islam";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ===== TRANSLATIONS =====
export const T: Record<string, Record<string, string>> = {
  welcome: {
    en: `${pe("shopping_bag", "🛍️")} <b>Welcome to RKR Premium Store!</b>\n\n${pe("sparkles", "✨")} Premium digital products at the cheapest prices\n${pe("lightning", "⚡")} Instant delivery\n${pe("lock", "🔒")} Secure payments (UPI/Binance)\n${pe("chat", "💬")} 24/7 Support\n\nChoose an option below:`,
    bn: `${pe("shopping_bag", "🛍️")} <b>RKR প্রিমিয়াম স্টোরে স্বাগতম!</b>\n\n${pe("sparkles", "✨")} সবচেয়ে কম দামে প্রিমিয়াম ডিজিটাল পণ্য\n${pe("lightning", "⚡")} তাৎক্ষণিক ডেলিভারি\n${pe("lock", "🔒")} নিরাপদ পেমেন্ট (UPI/Binance)\n${pe("chat", "💬")} ২৪/৭ সাপোর্ট\n\nনিচে একটি অপশন বেছে নিন:`,
  },
  choose_lang: {
    en: `${pe("globe", "🌐")} <b>Choose Your Language / ভাষা নির্বাচন করুন</b>`,
    bn: `${pe("globe", "🌐")} <b>Choose Your Language / ভাষা নির্বাচন করুন</b>`,
  },
  lang_saved: {
    en: `${pe("check_green", "✅")} Language set to <b>English</b>!`,
    bn: `${pe("check_green", "✅")} ভাষা <b>বাংলা</b> সেট করা হয়েছে!`,
  },
  join_channels: {
    en: `${pe("lock", "🔒")} <b>Please join our channels first!</b>\n\nYou must join both channels to use this bot.\nAfter joining, click "${pe("check_green", "✅")} I've Joined - Verify".`,
    bn: `${pe("lock", "🔒")} <b>প্রথমে আমাদের চ্যানেলে যোগ দিন!</b>\n\nবট ব্যবহার করতে উভয় চ্যানেলে যোগ দিতে হবে।\nযোগ দেওয়ার পর "${pe("check_green", "✅")} যোগ দিয়েছি - যাচাই করুন" ক্লিক করুন।`,
  },
  not_joined: {
    en: `${pe("cross_red", "❌")} You haven't joined all channels yet. Please join both channels and try again.`,
    bn: `${pe("cross_red", "❌")} আপনি এখনও সব চ্যানেলে যোগ দেননি। অনুগ্রহ করে উভয় চ্যানেলে যোগ দিন এবং আবার চেষ্টা করুন।`,
  },
  verified: {
    en: `${pe("check_green", "✅")} Verified! Welcome aboard!`,
    bn: `${pe("check_green", "✅")} যাচাই সম্পন্ন! স্বাগতম!`,
  },
  view_products: { en: "View Products", bn: "পণ্য দেখুন" },
  my_orders: { en: "My Orders", bn: "আমার অর্ডার" },
  my_wallet: { en: "My Wallet", bn: "আমার ওয়ালেট" },
  refer_earn: { en: "Refer & Earn", bn: "রেফার ও আয়" },
  support: { en: "Support", bn: "সাপোর্ট" },
  get_offers: { en: "Offers", bn: "অফার" },
  back: { en: "Back", bn: "পিছনে" },
  back_products: { en: "Back to Products", bn: "পণ্যে ফিরুন" },
  back_main: { en: "Main Menu", bn: "মূল মেনু" },
  buy_now: { en: "Buy Now", bn: "এখন কিনুন" },
  details: { en: "Details", bn: "বিস্তারিত" },
  no_products: { en: "😔 No products available right now.", bn: "😔 এখন কোনো পণ্য নেই।" },
  product_not_found: { en: `${pe("cross_red", "❌")} Product not found.`, bn: `${pe("cross_red", "❌")} পণ্য পাওয়া যায়নি।` },
  out_of_stock: { en: `${pe("cross_red", "❌")} Sorry, this product is out of stock.`, bn: `${pe("cross_red", "❌")} দুঃখিত, এই পণ্যটি স্টকে নেই।` },
  order_confirmed: {
    en: `${pe("check_green", "✅")} <b>Payment Verified!</b>\n\nYour payment has been verified. Order confirmed! Your product will be delivered shortly. ${pe("lightning", "⚡")}`,
    bn: `${pe("check_green", "✅")} <b>পেমেন্ট যাচাই হয়েছে!</b>\n\nআপনার অর্ডার নিশ্চিত করা হয়েছে! পণ্যটি শীঘ্রই ডেলিভারি হবে। ${pe("lightning", "⚡")}`,
  },
  order_rejected: {
    en: `${pe("cross_red", "❌")} <b>Payment Not Verified</b>\n\nYour payment could not be verified. Please contact support.`,
    bn: `${pe("cross_red", "❌")} <b>পেমেন্ট যাচাই ব্যর্থ</b>\n\nআপনার পেমেন্ট যাচাই করা যায়নি। সাপোর্টে যোগাযোগ করুন।`,
  },
  order_shipped: {
    en: `${pe("package", "📦")} <b>Order Shipped!</b>\n\nYour product has been dispatched! It will reach you soon. ${pe("gift", "🎉")}`,
    bn: `${pe("package", "📦")} <b>অর্ডার শিপ হয়েছে!</b>\n\nআপনার পণ্য পাঠানো হয়েছে! শীঘ্রই পৌঁছে যাবে। ${pe("gift", "🎉")}`,
  },
  send_screenshot: {
    en: `${pe("camera", "📸")} Now send your payment screenshot here. It will be forwarded to admin for verification.`,
    bn: `${pe("camera", "📸")} এখন আপনার পেমেন্ট স্ক্রিনশট এখানে পাঠান। যাচাইয়ের জন্য অ্যাডমিনের কাছে ফরোয়ার্ড হবে।`,
  },
  wallet_header: {
    en: `${pe("money_bag", "💰")} <b>My Bot Wallet</b>`,
    bn: `${pe("money_bag", "💰")} <b>আমার বট ওয়ালেট</b>`,
  },
  referral_header: {
    en: `${pe("gift", "🎁")} <b>Refer & Earn</b>`,
    bn: `${pe("gift", "🎁")} <b>রেফার ও আয়</b>`,
  },
  no_return: {
    en: "We have a strict <b>No-Return Policy</b>. All sales are final.",
    bn: "আমাদের কোনো <b>রিটার্ন পলিসি নেই</b>। সকল বিক্রয় চূড়ান্ত।",
  },
  ai_forward: {
    en: "I'm not sure about that. Would you like me to forward your question to the admin?",
    bn: "আমি এই বিষয়ে নিশ্চিত নই। আপনি কি আপনার প্রশ্ন অ্যাডমিনের কাছে ফরোয়ার্ড করতে চান?",
  },
  resale_not_reseller: {
    en: "❌ You are not a reseller. Contact admin to become one.",
    bn: "❌ আপনি রিসেলার নন। রিসেলার হতে অ্যাডমিনের সাথে যোগাযোগ করুন।",
  },
  resale_enter_price: {
    en: "💰 Enter your custom selling price (must be higher than reseller price: ₹{price}):",
    bn: "💰 আপনার কাস্টম বিক্রয় মূল্য লিখুন (রিসেলার মূল্যের চেয়ে বেশি হতে হবে: ₹{price}):",
  },
  resale_price_low: {
    en: "❌ Price must be higher than reseller price ₹{price}.",
    bn: "❌ মূল্য রিসেলার মূল্য ₹{price} এর চেয়ে বেশি হতে হবে।",
  },
  resale_link_created: {
    en: "✅ <b>Resale Link Created!</b>\n\n🔗 Link: https://t.me/{bot}?start=buy_{code}\n💰 Your Price: ₹{custom}\n📦 Reseller Price: ₹{reseller}\n💵 Profit per sale: ₹{profit}",
    bn: "✅ <b>রিসেল লিংক তৈরি হয়েছে!</b>\n\n🔗 লিংক: https://t.me/{bot}?start=buy_{code}\n💰 আপনার মূল্য: ₹{custom}\n📦 রিসেলার মূল্য: ₹{reseller}\n💵 প্রতি বিক্রয়ে লাভ: ₹{profit}",
  },
  access_denied: {
    en: `🚫 <b>Access Denied.</b> You are not authorized.`,
    bn: `🚫 <b>প্রবেশ নিষেধ।</b> আপনি অনুমোদিত নন।`,
  },
  pay_with_wallet: {
    en: "Pay with Wallet",
    bn: "ওয়ালেট দিয়ে পে করুন",
  },
  wallet_paid: {
    en: `${pe("check_green", "✅")} <b>Paid from Wallet!</b>\n\n₹{amount} deducted from your wallet.\nOrder placed for <b>{product}</b>.\nAdmin will deliver shortly. ${pe("lightning", "⚡")}`,
    bn: `${pe("check_green", "✅")} <b>ওয়ালেট থেকে পেমেন্ট হয়েছে!</b>\n\n₹{amount} ওয়ালেট থেকে কাটা হয়েছে।\n<b>{product}</b> এর অর্ডার হয়েছে।\nঅ্যাডমিন শীঘ্রই ডেলিভারি করবে। ${pe("lightning", "⚡")}`,
  },
};

export function t(key: string, lang: string): string {
  return T[key]?.[lang] || T[key]?.["en"] || key;
}
