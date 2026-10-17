import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/theme';
import { formatINR, getInitials, getWhatsAppUrl } from '@/lib/formatters';
import { Party } from './types';

interface PartyCardProps {
  party: Party;
  onViewStatement: (party: Party) => void;
  onEdit: (party: Party) => void;
  onDelete: (party: Party) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canEditOrDelete?: boolean;
}

export function PartyCard({
  party,
  onViewStatement,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
  canEditOrDelete = true,
}: PartyCardProps) {
  const allowEdit = canEdit !== undefined ? canEdit : canEditOrDelete;
  const allowDelete = canDelete !== undefined ? canDelete : canEditOrDelete;

  const totalDue = (party.creditLedgers || [])
    .filter((c) => c.status !== 'SETTLED')
    .reduce((sum, c) => {
      const amt = Number(c.amountDue || 0);
      return c.type === 'RECEIVABLE' ? sum + amt : sum - amt;
    }, 0);

  const partyPayable = (party.creditLedgers || [])
    .filter((c) => c.status !== 'SETTLED' && c.type === 'PAYABLE')
    .reduce((sum, c) => sum + Number(c.amountDue || 0), 0);

  const orderCount = party._count?.invoices || 0;

  const isDue = totalDue > 0.01;
  const isPayable = !isDue && (totalDue < -0.01 || partyPayable > 0.01);
  const payableAmt = totalDue < -0.01 ? Math.abs(totalDue) : partyPayable;
  const hasPendingLiability = isDue || isPayable;

  const handleCall = () => {
    const rawDigits = (party.phone || '').replace(/[^\d+]/g, '');
    if (rawDigits) {
      Linking.openURL(`tel:${rawDigits}`).catch(() => {
        Alert.alert('Error', 'Unable to initiate phone call');
      });
    }
  };

  const handleWhatsAppAction = () => {
    const msg = isDue
      ? `*PAYMENT REMINDER — SHREE OM TILES*\n\n` +
        `Dear *${party.name || 'Customer'}*,\n\n` +
        `This is a friendly reminder that you have an outstanding balance of *${formatINR(totalDue)}* on your account.\n\n` +
        `Kindly arrange payment clearance at your earliest convenience via UPI or Counter Cash.\n\n` +
        `Thank you for your business! 🙏\n` +
        `*Shree Om Tiles*`
      : isPayable
      ? `*STORE CREDIT NOTICE — SHREE OM TILES*\n\n` +
        `Dear *${party.name || 'Customer'}*,\n\n` +
        `This is to inform you that you have an available store credit / payable balance of *${formatINR(payableAmt)}* with us at Shree Om Tiles.\n\n` +
        `You may redeem or adjust this balance against your next purchase or delivery.\n\n` +
        `Thank you for your continued partnership! 🙏\n` +
        `*Shree Om Tiles*`
      : `Hello *${party.name || 'Customer'}*,\n\n` +
        `Greetings from *Shree Om Tiles*! 🙏\n\n` +
        `How may we assist you today?`;

    const url = getWhatsAppUrl(party.phone, msg);

    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open WhatsApp');
    });
  };

  return (
    <Card
      elevated
      onPress={() => onViewStatement(party)}
      style={styles.card}
    >
      {/* Top Section */}
      <View style={styles.topRow}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{getInitials(party.name)}</Text>
        </View>

        <View style={styles.infoCol}>
          <View style={styles.nameHeaderRow}>
            <Text style={styles.partyName} numberOfLines={1}>
              {party.name || 'Unnamed Customer'}
            </Text>
            {party.isSaved === false && (
              <View style={styles.walkInBadge}>
                <Text style={styles.walkInBadgeText}>Walk-in</Text>
              </View>
            )}
            {isDue ? (
              <View style={styles.duesBadgeRose}>
                <Text style={styles.duesBadgeRoseText}>{formatINR(totalDue)} Due</Text>
              </View>
            ) : isPayable ? (
              <View style={styles.duesBadgeAmber}>
                <Text style={styles.duesBadgeAmberText}>{formatINR(payableAmt)} Payable</Text>
              </View>
            ) : (
              <View style={styles.duesBadgeEmerald}>
                <Text style={styles.duesBadgeEmeraldText}>Cleared</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={15} color={Colors.dark.textTertiary} />
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

            {party.category && party.category !== 'RETAIL' ? (
              <View style={styles.categoryPill}>
                <Text style={styles.categoryText}>{party.category}</Text>
              </View>
            ) : null}

            {party.gstin ? (
              <View style={styles.gstinPill}>
                <Text style={styles.gstinLabel}>GSTIN:</Text>
                <Text style={styles.gstinVal} numberOfLines={1}>{party.gstin}</Text>
              </View>
            ) : null}
          </View>

          {/* Address */}
          {party.address ? (
            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={11} color={Colors.dark.textTertiary} />
              <Text style={styles.addressText} numberOfLines={1}>
                {party.address}
              </Text>
            </View>
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
          title={isDue ? 'Reminder' : isPayable ? 'Credit Info' : 'WhatsApp'}
          icon="logo-whatsapp"
          size="sm"
          variant="secondary"
          onPress={handleWhatsAppAction}
          style={styles.actionBtn}
        />

        {allowEdit ? (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => onEdit(party)}
            activeOpacity={0.7}
          >
            <Ionicons name="pencil-outline" size={16} color="#F59E0B" />
          </TouchableOpacity>
        ) : null}

        {allowDelete ? (
          <TouchableOpacity
            style={[styles.iconBtn, hasPendingLiability && styles.iconBtnDisabled]}
            onPress={() => onDelete(party)}
            activeOpacity={0.7}
          >
            <Ionicons
              name="trash-outline"
              size={16}
              color={hasPendingLiability ? Colors.dark.textTertiary : '#EF4444'}
            />
          </TouchableOpacity>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.borderMedium,
    backgroundColor: Colors.dark.card,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoCol: {
    flex: 1,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  nameHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    flexShrink: 0,
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
    flexShrink: 0,
  },
  duesBadgeEmeraldText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  duesBadgeAmber: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    flexShrink: 0,
  },
  duesBadgeAmberText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
    fontFamily: 'monospace',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  phoneTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.dark.cardElevated,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: Colors.dark.border,
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
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  orderPillText: {
    fontSize: 10.5,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
  gstinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.dark.cardElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  gstinLabel: {
    fontSize: 9.5,
    color: Colors.dark.textTertiary,
    fontWeight: '600',
  },
  gstinVal: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: Colors.dark.textSecondary,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  addressText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 10,
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: Colors.dark.cardElevated,
    borderWidth: 1,
    borderColor: Colors.dark.borderMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnDisabled: {
    opacity: 0.5,
  },
  walkInBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    flexShrink: 0,
  },
  walkInBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#F59E0B',
    textTransform: 'uppercase',
  },
  categoryPill: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  categoryText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#3B82F6',
    textTransform: 'uppercase',
  },
});
