import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/theme';
import { formatINR } from '@/lib/formatters';
import { Party, CreditAgeingBuckets } from './types';

interface CreditAgeingRowProps {
  parties: Party[];
}

export function CreditAgeingRow({ parties }: CreditAgeingRowProps) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());
  }, []);

  const buckets: CreditAgeingBuckets = useMemo(() => {
    const currentTime = now > 0 ? now : 0;
    let totalReceivables = 0;
    let b0to15 = 0;
    let b15to30 = 0;
    let b30to60 = 0;
    let b60plus = 0;

    for (const p of parties) {
      for (const cl of p.creditLedgers || []) {
        if (cl.status !== 'SETTLED' && cl.type === 'RECEIVABLE') {
          const amt = Number(cl.amountDue || 0);
          totalReceivables += amt;
          const dueTime = cl.dueDate ? new Date(cl.dueDate).getTime() : currentTime;
          const daysOverdue =
            currentTime > 0
              ? Math.max(0, Math.floor((currentTime - dueTime) / (1000 * 60 * 60 * 24)))
              : 0;
          if (daysOverdue <= 15) b0to15 += amt;
          else if (daysOverdue <= 30) b15to30 += amt;
          else if (daysOverdue <= 60) b30to60 += amt;
          else b60plus += amt;
        }
      }
    }

    return { totalReceivables, b0to15, b15to30, b30to60, b60plus };
  }, [parties, now]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      {/* 1. Total Receivables */}
      <Card style={styles.statCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.label}>Total Receivables</Text>
          <Ionicons name="wallet-outline" size={14} color={Colors.dark.textSecondary} />
        </View>
        <Text style={styles.val}>{formatINR(buckets.totalReceivables)}</Text>
        <Text style={styles.subText}>Across all customers</Text>
      </Card>

      {/* 2. 0-15 Days (Current) */}
      <Card
        style={[
          styles.statCard,
          { borderColor: 'rgba(16, 185, 129, 0.35)', backgroundColor: 'rgba(16, 185, 129, 0.08)' },
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.label, { color: '#10B981' }]}>0–15 Days</Text>
          <Ionicons name="checkmark-circle-outline" size={14} color="#10B981" />
        </View>
        <Text style={[styles.val, { color: '#10B981' }]}>{formatINR(buckets.b0to15)}</Text>
        <Text style={[styles.subText, { color: 'rgba(16, 185, 129, 0.75)' }]}>Fresh dues</Text>
      </Card>

      {/* 3. 15-30 Days */}
      <Card style={styles.statCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.label}>15–30 Days</Text>
          <Ionicons name="time-outline" size={14} color={Colors.dark.textSecondary} />
        </View>
        <Text style={styles.val}>{formatINR(buckets.b15to30)}</Text>
        <Text style={styles.subText}>Standard terms</Text>
      </Card>

      {/* 4. 30-60 Days (Attention) */}
      <Card
        style={[
          styles.statCard,
          { borderColor: 'rgba(245, 158, 11, 0.35)', backgroundColor: 'rgba(245, 158, 11, 0.08)' },
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.label, { color: '#F59E0B' }]}>30–60 Days</Text>
          <Ionicons name="alert-circle-outline" size={14} color="#F59E0B" />
        </View>
        <Text style={[styles.val, { color: '#F59E0B' }]}>{formatINR(buckets.b30to60)}</Text>
        <Text style={[styles.subText, { color: 'rgba(245, 158, 11, 0.75)' }]}>Follow-up needed</Text>
      </Card>

      {/* 5. 60+ Days (Overdue) */}
      <Card
        style={[
          styles.statCard,
          { borderColor: 'rgba(239, 68, 68, 0.35)', backgroundColor: 'rgba(239, 68, 68, 0.08)' },
        ]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.label, { color: '#EF4444' }]}>60+ Days</Text>
          <Ionicons name="warning-outline" size={14} color="#EF4444" />
        </View>
        <Text style={[styles.val, { color: '#EF4444' }]}>{formatINR(buckets.b60plus)}</Text>
        <Text style={[styles.subText, { color: 'rgba(239, 68, 68, 0.75)' }]}>Urgent overdue</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  statCard: {
    width: 140,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.card,
    justifyContent: 'space-between',
    minHeight: 88,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 10,
    color: Colors.dark.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  val: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.dark.text,
    fontFamily: 'monospace',
    marginTop: 4,
    marginBottom: 2,
  },
  subText: {
    fontSize: 9,
    color: Colors.dark.textSecondary,
  },
});
