import { View, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import type { ComponentProps } from 'react';

const inputStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#fafafa',
    marginBottom: 16,
    paddingHorizontal: 14,
    minHeight: 48,
    ...(Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
  iconWrap: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    paddingVertical: 12,
    ...(Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
  eyeWrap: { padding: 4 },
});

type Props = ComponentProps<typeof TextInput> & {
  leftIcon: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightPress?: () => void;
};

export function AuthInput({ leftIcon, rightIcon, onRightPress, style, ...rest }: Props) {
  return (
    <View style={inputStyles.wrap}>
      <View style={inputStyles.iconWrap} pointerEvents="none">
        {leftIcon}
      </View>
      <TextInput
        style={[inputStyles.input, style]}
        placeholderTextColor="#9ca3af"
        {...rest}
      />
      {rightIcon != null && (
        <TouchableOpacity style={inputStyles.eyeWrap} onPress={onRightPress} activeOpacity={0.7}>
          {rightIcon}
        </TouchableOpacity>
      )}
    </View>
  );
}
