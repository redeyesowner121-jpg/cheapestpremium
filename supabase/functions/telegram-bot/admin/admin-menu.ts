// ===== ADMIN MENU — barrel re-exports (split into focused modules for maintainability) =====

export {
  isChildBotOwner,
  handleChildBotAdminMenu,
  handleChildBotSettingsMenu,
  promptChildBotSettingEdit,
  saveChildBotSettingHandler,
  handleChildBotAnalytics,
  handleChildBotUsers,
  handleChildBotOrders,
} from "./child-bot-admin.ts";

export {
  handleAdminMenu,
  handleAdminProductsMenu,
  handleAdminUsersMenu,
  handleAdminWalletMenu,
  handleAdminChannelsMenu,
  handleAdminOwnerMenu,
} from "./main-menu.ts";

export {
  handleAdminSettingsMenu,
  getAllSettingDefs,
  findSettingDef,
  handleSettingsCategory,
  promptSettingEdit,
  saveSetting,
  handleBotSettings,
  handleSetMinReferral,
} from "./settings-menu.ts";

export { handleReport } from "./report.ts";
export { executeBroadcast } from "./broadcast.ts";
