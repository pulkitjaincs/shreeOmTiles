import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/theme';
import { formatINR, cleanPhoneNumber, getInitials } from '@/lib/formatters';
import { Party } from './types';

interface PartyCardProps {
  party: Party;
  onViewStatement: (party: Party) => void;
  onEdit: (party: Party) => void;
  onDelete: (party: Party) => void;
  canEditOrDelete: boolean;
}

export function PartyCard({
  party,
  onViewStatement,
  onEdit,
  onDelete,
  canEditOrDelete,
}: PartyCardProps) {
  const totalDue = (party.creditLedgers || [])
    .filter((c) => c.status !== 'SETTLED')
    .reduce((sum, c) => {
      const amt = Number(c.amountDue || 0);
      return c.type === 'RECEIVABLE' ? sum + amt : sum - amt;
    }, 0);

  const orderCount = party._count?.invoices || 0;

  const handleCall = () => {
    const clean = cleanPhoneNumber(party.phone);
    if (clean) {
      Linking.openURL(`tel:${clean}`);
    }
  };

  const handleWhatsAppReminder = () => {
    const clean = cleanPhoneNumber(party.phone);
    const msg =
      `*PAYMENT REMINDER — SHREE OM TILES*\n\n` +
      `Dear *${party.name}*,\n\n` +
      (totalDue > 0
        ? `This is a friendly reminder that you have an outstanding balance of *${formatINR(totalDue)}* on your account.\n\n` +
          `Kindly arrange payment clearance at your earliest convenience via UPI or Counter Cash.\n\n`
        : `Your account balance is currently clear with zero dues pending.\n\n`) +
      `Thank you for your business!\n` +
      `Shree Om Tiles & Sanitaryware`;

    const url = clean
      ? `https://wa.me/91${clean}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open WhatsApp');
    });
  };

  return (
    <Card elevated style={styles.card}>
      {/* Top Section */}
      <View style={styles.topRow}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{getInitials(party.name)}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.nameHeaderRow}>
            <Text style={styles.partyName} numberOfLines={1}>
              {party.name}
            </Text>
            {totalDue > 0 ? (
              <View style={styles.duesBadgeRose}>
                <Text style={styles.duesBadgeRoseText}>{formatINR(totalDue)} Due</Text>
              </View>
            ) : (
              <View style={styles.duesBadgeEmerald}>
                <Text style={styles.duesBadgeEmeraldText}>Cleared</Text>
              </View>
            )}
          </View>

          {/* Phone & Orders */}
          <View style={styles.metaRow}>
            <TouchableOpacity onPress={handleCall} style={styles.phoneTouch} activeOpacity={0.7}>
              <Ionicons name="call-outline" size={11} color={Colors.dark.textSecondary} />
              <Text style={styles.phoneText}>{party.phone}</Text>
            </TouchableOpacity>

            <View style={styles.orderPill}>
              <Ionicons name="bag-handle-outline" size={10} color={Colors.dark.textSecondary} />
              <Text style={styles.orderPillText}>{orderCount} orders</Text>
            </View>
          </View>

          {/* GSTIN & Address */}
          {party.gstin ? (
            <View style={styles.gstinRow}>
              <Text style={styles.gstinLabel}>GSTIN:</Text>
              <Text style={styles.gstinVal}>{party.gstin}</Text>
            </View>
          ) : null}

          {party.address ? (
            <Text style={styles.addressText} numberOfLines={2}>
              {party.address}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.divider} />

      {/* Action Row */}
      <View style={styles.bottomActions}>
        <Button
          title="Call"
          icon="call-outline"
          size="sm"
          variant="secondary"
          onPress={handleCall}
          style={styles.actionBtn}
        />

        <Button
          title="Reminder"
          icon="logo-whatsapp"
          size="sm"
          variant="secondary"
          onPress={handleWhatsAppReminder}
          style={styles.actionBtn}
        />

        <Button
          title="360° Statement"
          icon="document-text-outline"
          size="sm"
          variant="primary"
          onPress={() => onViewStatement(party)}
          style={[styles.actionBtn, { flex: 1.3 }]}
        />

        {canEditOrDelete ? (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => onEdit(party)}
            activeOpacity={0.7}
          >
            <Ionicons name="pencil-outline" size={16} color="#F59E0B" />
          </TouchableOpacity>
        ) : null}

        {canEditOrDelete ? (
          <TouchableOpacity
            style={[styles.iconBtn, totalDue > 0 && styles.iconBtnDisabled]}
            onPress={() => onDelete(party)}
            activeOpacity={0.7}
          >
            <Ionicons
              name="trash-outline"
              size={16}
              color={totalDue > 0 ? Colors.dark.textTertiary : '#EF4444'}
            />
          </TouchableOpacity>
        ) : null}
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  nameHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  partyName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark.text,
    flex: 1,
  },
  duesBadgeRose: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  duesBadgeRoseText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#EF4444',
    fontFamily: 'monospace',
  },
  duesBadgeEmerald: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  duesBadgeEmeraldText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  phoneTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  phoneText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    fontFamily: 'monospace',
  },
  orderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.dark.cardElevated,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  orderPillText: {
    fontSize: 10,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
  gstinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  gstinLabel: {
    fontSize: 10,
    color: Colors.dark.textTertiary,
    fontWeight: '600',
  },
  gstinVal: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: Colors.dark.textSecondary,
  },
  addressText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 4,
    lineHeight: 15,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 10,
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    flex: 1,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: Colors.dark.cardElevated,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnDisabled: {
    opacity: 0.6,
  },
});
