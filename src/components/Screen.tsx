import { ReactNode } from 'react';
import { View, ViewProps } from 'react-native';
import { useThemeColors } from '../hooks/useThemeColors';
import { ScreenReadyGate } from './ScreenReadyGate';

type ScreenProps = ViewProps & {
  children: ReactNode;
  deferRender?: boolean;
};

/**
 * Screen wrapper — clean off-white background (#fbfbfb).
 * Cards/panels render trên đó với surface=#ffffff để tạo nhẹ depth.
 */
export const Screen = ({ children, deferRender = true, style }: ScreenProps) => {
  const { colors } = useThemeColors();
  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }, style]}>
      {deferRender ? <ScreenReadyGate>{children}</ScreenReadyGate> : children}
    </View>
  );
};
