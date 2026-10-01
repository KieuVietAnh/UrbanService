import React from 'react';
import { StaffExecutionFlowScreen } from './staff-execution-flow-screen';

/** Compatibility entry: evidence and resolution now continue inside the unified execution flow. */
export function StaffResolutionScreen() {
  return <StaffExecutionFlowScreen initialStep="evidence" />;
}
