import React from 'react';
import { Redirect } from 'expo-router';

export default function VerifyPhoneRedirect() {
  return <Redirect href="/(auth)/verify-email" />;
}
