import React from 'react';
import { StaffExecutionFlowScreen } from './staff-execution-flow-screen';

/** Compatibility entry: provider work now continues inside the unified execution flow. */
export function StaffProviderScreen() {
  return <StaffExecutionFlowScreen initialStep="provider" />;
}
