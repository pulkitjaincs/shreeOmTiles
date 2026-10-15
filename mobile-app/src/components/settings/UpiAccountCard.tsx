import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/theme';
import { UpiAccount } from './types';

interface UpiAccountCardProps {
  account: UpiAccount;
  onSetPrimary: (accountId: string) => void;
  onDelete: (accountId: string, vpa: string) => void;
}

export function UpiAccountCard({
  account,
  onSetPrimary,
  onDelete,
}: UpiAccountCardProps) {
  return (
    <Card
      elevated
      style={[
        styles.card,
        account.isPrimary && styles.primaryCard,
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.iconCircle}>
          <Ionicons name="qr-code-outline" size={20} color={account.isPrimary ? '#10B981' : Colors.dark.primary} />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.vpaRow}>
            <Text style={styles.vpaText} numberOfLines={1}>
              {account.upiId}
            </Text>
            {account.isPrimary ? (
              <View style={styles.primaryBadge}>
                <Ionicons name="star" size={10} color="#10B981" />
                <Text style={styles.primaryBadgeText}>DEFAULT</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.merchantText} numberOfLines={1}>
            Label: <Text style={{ color: Colors.dark.text }}>{account.merchantName || 'Shree Om Tiles'}</Text>
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.actionsRow}>
        {!account.isPrimary ? (
          <Button
            title="Set as Default"
            icon="star-outline"
            size="sm"
            variant="outline"
            onPress={() => onSetPrimary(account.id)}
            style={{ flex: 1 }}
          />
        ) : (
          <View style={styles.activeNotice}>
            <Ionicons name="checkmark-circle-outline" size={14} color="#10B981" />
            <Text style={styles.activeNoticeText}>Active default for counter QR</Text>
          </View>
        )}

        <Button
          title="Delete"
          icon="trash-outline"
          size="sm"
          variant="danger"
          onPress={() => onDelete(account.id, account.upiId)}
          style={{ flex: account.isPrimary ? 0.4 : 0.6 }}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: Colors.dark.cardElevated,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  primaryCard: {
    borderColor: 'rgba(16, 185, 129, 0.3)',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.dark.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vpaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  vpaText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'monospace',
    letterSpacing: -0.2,
  },
  primaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  primaryBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#34D399',
  },
  merchantText: {
    fontSize: 11.5,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dark.border,
    marginVertical: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeNotice: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeNoticeText: {
    fontSize: 11,
    color: '#34D399',
    fontWeight: '600',
  },
});
