import { ReactNode } from 'react';
import { View, ViewProps } from 'react-native';
import { colors } from '../styles';

type ScreenProps = ViewProps & {
  children: ReactNode;
};

export const Screen = ({ children, style }: ScreenProps) => {
  return <View style={[{ flex: 1, backgroundColor: colors.background }, style]}>{children}</View>;
};
