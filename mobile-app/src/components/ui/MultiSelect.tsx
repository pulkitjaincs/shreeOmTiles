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

export interface MultiSelectOption {
  value: string;
  label: string;
  subLabel?: string;
  badge?: string;
}

interface MultiSelectProps {
  label?: string;
  placeholder?: string;
  values: string[];
  options: MultiSelectOption[];
  onChange: (values: string[]) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  containerStyle?: ViewStyle;
  disabled?: boolean;
  error?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  showTags?: boolean;
}

export function MultiSelect({
  label,
  placeholder = 'Select options...',
  values,
  options,
  onChange,
  searchable = true,
  searchPlaceholder = 'Search...',
  containerStyle,
  disabled = false,
  error,
  icon,
  showTags = true,
}: MultiSelectProps) {
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
      placeholderText: {
        color: c.textTertiary,
        fontSize: 14,
      },
      errorText: {
        color: c.statusCancelled,
        fontSize: 11.5,
        marginTop: 4,
        fontWeight: '500',
      },
      // Modal backdrop & sheet
      backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
      },
      keyboardContainer: {
        justifyContent: 'flex-end',
      },
      sheet: {
        backgroundColor: c.card,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
        borderWidth: 1,
        borderColor: c.border,
        borderBottomWidth: 0,
      },
      handleContainer: {
        alignItems: 'center',
        paddingVertical: 10,
      },
      handle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: c.border,
      },
      sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
      },
      sheetTitle: {
        color: c.text,
        fontSize: 16,
        fontWeight: '700',
      },
      doneBtn: {
        paddingVertical: 4,
        paddingHorizontal: 8,
      },
      doneBtnText: {
        color: c.primary,
        fontSize: 14,
        fontWeight: '700',
      },
      searchContainer: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
      },
      searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.inputBackground || c.background,
        borderRadius: 10,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: c.border,
      },
      searchInput: {
        flex: 1,
        color: c.text,
        fontSize: 13.5,
        paddingVertical: 8,
        paddingLeft: 6,
      },
      quickActionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
      },
      quickActionText: {
        fontSize: 12,
        color: c.primary,
        fontWeight: '600',
      },
      optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: c.border,
      },
      optionItemSelected: {
        backgroundColor: dark ? 'rgba(56, 189, 248, 0.1)' : 'rgba(14, 165, 233, 0.08)',
      },
      optionLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 10,
      },
      checkboxIcon: {
        marginRight: 12,
      },
      optionTextContainer: {
        flex: 1,
      },
      optionLabel: {
        fontSize: 14,
        color: c.text,
        fontWeight: '500',
      },
      optionLabelSelected: {
        color: c.primary,
        fontWeight: '700',
      },
      optionSubLabel: {
        fontSize: 12,
        color: c.textSecondary,
        marginTop: 2,
      },
      badge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: c.background,
        borderWidth: 1,
        borderColor: c.border,
      },
      badgeText: {
        fontSize: 10,
        color: c.textSecondary,
        fontWeight: '600',
      },
      emptyContainer: {
        paddingVertical: 32,
        alignItems: 'center',
      },
      emptyText: {
        color: c.textTertiary,
        fontSize: 13,
      },
      tagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 8,
      },
      tag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: dark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(14, 165, 233, 0.1)',
        borderWidth: 1,
        borderColor: dark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(14, 165, 233, 0.25)',
      },
      tagText: {
        fontSize: 11.5,
        color: c.primary,
        fontWeight: '600',
      },
    }),
  );

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(term) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(term)),
    );
  }, [options, searchTerm]);

  const toggleOption = (val: string) => {
    if (values.includes(val)) {
      onChange(values.filter((v) => v !== val));
    } else {
      onChange([...values, val]);
    }
  };

  const handleSelectAll = () => {
    const filteredVals = filteredOptions.map((o) => o.value);
    const combined = Array.from(new Set([...values, ...filteredVals]));
    onChange(combined);
  };

  const handleClear = () => {
    onChange([]);
  };

  const triggerLabel = useMemo(() => {
    if (values.length === 0) return null;
    if (values.length === 1) {
      const match = options.find((o) => o.value === values[0]);
      return match ? match.label : '1 selected';
    }
    const firstMatch = options.find((o) => o.value === values[0]);
    return `${firstMatch ? firstMatch.label : '1 item'} + ${values.length - 1} more (${values.length} selected)`;
  }, [values, options]);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <TouchableOpacity
        style={[
          styles.triggerWrapper,
          isOpen && styles.triggerWrapperFocused,
          Boolean(error) && styles.triggerWrapperError,
          disabled && styles.triggerDisabled,
        ]}
        onPress={() => {
          if (!disabled) {
            setSearchTerm('');
            setIsOpen(true);
          }
        }}
        activeOpacity={0.7}
      >
        <View style={styles.triggerLeft}>
          {icon ? (
            <Ionicons
              name={icon}
              size={18}
              color={colors.textSecondary}
              style={styles.icon}
            />
          ) : null}
          <View style={styles.selectedContent}>
            {triggerLabel ? (
              <Text style={styles.selectedLabel} numberOfLines={1}>
                {triggerLabel}
              </Text>
            ) : (
              <Text style={styles.placeholderText}>{placeholder}</Text>
            )}
          </View>
        </View>

        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textSecondary}
        />
      </TouchableOpacity>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Selected tags */}
      {showTags && values.length > 0 ? (
        <View style={styles.tagsRow}>
          {values.map((v) => {
            const opt = options.find((o) => o.value === v);
            if (!opt) return null;
            return (
              <View key={v} style={styles.tag}>
                <Text style={styles.tagText}>{opt.label}</Text>
                {!disabled ? (
                  <TouchableOpacity
                    onPress={() => toggleOption(v)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={14} color={colors.primary} />
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {/* Modal Picker */}
      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardContainer}
          >
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.handleContainer}>
                <View style={styles.handle} />
              </View>

              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{label || 'Select Options'}</Text>
                <TouchableOpacity onPress={() => setIsOpen(false)} style={styles.doneBtn}>
                  <Text style={styles.doneBtnText}>Done</Text>
                </TouchableOpacity>
              </View>

              {searchable ? (
                <View style={styles.searchContainer}>
                  <View style={styles.searchRow}>
                    <Ionicons name="search" size={16} color={colors.textTertiary} />
                    <TextInput
                      value={searchTerm}
                      onChangeText={setSearchTerm}
                      placeholder={searchPlaceholder}
                      placeholderTextColor={colors.textTertiary}
                      style={styles.searchInput}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {searchTerm ? (
                      <TouchableOpacity onPress={() => setSearchTerm('')}>
                        <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ) : null}

              <View style={styles.quickActionsRow}>
                <TouchableOpacity onPress={handleSelectAll}>
                  <Text style={styles.quickActionText}>Select All</Text>
                </TouchableOpacity>
                {values.length > 0 ? (
                  <TouchableOpacity onPress={handleClear}>
                    <Text style={[styles.quickActionText, { color: colors.statusCancelled }]}>
                      Clear All ({values.length})
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <FlatList
                data={filteredOptions}
                keyExtractor={(item) => item.value}
                renderItem={({ item }) => {
                  const isSelected = values.includes(item.value);
                  return (
                    <TouchableOpacity
                      style={[styles.optionItem, isSelected && styles.optionItemSelected]}
                      onPress={() => toggleOption(item.value)}
                    >
                      <View style={styles.optionLeft}>
                        <Ionicons
                          name={isSelected ? 'checkbox' : 'square-outline'}
                          size={20}
                          color={isSelected ? colors.primary : colors.textTertiary}
                          style={styles.checkboxIcon}
                        />
                        <View style={styles.optionTextContainer}>
                          <Text
                            style={[
                              styles.optionLabel,
                              isSelected && styles.optionLabelSelected,
                            ]}
                          >
                            {item.label}
                          </Text>
                          {item.subLabel ? (
                            <Text style={styles.optionSubLabel}>{item.subLabel}</Text>
                          ) : null}
                        </View>
                      </View>
                      {item.badge ? (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{item.badge}</Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No matching options found</Text>
                  </View>
                }
                contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}
              />
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}
