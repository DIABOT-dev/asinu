import { ReactNode } from 'react';
import { View, ViewProps } from 'react-native';
import { useThemeColors } from '../hooks/useThemeColors';

type ScreenProps = ViewProps & {
  children: ReactNode;
};

/**
 * Screen wrapper — clean off-white background (#fbfbfb).
 * Cards/panels render trên đó với surface=#ffffff để tạo nhẹ depth.
 */
export const Screen = ({ children, style }: ScreenProps) => {
  const { colors } = useThemeColors();
  return <View style={[{ flex: 1, backgroundColor: colors.background }, style]}>{children}</View>;
};
