import React, { Component, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../styles';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    const styles = StyleSheet.create({
      container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
        padding: spacing.xl,
      },
      card: {
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        padding: spacing.xxl,
        alignItems: 'center',
        gap: spacing.md,
        width: '100%',
        maxWidth: 320,
      },
      iconWrap: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: `${colors.warning}15`,
        alignItems: 'center',
        justifyContent: 'center',
      },
      title: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.textPrimary,
      },
      message: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
      },
      retryBtn: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.xl,
        borderRadius: radius.lg,
        marginTop: spacing.sm,
      },
      retryText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 15,
      },
    });

    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name="warning-outline" size={40} color={colors.warning} />
            </View>
            <Text style={styles.title}>Đã xảy ra lỗi</Text>
            <Text style={styles.message}>
              {this.state.error?.message || 'Có gì đó không đúng. Vui lòng thử lại.'}
            </Text>
            <Pressable style={styles.retryBtn} onPress={this.handleRetry}>
              <Text style={styles.retryText}>Thử lại</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}
