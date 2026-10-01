import React from 'react';
import { StaffExecutionFlowScreen } from '@/features/staff/components/staff-execution-flow-screen';

export default function IncidentResolution() {
  return <StaffExecutionFlowScreen initialStep="evidence" />;
}
