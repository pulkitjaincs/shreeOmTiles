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
import { Colors } from '@/constants/theme';
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
}: SelectProps) {
  const insets = useSafeAreaInsets();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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
              color={isOpen ? '#FFFFFF' : Colors.dark.textSecondary}
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
          {selectedOption?.badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{selectedOption.badge}</Text>
            </View>
          ) : null}
          <Ionicons
            name={isOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={isOpen ? '#FFFFFF' : Colors.dark.textSecondary}
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
                  <Ionicons name="close" size={20} color={Colors.dark.textSecondary} />
                </TouchableOpacity>
              </View>
              {searchable ? (
                <View style={styles.searchBox}>
                  <Ionicons
                    name="search-outline"
                    size={16}
                    color={Colors.dark.textSecondary}
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    placeholder={searchPlaceholder}
                    placeholderTextColor={Colors.dark.textTertiary}
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                    style={styles.searchInput}
                    autoFocus
                  />
                  {searchTerm ? (
                    <TouchableOpacity onPress={() => setSearchTerm('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={16} color={Colors.dark.textTertiary} />
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
                        {isSelected ? <Ionicons name="checkmark" size={18} color="#FFFFFF" /> : null}
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

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  triggerWrapper: {
    minHeight: 48,
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  triggerWrapperFocused: {
    borderColor: '#FFFFFF',
    backgroundColor: '#16161A',
  },
  triggerWrapperError: {
    borderColor: Colors.dark.statusCancelled,
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
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '600',
  },
  selectedSubLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  placeholderText: {
    color: Colors.dark.textTertiary,
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  pickerBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
  },
  pickerAlign: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    maxHeight: '72%',
    backgroundColor: Colors.dark.cardElevated,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: Colors.dark.borderMedium,
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
    color: Colors.dark.text,
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
    borderBottomColor: Colors.dark.border,
    backgroundColor: Colors.dark.card,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
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
    color: Colors.dark.textTertiary,
    fontSize: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  optionRowSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  optionDetails: {
    flex: 1,
    marginRight: 10,
  },
  optionLabel: {
    color: Colors.dark.text,
    fontSize: 13.5,
    fontWeight: '500',
  },
  optionLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  optionSubLabel: {
    color: Colors.dark.textSecondary,
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
    backgroundColor: Colors.dark.secondary,
  },
  optionBadgeText: {
    color: Colors.dark.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 11.5,
    color: Colors.dark.statusCancelled,
    marginTop: 4,
  },
});
