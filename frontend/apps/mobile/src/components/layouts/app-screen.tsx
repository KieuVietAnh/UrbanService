import React from 'react';
import { View, ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface AppScreenProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
  safe?: boolean;
}

export function AppScreen({ children, className = '', safe = true, ...props }: AppScreenProps) {
  const Wrapper = safe ? SafeAreaView : View;

  return (
    <Wrapper
      className={['flex-1 bg-background', className].join(' ')}
      {...(safe ? { edges: ['top'] as any } : {})}
      {...props}
    >
      {children}
    </Wrapper>
  );
}

export default AppScreen;