import React from "react";
import Sheet from "./Sheet";
import Button from "./Button";
import HoldButton from "./HoldButton";
import "./ConfirmSheet.css";

/**
 * ConfirmSheet — Sheet preset for mobile confirms (§8).
 *
 * Restates the evidence (who/what/amount) in `message`, one confirm action
 * + Cancel. `hold` swaps the confirm Button for HoldButton (money-touch,
 * e.g. the §6.4 mark-as-paid sheet). `busy` = working state: holds the
 * sheet open (via Sheet) and shows the confirm button loading.
 */
export default function ConfirmSheet({
  open = false,
  onClose,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  danger = false,
  hold = false,
  busy = false,
  children,
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title} danger={danger} busy={busy}>
      <div className="ui-confirm-sheet">
        {message ? <p className="ui-confirm-sheet__message">{message}</p> : null}
        {children}
        <div className="ui-confirm-sheet__actions">
          {hold ? (
            <HoldButton
              label={confirmLabel}
              onConfirm={onConfirm}
              variant={danger ? "destructive" : "brand"}
            />
          ) : (
            <Button
              variant={danger ? "destructive" : "primary"}
              size="lg"
              fullWidth
              loading={busy}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          )}
          <Button
            variant="ghost"
            size="lg"
            fullWidth
            disabled={busy}
            onClick={onClose}
          >
            {cancelLabel}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
