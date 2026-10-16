import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mobileApiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Colors } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!phone || !password) {
      setError('Please enter both mobile number and password');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setError('Mobile number must be strictly 10 digits');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const data = await mobileApiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phone: cleanPhone, password }),
      });

      await login(data.access_token, data.user);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + 16, 36),
            paddingBottom: Math.max(insets.bottom + 16, 32),
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandSection}>
          <View style={styles.logoBadge}>
            <Image
              source={require('@/assets/images/icon.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.brandTitle}>Shree Om Tiles</Text>
          <Text style={styles.brandSubtitle}>Tiles & Sanitaryware ERP</Text>
        </View>

        <Card elevated style={styles.card}>
          <Text style={styles.cardHeader}>Staff Sign In</Text>
          <Text style={styles.cardSub}>
            Enter your 10-digit mobile number and staff password
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Input
            label="Mobile Number"
            placeholder="e.g. 9876543210"
            value={phone}
            onChangeText={(txt) => setPhone(txt.replace(/\D/g, '').slice(0, 10))}
            keyboardType="phone-pad"
            maxLength={10}
            icon="call-outline"
          />

          <Input
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            isPassword
            icon="lock-closed-outline"
          />

          <Button
            title="Sign In to ERP"
            onPress={handleLogin}
            loading={loading}
            size="lg"
            style={styles.submitBtn}
          />
        </Card>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Internal dhraERP System v1.0</Text>
          <Text style={styles.footerSub}>Authorized Staff Access Only</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: '#000000',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  logoImage: {
    width: 64,
    height: 64,
    borderRadius: 18,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    marginTop: 3,
  },
  card: {
    padding: 22,
    borderRadius: 18,
  },
  cardHeader: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardSub: {
    color: Colors.dark.textSecondary,
    fontSize: 12.5,
    marginTop: 4,
    marginBottom: 18,
    lineHeight: 18,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '500',
  },
  submitBtn: {
    marginTop: 8,
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
  },
  footerText: {
    color: Colors.dark.textTertiary,
    fontSize: 11.5,
    fontWeight: '600',
  },
  footerSub: {
    color: Colors.dark.textTertiary,
    fontSize: 10.5,
    marginTop: 2,
  },
});
