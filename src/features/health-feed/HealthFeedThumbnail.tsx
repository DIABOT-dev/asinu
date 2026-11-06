import { Image } from 'expo-image';
import { type ImageStyle, type StyleProp } from "react-native";

type ArticleImage = {
  thumbnail_url?: string | null;
  cover_url?: string | null;
  content_type?: string;
  feed_type?: string;
  iconType?: string;
};

const artwork = {
  family: require("../../../assets/images/app-update/update-hero.jpg"),
  warning: require("../../../assets/images/home/checkin-unwell-background-v1.png"),
  checklist: require("../../../assets/images/app-update/update-download.jpg"),
  advice: require("../../../assets/images/home/checkin-fine-background-v1.png"),
};

/** Bundled photos of people keep article thumbnails consistent and available offline. */
export function HealthFeedThumbnail({
  item,
  style,
}: {
  item: ArticleImage;
  style: StyleProp<ImageStyle>;
}) {
  const type = item.feed_type || item.content_type || item.iconType;
  const fallback =
    type === "warning" || type === "shield"
      ? artwork.warning
      : type === "family_note" || type === "family" || type === "chat"
      ? artwork.family
      : type === "checklist" || type === "schedule" || type === "weekly_summary"
      ? artwork.checklist
      : artwork.advice;
  const widePhoto = fallback === artwork.warning || fallback === artwork.advice;
  return (
    <Image
      source={fallback}
      style={style}
      contentFit="cover"
      contentPosition={widePhoto ? { left: '100%', top: '50%' } : 'center'}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
