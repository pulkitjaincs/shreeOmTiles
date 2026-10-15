import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button } from '@/components/ui/Button';

interface StockActionsBarProps {
  onInward: () => void;
  onTransfer: () => void;
  onAdjust: () => void;
}

export function StockActionsBar({
  onInward,
  onTransfer,
  onAdjust,
}: StockActionsBarProps) {
  return (
    <View style={styles.stockActionRow}>
      <Button
        title="+ Inward Stock"
        size="sm"
        variant="secondary"
        onPress={onInward}
        style={{ flex: 1.1 }}
      />
      <Button
        title="Transfer"
        size="sm"
        variant="secondary"
        onPress={onTransfer}
        style={{ flex: 1 }}
      />
      <Button
        title="Adjust"
        size="sm"
        variant="secondary"
        onPress={onAdjust}
        style={{ flex: 1 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stockActionRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
});
