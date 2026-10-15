import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Colors } from '@/constants/theme';

interface FilterOption<T = string> {
  label: string;
  value: T;
  count?: number;
}

interface FilterPillsProps<T = string> {
  options: FilterOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
}

export function FilterPills<T = string>({
  options,
  selected,
  onSelect,
}: FilterPillsProps<T>) {
  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {options.map((opt) => {
          const isSelected = opt.value === selected;
          return (
            <TouchableOpacity
              key={String(opt.value)}
              onPress={() => onSelect(opt.value)}
              activeOpacity={0.75}
              style={[
                styles.pill,
                isSelected ? styles.pillSelected : styles.pillUnselected,
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  isSelected ? styles.textSelected : styles.textUnselected,
                ]}
              >
                {opt.label}
              </Text>
              {opt.count !== undefined ? (
                <View
                  style={[
                    styles.countBadge,
                    isSelected ? styles.countSelected : styles.countUnselected,
                  ]}
                >
                  <Text
                    style={[
                      styles.countText,
                      isSelected ? styles.countTextSelected : styles.countTextUnselected,
                    ]}
                  >
                    {opt.count}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 10,
  },
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  pill: {
    height: 34,
    borderRadius: 9999,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pillSelected: {
    backgroundColor: '#FFFFFF',
  },
  pillUnselected: {
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  pillText: {
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  textSelected: {
    color: '#09090B',
  },
  textUnselected: {
    color: Colors.dark.textSecondary,
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 999,
  },
  countSelected: {
    backgroundColor: '#E4E4E7',
  },
  countUnselected: {
    backgroundColor: Colors.dark.secondary,
  },
  countText: {
    fontSize: 10,
    fontWeight: '800',
  },
  countTextSelected: {
    color: '#09090B',
  },
  countTextUnselected: {
    color: '#FFFFFF',
  },
});
