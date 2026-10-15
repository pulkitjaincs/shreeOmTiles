import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/theme';
import { formatINR } from '@/lib/formatters';
import { UpiModalData } from './types';

interface UpiQrModalProps {
  data: UpiModalData | null;
  onClose: () => void;
  onShareWhatsApp: (data: UpiModalData) => void;
}

export function UpiQrModal({ data, onClose, onShareWhatsApp }: UpiQrModalProps) {
  if (!data) return null;

  return (
    <BottomSheetModal
      visible={Boolean(data)}
      onClose={onClose}
      title="Scan & Pay via UPI"
      subtitle={`Invoice #${data.invoiceNo} • ${data.partyName || 'Counter Sale'}`}
    >
      <View style={styles.qrContainer}>
        <Text style={styles.qrAmount}>{formatINR(data.total)}</Text>
        <Text style={styles.qrInstructions}>
          Customer can scan this QR using PhonePe, Google Pay, PayTM, or BHIM
        </Text>

        <View style={styles.qrFrame}>
          {data.qrDataUrl ? (
            <Image
              source={{ uri: data.qrDataUrl }}
              style={styles.qrImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.qrPlaceholder}>
              <Text style={styles.qrPlaceholderText}>QR Not Available</Text>
            </View>
          )}
        </View>

        <View style={styles.merchantInfo}>
          <Text style={styles.merchantTitle}>Shree Om Tiles & Sanitary</Text>
          <Text style={styles.merchantUpi}>
            UPI ID: {data.vpa || 'Not Configured'}
          </Text>
        </View>

        <Button
          title="Share Bill via WhatsApp"
          icon="logo-whatsapp"
          variant="secondary"
          onPress={() => onShareWhatsApp(data)}
          style={{ width: '100%', marginTop: 12 }}
        />

        <Button
          title="Done"
          variant="primary"
          onPress={onClose}
          style={{ width: '100%', marginTop: 8 }}
        />
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  qrContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  qrAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.dark.text,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  qrInstructions: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  qrFrame: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 16,
  },
  qrImage: {
    width: 220,
    height: 220,
  },
  qrPlaceholder: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
  },
  qrPlaceholderText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  merchantInfo: {
    alignItems: 'center',
    marginBottom: 8,
  },
  merchantTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  merchantUpi: {
    fontSize: 12,
    color: Colors.dark.primary,
    fontFamily: 'monospace',
    marginTop: 2,
  },
});
