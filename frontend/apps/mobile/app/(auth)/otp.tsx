import React from 'react';
import { Redirect } from 'expo-router';

export default function LegacyOtpRedirect() {
  return <Redirect href="/(auth)/verify-phone" />;
}
