import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Colors } from '@/constants/theme';
import { formatINR, formatDate, cleanPhoneNumber } from '@/lib/formatters';
import { buildStorePayableInquiryUrl } from '@/lib/whatsapp';
import { PendingItem } from './types';

interface StorePayablesCardProps {
  item: PendingItem;
  onPay: (item: PendingItem) => void;
}

export function StorePayablesCard({ item, onPay }: StorePayablesCardProps) {
  const cleanPhone = cleanPhoneNumber(item.partyPhone);

  const handleCall = () => {
    if (cleanPhone) {
      Linking.openURL(`tel:${cleanPhone}`).catch(() => {
        Alert.alert('Error', 'Unable to initiate phone call');
      });
    }
  };

  const handleSendWhatsAppInquiry = () => {
    const url = buildStorePayableInquiryUrl({
      phone: cleanPhone,
      partyName: item.partyName,
      amount: item.remainingDue,
      debtRef: item.invoiceNo,
    });
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open WhatsApp. Please ensure WhatsApp is installed.');
    });
  };

  return (
    <Card elevated style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {(item.partyName || 'P').slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.partyTitle} numberOfLines={1}>
                {item.partyName}
              </Text>
              {item.partyPhone ? (
                <View style={styles.phoneActionRow}>
                  <TouchableOpacity
                    onPress={handleCall}
                    style={styles.phoneTouch}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="call" size={11} color="#38BDF8" />
                    <Text style={styles.phoneText}>{item.partyPhone}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.refRow}>
            <View style={styles.refBadge}>
              <Text style={styles.refBadgeText}>
                {item.invoiceNo || 'Store Debt'}
              </Text>
            </View>
            <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
          </View>
        </View>

        <View style={styles.amountCol}>
          <Text style={styles.amountLabel}>Store Owes</Text>
          <Text style={styles.dueAmountVal} numberOfLines={1} adjustsFontSizeToFit>
            {formatINR(item.remainingDue)}
          </Text>
          {item.total && item.total !== item.remainingDue ? (
            <Text style={styles.billedText} numberOfLines={1}>
              Total Debt: {formatINR(item.total)}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.actionDivider} />

      <View style={styles.cardBottomRow}>
        <StatusBadge status={item.status || 'PENDING'} size="sm" />

        <View style={styles.actionsGroup}>
          {cleanPhone ? (
            <TouchableOpacity
              onPress={handleSendWhatsAppInquiry}
              style={styles.inquireBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="logo-whatsapp" size={13} color="#F59E0B" />
              <Text style={styles.inquireBtnText}>Contact</Text>
            </TouchableOpacity>
          ) : null}

          <Button
            title="Pay Party (Outflow)"
            icon="arrow-up-circle-outline"
            size="sm"
            variant="primary"
            onPress={() => onPay(item)}
            style={styles.payBtn}
          />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.card,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F59E0B',
  },
  partyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  phoneActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  phoneTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  phoneText: {
    fontSize: 11,
    color: '#38BDF8',
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  refBadge: {
    backgroundColor: Colors.dark.cardElevated,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  refBadgeText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: Colors.dark.textSecondary,
  },
  dateText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
  },
  amountCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: 10,
  },
  amountLabel: {
    fontSize: 10,
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  dueAmountVal: {
    fontSize: 17,
    fontWeight: '900',
    color: '#F59E0B',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  billedText: {
    fontSize: 10,
    color: Colors.dark.textSecondary,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  actionDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 10,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inquireBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 9,
  },
  inquireBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
  },
  payBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
  },
});
