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

  const labelMap = {
    draft: 'Draft',
    recipient_matching: 'Asta',
    recipient_options_ready: 'Selezione',
    recipient_selected: 'Selezione',
    transporter_matching: 'Pianificazione',
    package_options_ready: 'Pianificazione',
    package_selected: 'Pianificazione',
    assigned: 'Working',
    in_execution: 'Working',
    delivered: 'Delivered',
    completed: 'Completed',
    cancelled: 'Hold',
    expired: 'Hold',
  };

  return <Badge tone={toneMap[status] || 'neutral'}>{labelMap[status] || status}</Badge>;
}
