import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Modal,
  FlatList,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles } from '@/lib/theme-context';
import { Ionicons } from '@expo/vector-icons';

export interface FilterDropdownOption {
  label: string;
  value: string;
  count?: number;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
}

interface FilterDropdownProps {
  label: string;
  value: string;
  options: FilterDropdownOption[];
  onSelect: (value: string) => void;
  icon?: keyof typeof Ionicons.glyphMap;
  containerStyle?: ViewStyle;
  hideLabelPrefix?: boolean;
  showCountOnTrigger?: boolean;
}

export function FilterDropdown({
  label,
  value,
  options,
  onSelect,
  icon,
  containerStyle,
  hideLabelPrefix = false,
  showCountOnTrigger = false,
}: FilterDropdownProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value) || options[0],
    [options, value],
  );

  const isFiltered = value !== 'ALL';

  const handleSelect = (val: string) => {
    onSelect(val);
    setIsOpen(false);
  };

  const activeIcon = selectedOption?.icon || icon || 'chevron-down-outline';
  const activeColor = selectedOption?.color || (isFiltered ? colors.text : colors.textSecondary);

  const styles = useThemedStyles((c, dark) =>
    StyleSheet.create({
      container: {
        flex: 1,
      },
      trigger: {
        height: 38,
        borderRadius: 10,
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.borderMedium,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
      },
      triggerFiltered: {
        backgroundColor: dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
        borderColor: c.borderFocus,
      },
      triggerOpen: {
        borderColor: c.borderFocus,
      },
      triggerLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 4,
      },
      triggerIcon: {
        marginRight: 5,
      },
      triggerText: {
        fontSize: 12,
        fontWeight: '700',
        color: c.textSecondary,
        flexShrink: 1,
      },
      triggerTextFiltered: {
        color: c.text,
        fontWeight: '800',
      },
      chevron: {
        marginLeft: 4,
      },
      countBadge: {
        backgroundColor: c.secondary,
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 999,
        marginLeft: 5,
      },
      countBadgeText: {
        color: c.textSecondary,
        fontSize: 9.5,
        fontWeight: '800',
      },
      modalBackdrop: {
        flex: 1,
        backgroundColor: dark ? 'rgba(0, 0, 0, 0.65)' : 'rgba(0, 0, 0, 0.45)',
        justifyContent: 'flex-end',
      },
      modalSheet: {
        backgroundColor: c.cardElevated,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderWidth: 1,
        borderColor: c.borderMedium,
        paddingHorizontal: 16,
        paddingTop: 8,
        maxHeight: '65%',
      },
      handleBar: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: dark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.18)',
        alignSelf: 'center',
        marginBottom: 10,
      },
      sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
        marginBottom: 4,
      },
      titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
      },
      sheetTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: c.text,
        letterSpacing: -0.2,
      },
      closeBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: c.secondary,
        alignItems: 'center',
        justifyContent: 'center',
      },
      optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
        borderRadius: 10,
        marginVertical: 1,
      },
      optionItemSelected: {
        backgroundColor: dark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
      },
      optionLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      },
      optionIconBox: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: dark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
        alignItems: 'center',
        justifyContent: 'center',
      },
      optionIconBoxSelected: {
        backgroundColor: dark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
      },
      optionLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: c.textSecondary,
        flexShrink: 1,
      },
      optionLabelSelected: {
        color: c.text,
        fontWeight: '800',
      },
      optionCountBadge: {
        backgroundColor: c.secondary,
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 999,
      },
      optionCountText: {
        color: c.textTertiary,
        fontSize: 10,
        fontWeight: '700',
      },
    })
  );

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Trigger Box */}
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => setIsOpen(true)}
        style={[
          styles.trigger,
          isFiltered && styles.triggerFiltered,
          isOpen && styles.triggerOpen,
        ]}
      >
        <View style={styles.triggerLeft}>
          {activeIcon ? (
            <Ionicons
              name={activeIcon}
              size={14}
              color={activeColor}
              style={styles.triggerIcon}
            />
          ) : null}
          <Text
            style={[styles.triggerText, isFiltered && styles.triggerTextFiltered]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {hideLabelPrefix || isFiltered ? selectedOption?.label : `${label}: ${selectedOption?.label}`}
          </Text>
          {selectedOption?.count !== undefined && (showCountOnTrigger || !isFiltered) ? (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{selectedOption.count}</Text>
            </View>
          ) : null}
        </View>

        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={isFiltered ? colors.text : colors.textTertiary}
          style={styles.chevron}
        />
      </TouchableOpacity>

      {/* Options Modal Bottom Sheet */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setIsOpen(false)}>
          <Pressable
            style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Sheet Handle */}
            <View style={styles.handleBar} />

            {/* Sheet Header */}
            <View style={styles.sheetHeader}>
              <View style={styles.titleRow}>
                {icon ? (
                  <Ionicons name={icon} size={16} color={colors.text} style={{ marginRight: 6 }} />
                ) : null}
                <Text style={styles.sheetTitle}>Select {label}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Options List */}
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              bounces={false}
              renderItem={({ item, index }) => {
                const isSelected = item.value === value;
                const optColor = item.color || (isSelected ? colors.text : colors.textSecondary);

                return (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => handleSelect(item.value)}
                    style={[
                      styles.optionItem,
                      isSelected && styles.optionItemSelected,
                      index === options.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    <View style={styles.optionLeft}>
                      {item.icon ? (
                        <View
                          style={[
                            styles.optionIconBox,
                            isSelected && styles.optionIconBoxSelected,
                          ]}
                        >
                          <Ionicons
                            name={item.icon}
                            size={16}
                            color={optColor}
                          />
                        </View>
                      ) : null}
                      <Text
                        style={[
                          styles.optionLabel,
                          isSelected && styles.optionLabelSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                      {item.count !== undefined ? (
                        <View style={styles.optionCountBadge}>
                          <Text style={styles.optionCountText}>{item.count}</Text>
                        </View>
                      ) : null}
                    </View>

                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={19} color={colors.statusPaid} />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
