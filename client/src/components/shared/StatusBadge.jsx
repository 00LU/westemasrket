import Badge from '../ui/Badge';
import { REQUEST_STATUS_LABELS, STAGE_LABELS } from '../../services/labels';

const TONES = {
  draft: 'neutral',
  awaiting_recipients: 'warning',
  awaiting_transporters: 'warning',
  packages_ready: 'success',
  in_agreement: 'warning',
  confirmed: 'success',
  cancelled: 'danger',
  to_respond: 'warning',
  responded: 'neutral',
  waiting: 'neutral',
  closed: 'neutral',
};

export default function StatusBadge({ status, kind = 'request' }) {
  const labels = kind === 'stage' ? STAGE_LABELS : REQUEST_STATUS_LABELS;
  return <Badge tone={TONES[status] || 'neutral'}>{labels[status] || status}</Badge>;
}
