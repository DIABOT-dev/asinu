import { ReactNode } from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { colors } from '../styles';

type ScreenProps = ViewProps & {
  children: ReactNode;
};

export const Screen = ({ children, style }: ScreenProps) => {
  return <View style={[styles.container, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  }
});
