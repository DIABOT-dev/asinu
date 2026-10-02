import { lazy, Suspense } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

const CareCircleScanScreen = lazy(
  () => import('../../src/features/care-circle/screens/CareCircleScanScreen')
);

export default function CareCircleScanRoute() {
  return (
    <Suspense
      fallback={
        <View style={styles.loading}>
          <ActivityIndicator color="#087F73" size="large" />
        </View>
      }
    >
      <CareCircleScanScreen />
    </Suspense>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    backgroundColor: '#F4FBF9',
    flex: 1,
    justifyContent: 'center',
  },
});
