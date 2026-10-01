import React, { useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from 'react-native';
import { colors } from '@/constants/theme';

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
}

export function OTPInput({ length = 6, value, onChange, error = false }: OTPInputProps) {
  const inputs = useRef<(TextInput | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  const focusNext = (index: number) => {
    if (index < length - 1) {
      setTimeout(() => {
        inputs.current[index + 1]?.focus();
      }, 30);
    }
  };

  const focusPrev = (index: number) => {
    if (index > 0) {
      setTimeout(() => {
        inputs.current[index - 1]?.focus();
      }, 30);
    }
  };

  const handleChange = (text: string, index: number) => {
    const cleanedText = text.replace(/\D/g, '');
    
    // Handle paste (if text length is 5 or more)
    if (cleanedText.length >= 5) {
      const cleaned = cleanedText.slice(0, length);
      onChange(cleaned);
      inputs.current[Math.min(cleaned.length, length - 1)]?.focus();
      return;
    }

    // Get the last typed character
    const char = cleanedText.charAt(cleanedText.length - 1);
    const next = Array.from({ length }, (_, i) => {
      if (i === index) return char;
      return value[i] || '';
    }).join('');
    onChange(next);

    if (char) {
      focusNext(index);
    }
  };

  const handleKeyPress = (
    { nativeEvent: { key } }: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number
  ) => {
    if (key === 'Backspace' && !value[index]) {
      const next = value.slice(0, Math.max(0, index - 1)) + value.slice(index);
      onChange(next);
      focusPrev(index);
    }
  };

  useEffect(() => {
    setTimeout(() => inputs.current[0]?.focus(), 300);
  }, []);

  return (
    <View style={styles.row}>
      {Array.from({ length }).map((_, i) => {
        const filled = Boolean(digits[i]);

        return (
          <TextInput
            key={i}
            ref={(ref) => { inputs.current[i] = ref; }}
            style={[
              styles.cell,
              filled && styles.cellFilled,
              error && styles.cellError,
            ]}
            value={digits[i]}
            onChangeText={(t) => handleChange(t, i)}
            onKeyPress={(e) => handleKeyPress(e, i)}
            keyboardType="number-pad"
            maxLength={i === 0 ? length : 2}
            selectTextOnFocus
            textAlign="center"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  cell: {
    width: 48,
    height: 56,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    fontSize: 22,
    fontFamily: 'Geist-Bold',
    color: '#0F172A',
    textAlign: 'center',
  },
  cellFilled: {
    borderColor: colors.primary,
    backgroundColor: '#EFF6FF',
    color: colors.primary,
  },
  cellError: {
    borderColor: colors.red,
    backgroundColor: '#FEE2E2',
  },
});

export default OTPInput;
