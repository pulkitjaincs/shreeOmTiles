import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/theme';
import { formatINR } from '@/lib/formatters';
import { PushSuccessDialogData } from './types';

interface PushSuccessModalProps {
  data: PushSuccessDialogData | null;
  visible: boolean;
  onClose: () => void;
}

export function PushSuccessModal({ data, visible, onClose }: PushSuccessModalProps) {
  if (!data) return null;

  const handleShareWhatsApp = () => {
    if (data.waUrl) {
      Linking.openURL(data.waUrl).catch(() => {
        Alert.alert('Error', 'Unable to open WhatsApp. Please ensure WhatsApp is installed.');
      });
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Delivery Pushed to Driver!"
      subtitle={`Invoice #${data.invoiceNo} successfully queued`}
    >
      <View style={styles.container}>
        <View style={styles.successIconBox}>
          <Ionicons name="checkmark-circle" size={44} color="#10B981" />
        </View>

        <Card style={styles.summaryCard}>
          <View style={styles.row}>
            <Text style={styles.label}>Assigned Driver:</Text>
            <Text style={styles.valBold}>
              {data.driverName} {data.driverPhone ? `(${data.driverPhone})` : ''}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Queue Status:</Text>
            <View style={styles.badgeCyan}>
              <Text style={styles.badgeCyanText}>Assigned (Waiting to Accept)</Text>
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Items Dispatched:</Text>
            <Text style={styles.val}>{data.itemsCount} item(s)</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Collect from Customer:</Text>
            <Text style={styles.valAmount}>{formatINR(data.amountToCollect)}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Transport Pricing:</Text>
            <Text style={styles.valMono}>{formatINR(data.transportCost)}</Text>
          </View>

          {data.hasRemaining && (
            <View style={styles.remainingBox}>
              <Ionicons name="information-circle" size={13} color="#F59E0B" />
              <Text style={styles.remainingText}>
                Remaining split items are preserved in Pending Dispatch for your next driver.
              </Text>
            </View>
          )}
        </Card>

        <Text style={styles.infoNote}>
          The run is now queued in the driver&apos;s mobile dashboard. When the driver accepts the assignment, the status will automatically update to{' '}
          <Text style={{ fontWeight: '700', color: Colors.dark.text }}>Out for Pickup</Text>.
        </Text>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={handleShareWhatsApp}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" />
            <Text style={styles.shareBtnText}>Share on WhatsApp</Text>
          </TouchableOpacity>

          <Button
            title="Done"
            variant="secondary"
            size="md"
            onPress={onClose}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 8,
  },
  successIconBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
  summaryCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 12,
    gap: 8,
    marginVertical: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  val: {
    fontSize: 12,
    color: Colors.dark.text,
    fontWeight: '600',
  },
  valBold: {
    fontSize: 12,
    color: Colors.dark.text,
    fontWeight: '700',
  },
  valAmount: {
    fontSize: 13,
    color: '#F59E0B',
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  valMono: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontFamily: 'monospace',
  },
  badgeCyan: {
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.25)',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  badgeCyanText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#06B6D4',
  },
  remainingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
  },
  remainingText: {
    fontSize: 11,
    color: '#F59E0B',
    flex: 1,
  },
  infoNote: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
    lineHeight: 16,
    marginVertical: 8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  shareBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 12,
  },
  shareBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
