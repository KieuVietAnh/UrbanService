// Thin wrapper ensuring Geist font is always applied to all Text elements
import React from 'react';
import { Text as RNText, TextProps } from 'react-native';

interface Props extends TextProps {
  className?: string;
}

export function Text({ className = '', style, ...props }: Props) {
  return (
    <RNText
      className={['font-sans', className].join(' ')}
      style={style}
      {...props}
    />
  );
}

export default Text;
