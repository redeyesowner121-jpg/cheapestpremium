// ===== ESCROW HANDLER — barrel re-exports (split for maintainability) =====

export {
  STATUS_EMOJI,
  STATUS_LABEL,
  type EscrowCounterparty,
  resolveEscrowCounterparty,
  resolveTgIdForProfile,
  notifyOther,
} from "./escrow/shared.ts";

export {
  handleEscrowCommand,
  escrowStartCreate,
  escrowHandleIdentifierInput,
  escrowHandleAmountInput,
  escrowHandleDescriptionInput,
} from "./escrow/menu-create.ts";

export {
  escrowListDeals,
  escrowViewDeal,
} from "./escrow/list-view.ts";

export {
  escrowAction,
  escrowDeliverSkip,
  escrowHandleDeliveryNote,
  escrowHandleDisputeReason,
  escrowHandleChatMessage,
} from "./escrow/actions.ts";
