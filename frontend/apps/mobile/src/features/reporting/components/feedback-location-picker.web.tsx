import React, { forwardRef, useImperativeHandle } from 'react';
import { View } from 'react-native';
import type { FeedbackLocationMapHandle, FeedbackLocationPickerProps } from './reporting-map.types';

const FeedbackLocationPicker = forwardRef<FeedbackLocationMapHandle, FeedbackLocationPickerProps>((_props, ref) => {
  useImperativeHandle(ref, () => ({
    animateToRegion: () => undefined,
    fitToCoordinates: () => undefined,
  }));

  return <View style={{ width: '100%', height: 300, borderRadius: 16 }} />;
});

FeedbackLocationPicker.displayName = 'FeedbackLocationPicker';

export default FeedbackLocationPicker;
