import React from 'react';
import { Redirect } from 'expo-router';

export default function CreateRedirect() {
  return <Redirect href="/(resident)/create-feedback-wizard" />;
}
