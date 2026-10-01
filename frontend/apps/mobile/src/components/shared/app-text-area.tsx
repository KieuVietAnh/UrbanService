import { TextInput, View, StyleSheet, StyleProp, TextStyle, ViewStyle, TextInputProps } from 'react-native';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';

interface AppTextAreaProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  rows?: number;
}

export const AppTextArea = ({
  label,
  placeholder = '',
  error,
  containerStyle,
  inputStyle,
  rows = 4,
  ...props
}: AppTextAreaProps) => {
  const hasError = Boolean(error);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, hasError && { color: colors.red }]}>
          {label}
        </Text>
      )}
      <TextInput
        {...props}
        placeholder={placeholder}
        placeholderTextColor={colors.lightMuted}
        multiline
        numberOfLines={rows}
        textAlignVertical="top"
        style={[
          styles.input,
          { borderColor: hasError ? colors.red : colors.border },
          { height: rows * 22 + 24 },
          inputStyle,
        ]}
      />
      {error && (
        <Text style={styles.error}>{error}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontFamily: 'Geist-Medium',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    fontSize: 15,
    fontFamily: 'Geist-Regular',
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  error: {
    fontSize: 12,
    fontFamily: 'Geist-Regular',
    color: '#EF4444',
    marginTop: 4,
  },
});
