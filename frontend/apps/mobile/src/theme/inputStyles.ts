import { StyleSheet } from 'react-native';
import { semantics } from './semantics';
import { radius } from './radius';

export const inputStyles = StyleSheet.create({
  label: {
    fontFamily: 'Geist-Medium',
    fontSize: 12,
    color: semantics.text.secondary,
    marginBottom: 7,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: semantics.bg.input,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  input: {
    fontFamily: 'Geist-Regular',
    fontSize: 15,
    color: semantics.text.primary,
    paddingTop: 2,
    paddingBottom: 2,
    paddingLeft: 0,
  },
  inputWrap: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  inputWithLeftIcon: {
    paddingLeft: 0,
  },
  inputError: {
    backgroundColor: semantics.feedback.error.bg,
    borderColor: semantics.feedback.error.border,
  },
  leftIcon: {
    marginRight: 10,
    marginTop: 4,
  },
  rightIconWrap: {
    marginLeft: 8,
    padding: 4,
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'Geist-Medium',
    color: semantics.feedback.error.text,
  },
});

export type InputStyles = typeof inputStyles;
