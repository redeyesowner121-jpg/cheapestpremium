// ===== MENU HANDLERS - Re-exports from split modules =====

export {
  showLanguageSelection, showJoinChannels, showMainMenu,
  handleSupport, forwardUserMessageToAdmin,
} from "./menu/menu-navigation.ts";
export {
  handleViewCategories, handleCategoryProducts, handleProductDetail,
} from "./menu/menu-products.ts";
export {
  handleMyOrders, handleMyWallet, handleReferEarn, handleGetOffers, handleLoginCode,
  handleWalletDeposit, handleWalletWithdraw,
} from "./menu/menu-features.ts";
