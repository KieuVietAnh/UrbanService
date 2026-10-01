import React from 'react';
import { Redirect } from 'expo-router';

export default function LegacyCommunityRedirect() {
  return <Redirect href="/(resident)/community" />;
}
