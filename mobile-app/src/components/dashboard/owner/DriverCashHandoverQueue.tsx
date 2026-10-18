import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useThemedStyles, ThemeColors } from '@/lib/theme-context';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatINR } from '@/lib/formatters';
import { Ionicons } from '@expo/vector-icons';
import { PendingDriverDelivery } from '../types';

interface DriverCashHandoverQueueProps {
  deliveries: PendingDriverDelivery[];
  cashTotal?: number;
  handoverInProgress: string | null;
  onVerifyHandover: (deliveryId: string) => void;
  onNavigateDeliveries?: () => void;
}

export function DriverCashHandoverQueue({
  deliveries,
  cashTotal = 0,
  handoverInProgress,
  onVerifyHandover,
  onNavigateDeliveries,
}: DriverCashHandoverQueueProps) {
  const styles = useThemedStyles(createStyles);
  if (deliveries.length === 0 && Number(cashTotal) <= 0) return null;

  return (
    <Card elevated style={styles.card}>
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <View style={styles.titleRow}>
            <Ionicons name="cash-outline" size={16} color="#F59E0B" />
            <Text style={styles.title} numberOfLines={1}>
              Driver Cash Handover Queue ({deliveries.length})
            </Text>
          </View>
          <Text style={styles.subtitle}>
            Physical cash collected by drivers awaiting counter settlement
          </Text>
        </View>
        <Text
          style={styles.total}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {formatINR(cashTotal)}
        </Text>
      </View>

      {onNavigateDeliveries && (
        <TouchableOpacity style={styles.panelLink} onPress={onNavigateDeliveries}>
          <Text style={styles.panelLinkText}>Deliveries Panel →</Text>
        </TouchableOpacity>
      )}

      {deliveries.map((item) => {
        const deliveryId = item.id || item.deliveryId || '';
        const cashAmount = item.amount ?? item.amountToCollect ?? 0;
        return (
          <View key={deliveryId} style={styles.item}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <View style={styles.driverRow}>
                <Ionicons name="person-outline" size={13} color="#FCD34D" />
                <Text style={styles.driverName} numberOfLines={1}>
                  {item.driverName || 'Assigned Driver'}
                </Text>
              </View>
              <Text style={styles.invoiceMeta} numberOfLines={1} ellipsizeMode="tail">
                Invoice #{item.invoiceNo} • {item.partyName}
              </Text>
              <Text style={styles.amount} numberOfLines={1}>
                Cash to hand over: {formatINR(cashAmount)}
              </Text>
            </View>
            <Button
              title="Verify Cash"
              size="sm"
              variant="primary"
              loading={handoverInProgress === deliveryId}
              onPress={() => onVerifyHandover(deliveryId)}
            />
          </View>
        );
      })}
    </Card>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      marginTop: 12,
      marginBottom: 6,
      padding: 16,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.35)',
      borderRadius: 16,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    title: {
      fontSize: 13.5,
      fontWeight: '800',
      color: '#FCD34D',
    },
    subtitle: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
      lineHeight: 15,
    },
    total: {
      fontSize: 18,
      fontWeight: '900',
      color: colors.text,
      flexShrink: 0,
    },
    panelLink: {
      alignSelf: 'flex-start',
      marginBottom: 8,
    },
    panelLinkText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#38BDF8',
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 10,
    },
    driverRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    driverName: {
      fontSize: 12.5,
      fontWeight: '700',
      color: colors.text,
    },
    invoiceMeta: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    amount: {
      fontSize: 12,
      fontWeight: '800',
      color: '#10B981',
      marginTop: 2,
    },
  });
