import React from 'react';
import { AppInput } from '@/components/ui/AppInput';
import { ComponentProps } from 'react';

export type PasswordInputProps = Omit<ComponentProps<typeof AppInput>, 'isPassword'>;

export function PasswordInput(props: PasswordInputProps) {
  return <AppInput isPassword leftIcon="lock" {...props} />;
}

export default PasswordInput;
