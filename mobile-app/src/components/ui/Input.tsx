import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import { useTheme, useThemedStyles } from '@/lib/theme-context';
import { Ionicons } from '@expo/vector-icons';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  icon?: keyof typeof Ionicons.glyphMap;
  isPassword?: boolean;
}

export function Input({
  label,
  error,
  containerStyle,
  icon,
  isPassword = false,
  style,
  ...props
}: InputProps) {
  const { colors, isDark } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const styles = useThemedStyles((c, dark) =>
    StyleSheet.create({
      container: {
        marginBottom: 14,
      },
      label: {
        fontSize: 12.5,
        fontWeight: '600',
        color: c.textSecondary,
        marginBottom: 6,
        letterSpacing: 0.2,
      },
      inputWrapper: {
        height: 48,
        backgroundColor: c.inputBackground || c.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: c.border,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
      },
      inputWrapperFocused: {
        borderColor: c.borderFocus,
        backgroundColor: dark ? '#16161A' : '#F9F9FB',
      },
      inputWrapperError: {
        borderColor: c.statusCancelled,
      },
      input: {
        flex: 1,
        height: '100%',
        color: c.text,
        fontSize: 14.5,
      },
      icon: {
        marginRight: 10,
      },
      eyeBtn: {
        padding: 4,
      },
      errorText: {
        fontSize: 11.5,
        color: c.statusCancelled,
        marginTop: 4,
      },
    })
  );

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputWrapperFocused,
          Boolean(error) && styles.inputWrapperError,
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={isFocused ? colors.text : colors.textSecondary}
            style={styles.icon}
          />
        ) : null}
        <TextInput
          placeholderTextColor={colors.textTertiary}
          style={[styles.input, style]}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isPassword && !showPassword}
          {...props}
        />
        {isPassword ? (
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowPassword(!showPassword)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}
