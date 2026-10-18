import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ViewStyle,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles } from '@/lib/theme-context';
import { Ionicons } from '@expo/vector-icons';

export interface SelectOption {
  value: string;
  label: string;
  subLabel?: string;
  badge?: string;
}

interface SelectProps {
  label?: string;
  placeholder?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  containerStyle?: ViewStyle;
  disabled?: boolean;
  error?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  clearable?: boolean;
}

export function Select({
  label,
  placeholder = 'Select option...',
  value,
  options,
  onChange,
  searchable = false,
  searchPlaceholder = 'Search...',
  containerStyle,
  disabled = false,
  error,
  icon,
  clearable = false,
}: SelectProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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
      triggerWrapper: {
        minHeight: 48,
        backgroundColor: c.inputBackground || c.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: c.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 8,
      },
      triggerWrapperFocused: {
        borderColor: c.borderFocus,
        backgroundColor: dark ? '#16161A' : '#F9F9FB',
      },
      triggerWrapperError: {
        borderColor: c.statusCancelled,
      },
      triggerDisabled: {
        opacity: 0.5,
      },
      triggerLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 8,
      },
      icon: {
        marginRight: 10,
      },
      selectedContent: {
        flex: 1,
      },
      selectedLabel: {
        color: c.text,
        fontSize: 14,
        fontWeight: '600',
      },
      selectedSubLabel: {
        color: c.textSecondary,
        fontSize: 11,
        marginTop: 1,
      },
      placeholderText: {
        color: c.textTertiary,
        fontSize: 14,
      },
      triggerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      },
      badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        backgroundColor: c.secondary,
      },
      badgeText: {
        color: c.text,
        fontSize: 10,
        fontWeight: '700',
      },
      pickerBackdrop: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: dark ? 'rgba(0, 0, 0, 0.62)' : 'rgba(0, 0, 0, 0.45)',
      },
      pickerAlign: {
        flex: 1,
        justifyContent: 'flex-end',
      },
      pickerSheet: {
        maxHeight: '72%',
        backgroundColor: c.cardElevated,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        borderWidth: 1,
        borderColor: c.borderMedium,
        paddingHorizontal: 18,
        paddingTop: 18,
        overflow: 'hidden',
      },
      pickerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      },
      pickerTitle: {
        color: c.text,
        fontSize: 15,
        fontWeight: '800',
        flex: 1,
        marginRight: 12,
      },
      searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
        backgroundColor: c.card,
        borderRadius: 8,
        marginBottom: 8,
      },
      searchInput: {
        flex: 1,
        color: c.text,
        fontSize: 13,
        paddingVertical: 2,
      },
      dropdownScroll: {
        flexGrow: 1,
        flexShrink: 1,
        maxHeight: 430,
        minHeight: 40,
      },
      dropdownContent: {
        paddingVertical: 4,
      },
      emptyContainer: {
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
      },
      emptyText: {
        color: c.textTertiary,
        fontSize: 12,
      },
      optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
      },
      optionRowSelected: {
        backgroundColor: dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
      },
      optionDetails: {
        flex: 1,
        marginRight: 10,
      },
      optionLabel: {
        color: c.text,
        fontSize: 13.5,
        fontWeight: '500',
      },
      optionLabelSelected: {
        color: c.text,
        fontWeight: '700',
      },
      optionSubLabel: {
        color: c.textSecondary,
        fontSize: 11,
        marginTop: 2,
      },
      optionRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      },
      optionBadge: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 5,
        backgroundColor: c.secondary,
      },
      optionBadgeText: {
        color: c.textSecondary,
        fontSize: 10,
        fontWeight: '600',
      },
      errorText: {
        fontSize: 11.5,
        color: c.statusCancelled,
        marginTop: 4,
      },
    })
  );

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(term) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(term)) ||
        (opt.badge && opt.badge.toLowerCase().includes(term)),
    );
  }, [options, searchable, searchTerm]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      {/* Trigger Box */}
      <TouchableOpacity
        activeOpacity={0.7}
        disabled={disabled}
        onPress={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            if (isOpen) setSearchTerm('');
          }
        }}
        style={[
          styles.triggerWrapper,
          isOpen && styles.triggerWrapperFocused,
          Boolean(error) && styles.triggerWrapperError,
          disabled && styles.triggerDisabled,
        ]}
      >
        <View style={styles.triggerLeft}>
          {icon ? (
            <Ionicons
              name={icon}
              size={18}
              color={isOpen ? colors.text : colors.textSecondary}
              style={styles.icon}
            />
          ) : null}
          {selectedOption ? (
            <View style={styles.selectedContent}>
              <Text style={styles.selectedLabel} numberOfLines={1}>
                {selectedOption.label}
              </Text>
              {selectedOption.subLabel ? (
                <Text style={styles.selectedSubLabel} numberOfLines={1}>
                  {selectedOption.subLabel}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.placeholderText} numberOfLines={1}>
              {placeholder}
            </Text>
          )}
        </View>

        <View style={styles.triggerRight}>
          {clearable && Boolean(value) && !disabled ? (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ marginRight: 6 }}
            >
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          ) : null}
          {selectedOption?.badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{selectedOption.badge}</Text>
            </View>
          ) : null}
          <Ionicons
            name={isOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={isOpen ? colors.text : colors.textSecondary}
          />
        </View>
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable style={styles.pickerBackdrop} onPress={() => setIsOpen(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[styles.pickerAlign, { paddingBottom: Math.max(insets.bottom, 12) }]}
          >
            <Pressable style={styles.pickerSheet} onPress={(event) => event.stopPropagation()}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>{label || placeholder}</Text>
                <TouchableOpacity onPress={() => { setIsOpen(false); setSearchTerm(''); }} hitSlop={10}>
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              {searchable ? (
                <View style={styles.searchBox}>
                  <Ionicons
                    name="search-outline"
                    size={16}
                    color={colors.textSecondary}
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    placeholder={searchPlaceholder}
                    placeholderTextColor={colors.textTertiary}
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                    style={styles.searchInput}
                    autoFocus
                  />
                  {searchTerm ? (
                    <TouchableOpacity onPress={() => setSearchTerm('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}

              <FlatList
                data={filteredOptions}
                keyExtractor={(item) => item.value}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
                style={styles.dropdownScroll}
                contentContainerStyle={styles.dropdownContent}
                ListEmptyComponent={(
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                      {searchTerm ? `No matches for "${searchTerm}"` : 'No options available'}
                    </Text>
                  </View>
                )}
                renderItem={({ item: opt, index: i }) => {
                  const isSelected = opt.value === value;
                  return (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => handleSelect(opt.value)}
                      style={[
                        styles.optionRow,
                        isSelected && styles.optionRowSelected,
                        i === filteredOptions.length - 1 && { borderBottomWidth: 0 },
                      ]}
                    >
                      <View style={styles.optionDetails}>
                        <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]} numberOfLines={1}>
                          {opt.label}
                        </Text>
                        {opt.subLabel ? <Text style={styles.optionSubLabel} numberOfLines={1}>{opt.subLabel}</Text> : null}
                      </View>
                      <View style={styles.optionRight}>
                        {opt.badge ? <View style={styles.optionBadge}><Text style={styles.optionBadgeText}>{opt.badge}</Text></View> : null}
                        {isSelected ? <Ionicons name="checkmark" size={18} color={colors.text} /> : null}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}
