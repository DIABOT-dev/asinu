import { Image, Text, View, StyleSheet, ViewStyle, StyleProp, ImageStyle } from 'react-native';
import { colors, spacing, typography } from '../styles';

type Props = {
  name: string;
  imageUrl?: string;
  size?: number;
  containerStyle?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
};

export const Avatar = ({ name, imageUrl, size = 56, containerStyle, imageStyle }: Props) => {
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
      <Text style={styles.initials}>{initials}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border
  },
  initials: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: typography.size.lg,
    fontFamily: 'System'
  }
});
