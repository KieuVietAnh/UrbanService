import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { Text } from '@/components/ui/Text';
import { semantics } from '@/theme/semantics';

export interface AppEmptyStateProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function AppEmptyState({ children, style, textStyle, icon, action }: AppEmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      {icon && <View style={styles.iconWrap}>{icon}</View>}
      <Text style={[styles.text, textStyle]}>{children}</Text>
      {action && <View style={styles.actionWrap}>{action}</View>}
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
  iconWrap: {
    marginBottom: 16,
    width: 64,
    height: 64,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: semantics.border.publicBorder,
    backgroundColor: semantics.bg.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    textAlign: 'center',
    fontSize: 15,
    color: semantics.text.muted,
    fontFamily: 'Geist-Regular',
    lineHeight: 22,
  },
  actionWrap: {
    marginTop: 16,
  },
});

export default AppEmptyState;
