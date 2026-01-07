// ═══════════════════════════════════════════════════════════════════════════════
// CONFIRMATION BUTTONS — Chat Action Buttons
// Renders confirm/cancel buttons for pending actions in chat
// ═══════════════════════════════════════════════════════════════════════════════

import { useChatStore } from '@/shared/stores';
import { useHaptic } from '@/shared/hooks';
import type { PendingAction } from '@/shared/types';

interface ConfirmationButtonsProps {
  messageId: string;
  pendingAction: PendingAction;
}

export function ConfirmationButtons({ messageId, pendingAction }: ConfirmationButtonsProps) {
  const { confirmPendingAction, cancelPendingAction } = useChatStore();
  const haptic = useHaptic();

  const handleConfirm = () => {
    haptic('medium');
    confirmPendingAction(messageId);
  };

  const handleCancel = () => {
    haptic('light');
    cancelPendingAction(messageId);
  };

  return (
    <div className="flex gap-2 mt-4">
      {/* Confirm Button - Primary */}
      <button
        onClick={handleConfirm}
        className="flex-1 py-2.5 px-4 bg-green-500 text-black font-medium text-sm rounded-full active:opacity-80 transition-opacity"
      >
        {pendingAction.confirmText}
      </button>
      
      {/* Cancel Button - Secondary */}
      <button
        onClick={handleCancel}
        className="py-2.5 px-4 bg-white/10 text-white/70 font-medium text-sm rounded-full active:bg-white/20 transition-colors"
      >
        {pendingAction.cancelText}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// ACTION TAKEN INDICATOR
// Shows after user confirms/cancels
// ─────────────────────────────────────────────────────────────────────────────────

interface ActionTakenProps {
  action: 'confirmed' | 'cancelled';
}

export function ActionTakenIndicator({ action }: ActionTakenProps) {
  if (action === 'confirmed') {
    return (
      <div className="flex items-center gap-2 mt-3 text-green-400 text-sm">
        <span>✓</span>
        <span>Opening learning plan...</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-2 mt-3 text-white/30 text-sm">
      <span>—</span>
      <span>No problem! Let me know if you change your mind.</span>
    </div>
  );
}
