import React from 'react';
import { Redirect } from 'expo-router';

export default function VerifyEmailRedirect() {
  return <Redirect href="/(auth)/verify-phone" />;
}
