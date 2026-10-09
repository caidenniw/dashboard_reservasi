import { statusLabel, statusBadgeClass } from "@/lib/format";

/** Badge status — markup sama dengan statusBadge() di helpers.php. */
export function BadgeStatus({ status }: { status: string }) {
    return <span className={`badge-pill pill-${statusBadgeClass(status)}`}>{statusLabel(status)}</span>;
}
