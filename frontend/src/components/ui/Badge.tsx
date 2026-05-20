interface BadgeProps { status: string; text?: string; }

const statusMap: Record<string, string> = {
  active: 'badge-active',
  pending: 'badge-pending',
  closed: 'badge-closed',
  rejected: 'badge-rejected',
  overdue: 'badge-overdue',
  paid: 'badge-active',
  partial: 'badge-pending',
  written_off: 'badge-closed',
};

export default function Badge({ status, text }: BadgeProps) {
  const cls = statusMap[status] || 'badge-pending';
  return <span className={cls}>{text || status.replace('_', ' ')}</span>;
}
