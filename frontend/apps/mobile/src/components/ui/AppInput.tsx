import React, { useState } from 'react';
import {
  TextInput,
  TextInputProps,
  View,
  Pressable,
} from 'react-native';
import Icon from '@expo/vector-icons/Feather';
import { Text } from './Text';
import { semantics } from '@/theme/semantics';
import { inputStyles } from '@/theme/inputStyles';

interface AppInputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  leftIcon?: keyof typeof Icon.glyphMap;
  rightIcon?: keyof typeof Icon.glyphMap;
  onRightIconPress?: () => void;
  isPassword?: boolean;
  containerClassName?: string;
}

export function AppInput({
  label,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  isPassword = false,
  containerClassName = '',
  value,
  onFocus,
  onBlur,
  ...props
}: AppInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  const borderColor = error
    ? semantics.feedback.error.border
    : semantics.border.default;

  const passwordIcon = showPassword ? 'eye-off' : 'eye';

  return (
    <View className={`mb-4 ${containerClassName}`}>
      <Text style={inputStyles.label}>{label}</Text>
      <View
        style={[
          inputStyles.container,
          { borderColor },
          Boolean(error) && inputStyles.inputError,
        ]}
      >
        {leftIcon && (
          <Icon
            name={leftIcon}
            size={18}
            color={semantics.text.muted}
            style={inputStyles.leftIcon}
          />
        )}

        <View style={inputStyles.inputWrap}>
          <TextInput
            style={[
              inputStyles.input,
              leftIcon ? inputStyles.inputWithLeftIcon : null,
            ]}
            value={value}
            onFocus={(e) => {
              onFocus?.(e);
            }}
            onBlur={(e) => {
              onBlur?.(e);
            }}
            placeholderTextColor={semantics.text.lightMuted}
            secureTextEntry={isPassword && !showPassword}
            placeholder={label}
            {...props}
          />
        </View>

        {isPassword ? (
          <Pressable
            onPress={() => setShowPassword((v) => !v)}
            style={inputStyles.rightIconWrap}
            hitSlop={8}
          >
            <Icon name={passwordIcon} size={18} color={semantics.text.muted} />
          </Pressable>
        ) : rightIcon ? (
          <Pressable
            onPress={onRightIconPress}
            style={inputStyles.rightIconWrap}
            hitSlop={8}
          >
            <Icon name={rightIcon} size={18} color={semantics.text.muted} />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <View className="flex-row items-center gap-1.5 mt-1.5 ml-1">
          <Icon name="alert-circle" size={13} color={semantics.feedback.error.icon} />
          <Text style={inputStyles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default AppInput;
