import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Colors } from '@/constants/theme';
import { formatINR, formatDate, cleanPhoneNumber } from '@/lib/formatters';
import { buildCustomerDuesReminderUrl, buildStorePayableInquiryUrl } from '@/lib/whatsapp';
import { CreditLedgerRecord, PendingItem } from './types';

interface CreditLedgerCardProps {
  credit: CreditLedgerRecord;
  onSettle: (item: PendingItem) => void;
}

export function CreditLedgerCard({ credit, onSettle }: CreditLedgerCardProps) {
  const isPayable = credit.type === 'PAYABLE';
  const partyPhone = credit.party?.phone;
  const cleanPhone = cleanPhoneNumber(partyPhone);

  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    setCurrentTime(Date.now());
  }, []);

  const isOverdue = Boolean(
    credit.dueDate &&
      currentTime > 0 &&
      new Date(credit.dueDate).getTime() < currentTime &&
      credit.status !== 'SETTLED',
  );

  const handleCall = () => {
    if (cleanPhone) {
      Linking.openURL(`tel:${cleanPhone}`).catch(() => {
        Alert.alert('Error', 'Unable to initiate call');
      });
    }
  };

  const handleWhatsAppAction = () => {
    const amtNum = typeof credit.amountDue === 'number' ? credit.amountDue : parseFloat(credit.amountDue) || 0;
    const url = isPayable
      ? buildStorePayableInquiryUrl({
          phone: cleanPhone,
          partyName: credit.party?.name || 'Party',
          amount: amtNum,
          debtRef: credit.invoice?.invoiceNo || 'Ledger Credit',
        })
      : buildCustomerDuesReminderUrl({
          phone: cleanPhone,
          name: credit.party?.name || 'Customer',
          amount: amtNum,
          invoiceNo: credit.invoice?.invoiceNo || 'Ledger Credit',
        });

    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open WhatsApp. Please ensure WhatsApp is installed.');
    });
  };

  const handleAction = () => {
    const pendingItem: PendingItem = {
      id: credit.id,
      invoiceNo: credit.invoice?.invoiceNo || (isPayable ? 'Store Payable' : 'Direct Customer Credit'),
      partyId: credit.partyId,
      partyName: credit.party?.name || 'Party',
      partyPhone: partyPhone || '',
      total: Number(credit.amountDue),
      paid: 0,
      remainingDue: Number(credit.amountDue),
      createdAt: credit.createdAt,
      status: credit.status,
      isCreditLedger: true,
      creditType: credit.type,
    };
    onSettle(pendingItem);
  };

  return (
    <Card elevated style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <View style={styles.typeBadgeRow}>
            <View
              style={[
                styles.typeBadge,
                isPayable ? styles.typePayable : styles.typeReceivable,
              ]}
            >
              <Ionicons
                name={isPayable ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
                size={12}
                color={isPayable ? '#F59E0B' : '#EF4444'}
              />
              <Text
                style={[
                  styles.typeText,
                  { color: isPayable ? '#F59E0B' : '#EF4444' },
                ]}
              >
                {isPayable ? 'Credit Taken (We Owe)' : 'Credit Given (Lent)'}
              </Text>
            </View>

            {isOverdue && (
              <View style={styles.overdueBadge}>
                <Ionicons name="alert-circle" size={10} color="#EF4444" />
                <Text style={styles.overdueText}>OVERDUE</Text>
              </View>
            )}
          </View>

          <Text style={styles.partyTitle} numberOfLines={1}>
            {credit.party?.name || 'Party'}
          </Text>

          {partyPhone ? (
            <View style={styles.phoneActionRow}>
              <TouchableOpacity onPress={handleCall} style={styles.phoneTouch} activeOpacity={0.7}>
                <Ionicons name="call" size={11} color="#38BDF8" />
                <Text style={styles.phoneText}>{partyPhone}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleWhatsAppAction}
                style={styles.waPillTouch}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="logo-whatsapp"
                  size={12}
                  color={isPayable ? '#F59E0B' : '#10B981'}
                />
                <Text
                  style={[
                    styles.waPillText,
                    { color: isPayable ? '#F59E0B' : '#10B981' },
                  ]}
                >
                  WhatsApp
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {credit.invoice?.invoiceNo ? (
            <Text style={styles.invoiceRef}>Invoice #{credit.invoice.invoiceNo}</Text>
          ) : null}

          <View style={styles.dateRow}>
            <Text style={styles.timestamp}>{formatDate(credit.createdAt)}</Text>
            {credit.dueDate ? (
              <View style={[styles.dueBadge, isOverdue && styles.dueBadgeOverdue]}>
                <Ionicons
                  name="calendar-outline"
                  size={10}
                  color={isOverdue ? '#EF4444' : Colors.dark.textSecondary}
                />
                <Text
                  style={[
                    styles.dueText,
                    isOverdue && { color: '#EF4444', fontWeight: '700' },
                  ]}
                >
                  Due: {formatDate(credit.dueDate)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.amountCol}>
          <Text style={styles.amountLabel}>
            {isPayable ? 'Store Owes' : 'Amount Due'}
          </Text>
          <Text
            style={[
              styles.paymentAmount,
              { color: isPayable ? '#F59E0B' : '#EF4444' },
            ]}
          >
            {formatINR(credit.amountDue)}
          </Text>
          <StatusBadge status={credit.status || 'UNSETTLED'} size="sm" />
        </View>
      </View>

      {credit.notes ? (
        <Text style={styles.notesText}>Note: {credit.notes}</Text>
      ) : null}

      {credit.status !== 'SETTLED' ? (
        <View style={styles.actionContainer}>
          {cleanPhone ? (
            <TouchableOpacity
              onPress={handleWhatsAppAction}
              style={[
                styles.waActionBtn,
                isPayable ? styles.waActionBtnAmber : styles.waActionBtnGreen,
              ]}
              activeOpacity={0.7}
            >
              <Ionicons
                name="logo-whatsapp"
                size={13}
                color={isPayable ? '#F59E0B' : '#10B981'}
              />
              <Text
                style={[
                  styles.waActionBtnText,
                  { color: isPayable ? '#F59E0B' : '#10B981' },
                ]}
              >
                {isPayable ? 'Contact' : 'Remind'}
              </Text>
            </TouchableOpacity>
          ) : null}

          <Button
            title={isPayable ? 'Pay Party' : 'Collect Payment'}
            icon={isPayable ? 'arrow-up-circle-outline' : 'cash-outline'}
            size="sm"
            variant="primary"
            onPress={handleAction}
            style={isPayable ? styles.payBtn : styles.collectBtn}
          />
        </View>
      ) : null}
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
  typeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 4,
  },
  typeReceivable: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  typePayable: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  typeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  overdueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  overdueText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#EF4444',
    letterSpacing: 0.4,
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
  waPillTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 1,
    paddingHorizontal: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  waPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  invoiceRef: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  timestamp: {
    fontSize: 10,
    color: Colors.dark.textTertiary,
  },
  dueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.dark.cardElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dueBadgeOverdue: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  dueText: {
    fontSize: 10,
    color: Colors.dark.textSecondary,
  },
  amountCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  amountLabel: {
    fontSize: 10,
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  notesText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    fontStyle: 'italic',
    marginTop: 6,
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  waActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderWidth: 1,
  },
  waActionBtnGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  waActionBtnAmber: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  waActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  payBtn: {
    backgroundColor: '#F59E0B',
  },
  collectBtn: {
    backgroundColor: '#10B981',
  },
});
