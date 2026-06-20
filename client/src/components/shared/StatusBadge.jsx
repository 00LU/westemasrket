import Badge from '../ui/Badge';

export default function StatusBadge({ status }) {
  const toneMap = {
    active: 'success',
    recipient_matching: 'warning',
    recipient_options_ready: 'success',
    recipient_selected: 'success',
    transporter_matching: 'warning',
    package_options_ready: 'success',
    package_selected: 'success',
    assigned: 'success',
    in_execution: 'warning',
    delivered: 'neutral',
    completed: 'success',
    cancelled: 'danger',
    expired: 'danger',
    pending: 'warning',
    closed: 'neutral',
    critical: 'danger',
  };

  return <Badge tone={toneMap[status] || 'neutral'}>{status}</Badge>;
}
