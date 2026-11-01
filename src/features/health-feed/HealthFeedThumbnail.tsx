import { useState } from "react";
import { Image, type ImageStyle, type StyleProp } from "react-native";

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
  checklist: require("../../../assets/images/checkin-guide/slide1_daily_checkin.png"),
  advice: require("../../../assets/images/home/checkin-fine-background-v1.png"),
};

/** A bundled cover remains available offline and when an article image fails. */
export function HealthFeedThumbnail({
  item,
  style,
}: {
  item: ArticleImage;
  style: StyleProp<ImageStyle>;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = item.thumbnail_url || item.cover_url;
  const type = item.feed_type || item.content_type || item.iconType;
  const fallback =
    type === "warning" || type === "shield"
      ? artwork.warning
      : type === "family_note" || type === "family" || type === "chat"
      ? artwork.family
      : type === "checklist" || type === "schedule" || type === "weekly_summary"
      ? artwork.checklist
      : artwork.advice;
  const source =
    url && /^https:\/\//i.test(url) && failedUrl !== url
      ? { uri: url }
      : fallback;
  return (
    <Image
      source={source}
      style={style}
      resizeMode="cover"
      onError={() => setFailedUrl(url || null)}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
