import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles } from '@/lib/theme-context';
import { Ionicons } from '@expo/vector-icons';

interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxHeightPercent?: number;
}

export function BottomSheetModal({
  visible,
  onClose,
  title,
  subtitle,
  children,
  maxHeightPercent = 0.88,
}: BottomSheetModalProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const styles = useThemedStyles((c, dark) =>
    StyleSheet.create({
      backdrop: {
        flex: 1,
        backgroundColor: dark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(0, 0, 0, 0.45)',
        justifyContent: 'flex-end',
      },
      sheet: {
        backgroundColor: c.cardElevated,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        borderWidth: 1,
        borderColor: c.borderMedium,
        overflow: 'hidden',
      },
      handleContainer: {
        alignItems: 'center',
        paddingTop: 10,
        paddingBottom: 6,
      },
      handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: dark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.18)',
      },
      header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
      },
      titleArea: {
        flex: 1,
      },
      title: {
        fontSize: 17,
        fontWeight: '800',
        color: c.text,
        letterSpacing: -0.2,
      },
      subtitle: {
        fontSize: 12,
        color: c.textSecondary,
        marginTop: 2,
      },
      closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: c.secondary,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 12,
      },
      content: {
        flexGrow: 0,
      },
      contentContainer: {
        padding: 20,
        paddingBottom: 36,
      },
    })
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={[
                styles.sheet,
                {
                  maxHeight: `${Math.round(maxHeightPercent * 100)}%`,
                  paddingBottom: Math.max(insets.bottom, 16),
                },
              ]}
            >
              {/* Drag Handle Indicator */}
              <View style={styles.handleContainer}>
                <View style={styles.handle} />
              </View>

              {/* Header */}
              <View style={styles.header}>
                <View style={styles.titleArea}>
                  <Text style={styles.title}>{title}</Text>
                  {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Body */}
              <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
