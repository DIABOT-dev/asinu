import { useMemo } from 'react';
import { Image, ImageStyle, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { colors } from '../styles';

type Props = {
  name: string;
  imageUrl?: string;
  size?: number;
  containerStyle?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
};

export const Avatar = ({ name, imageUrl, size = 56, containerStyle, imageStyle }: Props) => {
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => StyleSheet.create({
    placeholder: {
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: colors.border
    },
    initials: {
      color: colors.textPrimary,
      fontWeight: '700',
      fontFamily: 'System'
    }
  }), []);
  const initials = name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (imageUrl) {
    return <Image source={{ uri: imageUrl }} style={[{ width: size, height: size, borderRadius: size / 2 }, imageStyle]} />;
  }

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2
        },
        styles.placeholder,
        containerStyle
      ]}
    >
      <Text style={[styles.initials, { fontSize: scaledTypography.size.lg }]}>{initials}</Text>
    </View>
  );
};
