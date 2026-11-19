import { Image } from "expo-image";
import { type ImageStyle, type StyleProp } from "react-native";

type ArticleImage = {
  id?: string | null;
  content_id?: string | null;
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

const articleCovers = new Map<string, number>([
  [
    "family-dont-just-ask",
    require("../../../assets/images/health-feed/family-dont-just-ask.webp"),
  ],
  [
    "family-5-signs-to-watch",
    require("../../../assets/images/health-feed/family-5-signs-to-watch.webp"),
  ],
  [
    "family-tired-after-meal",
    require("../../../assets/images/health-feed/family-tired-after-meal.webp"),
  ],
  [
    "family-diabetes-3-moments",
    require("../../../assets/images/health-feed/family-diabetes-3-moments.webp"),
  ],
  [
    "family-call-doctor-immediately",
    require("../../../assets/images/health-feed/family-call-doctor-immediately.webp"),
  ],
  [
    "family-first-7-days-guide",
    require("../../../assets/images/health-feed/family-first-7-days-guide.webp"),
  ],
  [
    "family-post-meal-lethargy",
    require("../../../assets/images/health-feed/family-post-meal-lethargy.webp"),
  ],
  [
    "family-remind-without-pressure",
    require("../../../assets/images/health-feed/family-remind-without-pressure.webp"),
  ],
  [
    "family-1-min-inquiry-template",
    require("../../../assets/images/health-feed/family-1-min-inquiry-template.webp"),
  ],
  [
    "family-why-parents-hide-symptoms",
    require("../../../assets/images/health-feed/family-why-parents-hide-symptoms.webp"),
  ],
  [
    "diabetes-post-meal-fatigue",
    require("../../../assets/images/health-feed/diabetes-post-meal-fatigue.webp"),
  ],
  [
    "diabetes-thirst-urination",
    require("../../../assets/images/health-feed/diabetes-thirst-urination.webp"),
  ],
  [
    "diabetes-postprandial-glucose",
    require("../../../assets/images/health-feed/diabetes-postprandial-glucose.webp"),
  ],
  [
    "diabetes-dont-skip-breakfast",
    require("../../../assets/images/health-feed/diabetes-dont-skip-breakfast.webp"),
  ],
  [
    "diabetes-hypoglycemia-signs",
    require("../../../assets/images/health-feed/diabetes-hypoglycemia-signs.webp"),
  ],
  [
    "diabetes-when-to-notify-family",
    require("../../../assets/images/health-feed/diabetes-when-to-notify-family.webp"),
  ],
  [
    "diabetes-importance-of-logs",
    require("../../../assets/images/health-feed/diabetes-importance-of-logs.webp"),
  ],
  [
    "diabetes-daily-routine",
    require("../../../assets/images/health-feed/diabetes-daily-routine.webp"),
  ],
  [
    "diabetes-3-small-tips",
    require("../../../assets/images/health-feed/diabetes-3-small-tips.webp"),
  ],
  [
    "diabetes-when-to-visit-clinic",
    require("../../../assets/images/health-feed/diabetes-when-to-visit-clinic.webp"),
  ],
  [
    "hypertension-fast-heartbeat",
    require("../../../assets/images/health-feed/hypertension-fast-heartbeat.webp"),
  ],
  [
    "hypertension-headache-handling",
    require("../../../assets/images/health-feed/hypertension-headache-handling.webp"),
  ],
  [
    "general-dizziness-warning",
    require("../../../assets/images/health-feed/general-dizziness-warning.webp"),
  ],
  [
    "general-chest-pain-guide",
    require("../../../assets/images/health-feed/general-chest-pain-guide.webp"),
  ],
  [
    "general-shortness-of-breath",
    require("../../../assets/images/health-feed/general-shortness-of-breath.webp"),
  ],
  [
    "general-chronic-fatigue",
    require("../../../assets/images/health-feed/general-chronic-fatigue.webp"),
  ],
  [
    "general-poor-sleep",
    require("../../../assets/images/health-feed/general-poor-sleep.webp"),
  ],
  [
    "general-dehydration-fatigue",
    require("../../../assets/images/health-feed/general-dehydration-fatigue.webp"),
  ],
  [
    "hypertension-when-to-remeasure",
    require("../../../assets/images/health-feed/hypertension-when-to-remeasure.webp"),
  ],
  [
    "general-need-family-help",
    require("../../../assets/images/health-feed/general-need-family-help.webp"),
  ],
  [
    "onboarding-profile-summary",
    require("../../../assets/images/health-feed/onboarding-profile-summary.webp"),
  ],
  [
    "onboarding-three-daily-signals",
    require("../../../assets/images/health-feed/onboarding-three-daily-signals.webp"),
  ],
  [
    "reactivate-high-value-article",
    require("../../../assets/images/health-feed/reactivate-high-value-article.webp"),
  ],
  [
    "winback-welcome-back-1",
    require("../../../assets/images/health-feed/winback-welcome-back-1.webp"),
  ],
  [
    "winback-welcome-back-2",
    require("../../../assets/images/health-feed/winback-welcome-back-2.webp"),
  ],
  [
    "winback-welcome-back-3",
    require("../../../assets/images/health-feed/winback-welcome-back-3.webp"),
  ],
]);

// The offline reading list contains local versions of these five articles.
const curatedArticleIds = new Map([
  ["curated-1", "family-why-parents-hide-symptoms"],
  ["curated-2", "family-1-min-inquiry-template"],
  ["curated-3", "family-remind-without-pressure"],
  ["curated-4", "family-first-7-days-guide"],
  ["curated-5", "family-5-signs-to-watch"],
]);

export function HealthFeedThumbnail({
  item,
  style,
}: {
  item: ArticleImage;
  style: StyleProp<ImageStyle>;
}) {
  const articleId = item.content_id ?? item.id;
  const cover = articleId
    ? articleCovers.get(curatedArticleIds.get(articleId) ?? articleId)
    : undefined;
  const type = item.feed_type || item.content_type || item.iconType;
  const source = cover ?? (
    type === "warning" || type === "shield"
      ? artwork.warning
      : type === "family_note" || type === "family" || type === "chat"
        ? artwork.family
        : type === "checklist" || type === "schedule" || type === "weekly_summary"
          ? artwork.checklist
          : artwork.advice
  );
  const widePhoto = source === artwork.warning || source === artwork.advice;
  return (
    <Image
      source={source}
      style={style}
      contentFit="cover"
      contentPosition={widePhoto ? { left: "100%", top: "50%" } : "center"}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
