import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles } from '@/lib/theme-context';
import { Button } from './Button';

interface SectionErrorBoundaryProps {
  children: React.ReactNode;
  /** Called when the user taps "Back to Menu" (typically: leave the broken section). */
  onReset?: () => void;
}

interface SectionErrorBoundaryState {
  error: Error | null;
}

function SectionErrorFallback({ onReset }: { onReset?: () => void }) {
  const styles = useThemedStyles((c) =>
    StyleSheet.create({
      container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
      },
      title: {
        fontSize: 16,
        fontWeight: '800',
        color: c.text,
        marginTop: 14,
        textAlign: 'center',
      },
      description: {
        fontSize: 13,
        color: c.textSecondary,
        marginTop: 6,
        textAlign: 'center',
        lineHeight: 18,
      },
      button: {
        marginTop: 18,
        minWidth: 160,
      },
    })
  );

  return (
    <View style={styles.container}>
      <Ionicons name="warning-outline" size={36} color="#F59E0B" />
      <Text style={styles.title}>This section hit a problem</Text>
      <Text style={styles.description}>
        Something went wrong while displaying this screen. Your data is safe.
      </Text>
      <Button
        title="Back to Menu"
        icon="arrow-back-outline"
        variant="secondary"
        size="md"
        onPress={onReset || (() => {})}
        style={styles.button}
      />
    </View>
  );
}

/**
 * Contains render errors thrown inside one section of a screen. Without it, a single
 * bad record tears down the whole route and the user cannot navigate away.
 * Render with a `key` that changes per section so the error clears on navigation.
 */
export class SectionErrorBoundary extends React.Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  state: SectionErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): SectionErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[SectionErrorBoundary] Section crashed:', error, info?.componentStack);
  }

  private handleReset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return <SectionErrorFallback onReset={this.handleReset} />;
  }
}
