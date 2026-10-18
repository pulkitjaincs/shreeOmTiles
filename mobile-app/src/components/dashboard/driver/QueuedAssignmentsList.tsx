import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemedStyles, ThemeColors } from '@/lib/theme-context';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatINR } from '@/lib/formatters';

interface QueuedAssignmentsListProps {
  pendingAssigned: any[];
  onStartPickup: (deliveryId: string) => void;
}

export function QueuedAssignmentsList({
  pendingAssigned,
  onStartPickup,
}: QueuedAssignmentsListProps) {
  const styles = useThemedStyles(createStyles);
  if (pendingAssigned.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Queued Delivery Assignments ({pendingAssigned.length})
      </Text>
      <Text style={styles.sub}>
        Orders waiting for pickup once current route finishes
      </Text>

      {pendingAssigned.map((d) => (
        <Card key={d.id} style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.invoiceText}>
                Invoice #{d.invoice?.invoiceNo} • {d.invoice?.party?.name}
              </Text>
              {d.invoice?.party?.address ? (
                <Text style={styles.addressText} numberOfLines={1}>
                  📍 {d.invoice.party.address}
                </Text>
              ) : null}
              <Text style={styles.amountText}>
                Cash to collect: {formatINR(d.amountToCollect)}
              </Text>
            </View>
            <Button
              title="Start Pickup"
              size="sm"
              variant="outline"
              onPress={() => onStartPickup(d.id)}
            />
          </View>
        </Card>
      ))}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      marginTop: 16,
    },
    title: {
      fontSize: 13.5,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.2,
    },
    sub: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
      marginBottom: 10,
    },
    card: {
      padding: 13,
      marginBottom: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    invoiceText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: colors.text,
    },
    addressText: {
      fontSize: 10.5,
      color: colors.textTertiary,
      marginTop: 1,
    },
    amountText: {
      fontSize: 11,
      color: '#F59E0B',
      fontWeight: '700',
      marginTop: 2,
    },
  });
