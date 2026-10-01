import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { Text } from '@/components/ui/Text';
import { AppButton } from '@/components/ui/AppButton';
import { semantics } from '@/theme/semantics';

export interface AppErrorStateProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  onRetry?: () => void;
  retryText?: string;
}

export function AppErrorState({
  children,
  style,
  textStyle,
  onRetry,
  retryText = 'Thử lại',
}: AppErrorStateProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.text, textStyle]}>{children}</Text>
      {onRetry && (
        <AppButton variant="outline" size="sm" onPress={onRetry}>
          {retryText}
        </AppButton>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  text: {
    textAlign: 'center',
    fontSize: 15,
    color: semantics.text.danger,
    fontFamily: 'Geist-Regular',
    marginBottom: 16,
    lineHeight: 22,
  },
});

export default AppErrorState;
