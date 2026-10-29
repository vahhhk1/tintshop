import { Badge, type BadgeVariant } from "@/components/ui/badge";

const MAPS = {
  appointment: {
    PENDING: ["Pending", "warning"],
    CONFIRMED: ["Confirmed", "info"],
    DEPOSIT_PAID: ["Deposit paid", "violet"],
    IN_PROGRESS: ["In progress", "default"],
    COMPLETED: ["Completed", "success"],
    CANCELLED: ["Cancelled", "neutral"],
    NO_SHOW: ["No show", "danger"],
  },
  quote: {
    NEW: ["New", "warning"],
    CONTACTED: ["Contacted", "info"],
    ESTIMATE_SENT: ["Estimate sent", "violet"],
    APPROVED: ["Approved", "success"],
    DECLINED: ["Declined", "neutral"],
    CONVERTED: ["Converted to appointment", "default"],
  },
  payment: {
    PENDING: ["Pending", "warning"],
    SUCCEEDED: ["Paid", "success"],
    FAILED: ["Failed", "danger"],
    REFUNDED: ["Refunded", "neutral"],
    CANCELLED: ["Cancelled", "neutral"],
  },
  review: {
    PENDING: ["Pending", "warning"],
    APPROVED: ["Approved", "success"],
    REJECTED: ["Rejected", "danger"],
  },
  contact: {
    NEW: ["New", "warning"],
    READ: ["Read", "info"],
    REPLIED: ["Replied", "success"],
    ARCHIVED: ["Archived", "neutral"],
  },
} as const satisfies Record<string, Record<string, readonly [string, BadgeVariant]>>;

export type StatusKind = keyof typeof MAPS;

export function statusLabel(kind: StatusKind, status: string) {
  return (MAPS[kind] as Record<string, readonly [string, BadgeVariant]>)[status]?.[0] ?? status;
}

export function StatusBadge({ kind, status, className }: { kind: StatusKind; status: string; className?: string }) {
  const entry = (MAPS[kind] as Record<string, readonly [string, BadgeVariant]>)[status];
  return (
    <Badge variant={entry?.[1] ?? "neutral"} className={className}>
      {entry?.[0] ?? status}
    </Badge>
  );
}

export function statusOptions(kind: StatusKind) {
  return Object.entries(MAPS[kind]).map(([value, [label]]) => ({ value, label }));
}
