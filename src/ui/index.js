/**
 * src/ui barrel — the ONE component library (§8).
 * Named re-exports for every component plus the utility exports
 * (toast emitter, derivePresence, formatRegNo, useFocusTrap).
 */

export { default as Accordion } from "./Accordion";
export { default as ActionBar } from "./ActionBar";
export { default as Avatar } from "./Avatar";
export { default as Banner } from "./Banner";
export { default as Button } from "./Button";
export { default as Card } from "./Card";
export {
  default as CelebrationCheck,
  CelebrationBurst,
  prefersReducedMotion,
} from "./CelebrationCheck";
export { default as Chip } from "./Chip";
export { default as ConfirmPopover } from "./ConfirmPopover";
export { default as ConfirmSheet } from "./ConfirmSheet";
export { default as Dialog } from "./Dialog";
export { default as DomainToggle } from "./DomainToggle";
export { default as Drawer } from "./Drawer";
export { default as EmptyState } from "./EmptyState";
export { default as HoldButton } from "./HoldButton";
export { Input, Select, Textarea } from "./Input";
export { default as OfflineBanner } from "./OfflineBanner";
export { default as Pill } from "./Pill";
export { default as PresenceDot, derivePresence } from "./PresenceDot";
export { default as QRPanel } from "./QRPanel";
export { default as ResultRow } from "./ResultRow";
export { default as SearchField } from "./SearchField";
export { default as Sheet } from "./Sheet";
export { default as Skeleton } from "./Skeleton";
export { default as SpectrumDots } from "./SpectrumDots";
export { default as Stamp } from "./Stamp";
export { default as StatTile } from "./StatTile";
export { default as TableRow } from "./TableRow";
export { default as Ticket, formatRegNo } from "./Ticket";
export { default as Toast } from "./Toast";
export { default as ToastHost, toast } from "./ToastHost";
export { default as TopBar } from "./TopBar";
export { default as useFocusTrap } from "./useFocusTrap";
