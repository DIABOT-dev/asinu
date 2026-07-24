import { ReactNode } from 'react';
import { View, ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../hooks/useThemeColors';

type ScreenProps = ViewProps & {
  children: ReactNode;
};

/**
 * Screen wrapper — a very soft brand wash keeps screens consistent with home.
 * Cards/panels render trên đó với surface=#ffffff để tạo nhẹ depth.
 */
export const Screen = ({ children, style }: ScreenProps) => {
  const { colors } = useThemeColors();
  return (
    <LinearGradient
      colors={[colors.primaryLight, colors.background, colors.background]}
      locations={[0, 0.24, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </LinearGradient>
  );
};
