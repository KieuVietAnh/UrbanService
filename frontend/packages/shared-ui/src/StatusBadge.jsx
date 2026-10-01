import { managementTypes } from '@urbanmind/shared-types';

export default function StatusBadge({ status }) {
  const label = status || 'Unknown';
  const cls = {
    [managementTypes.feedbackStatus.SUBMITTED]: 'badge badge-info',
    [managementTypes.feedbackStatus.AI_REVIEWED]: 'badge badge-warning',
    [managementTypes.feedbackStatus.ASSIGNED]: 'badge badge-primary',
    [managementTypes.feedbackStatus.IN_PROGRESS]: 'badge badge-accent',
    [managementTypes.feedbackStatus.RESOLVED]: 'badge badge-success',
    [managementTypes.feedbackStatus.CLOSED]: 'badge badge-neutral',
  }[status] || 'badge';

  return <span className={`${cls} text-[10px] font-bold`}>{label}</span>;
}
