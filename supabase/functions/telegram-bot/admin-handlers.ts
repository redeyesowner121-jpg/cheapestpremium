// ===== ADMIN HANDLERS - Re-exports from split modules =====

export {
  handleAdminMenu, handleReport, executeBroadcast, handleBotSettings, handleSetMinReferral,
  handleAdminProductsMenu, handleAdminUsersMenu, handleAdminWalletMenu,
  handleAdminChannelsMenu, handleAdminOwnerMenu,
  handleAdminSettingsMenu, handleSettingsCategory, promptSettingEdit, saveSetting,
} from "./admin/admin-menu.ts";
export { handleEditPrice, handleOutStock } from "./admin/admin-products.ts";
export {
  handleUsersCommand, handleHistoryCommand, handleBanCommand,
  handleMakeReseller, handleAddAdmin, handleRemoveAdmin,
  handleListAdmins, handleAllUsers,
} from "./admin/admin-users.ts";
export { handleAddBalance, handleDeductBalance } from "./admin/admin-wallet.ts";
export { handleListChannels, handleAddChannel, handleRemoveChannel } from "./admin/admin-channels.ts";
