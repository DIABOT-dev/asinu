import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { ScaledText as Text } from "../../components/ScaledText";
import { ScreenBackButton } from "../../components/ScreenHeaderButton";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useScaledFontSize } from "../../hooks/useScaledTypography";
import { HealthFeedThumbnail } from "./HealthFeedThumbnail";
import {
  articleBlocks,
  articleCategory,
  articleChecklistHeading,
  articlePlainText,
  articleReadingMinutes,
  type HealthArticle,
} from "./article-format";

function ArticleText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <Text key={index} style={styles.emphasis}>
            {part.slice(2, -2)}
          </Text>
        ) : (
          part
        )
      )}
    </>
  );
}
function ChecklistText({ text }: { text: string }) {
  const colon = text.indexOf(":");
  const titled =
    colon > 0 &&
    colon < 90 &&
    text.slice(0, colon).split(/\s+/).length <= 15 &&
    Boolean(text.slice(colon + 1).trim());
  return titled ? (
    <>
      <Text style={styles.emphasis}>{text.slice(0, colon + 1)}</Text>
      {text.slice(colon + 1)}
    </>
  ) : (
    <ArticleText text={text} />
  );
}
type Props = {
  article: HealthArticle;
  saving: boolean;
  sharing: boolean;
  onBack: () => void;
  onSave: () => void;
  onCopy: () => void;
  onShare: () => void;
  onSources: () => void;
};
export function HealthArticleReading({
  article,
  saving,
  sharing,
  onBack,
  onSave,
  onCopy,
  onShare,
  onSources,
}: Props) {
  const { t } = useTranslation("common");
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const markerWidth = useScaledFontSize(24);
  const ink = { color: colors.textPrimary },
    muted = { color: colors.textSecondary };
  const blocks = articleBlocks(article.body).filter(
    (block, index) =>
      !(
        index === 0 &&
        block.type === "paragraph" &&
        block.text === article.summary
      )
  );
  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8, backgroundColor: colors.background },
        ]}
      >
        <ScreenBackButton
          onPress={onBack}
          style={styles.headerButton}
          iconColor={colors.textPrimary}
        />
        <Text style={[styles.headerTitle, ink]}>{t("feedArticleChannel")}</Text>
        {article.saveable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(
              article.is_saved ? "feedArticleUnsave" : "feedArticleSave"
            )}
            accessibilityState={{
              selected: article.is_saved,
              disabled: saving,
              busy: saving,
            }}
            disabled={saving}
            onPress={onSave}
            style={styles.headerButton}
          >
            {saving ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Ionicons
                name={article.is_saved ? "bookmark" : "bookmark-outline"}
                size={23}
                color={colors.primaryText}
              />
            )}
          </Pressable>
        ) : (
          <View style={styles.headerButton} accessible={false} />
        )}
      </View>
      <ScrollView
        testID="health-article-scroll"
        key={article.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Math.max(insets.bottom, 20) + 24 },
        ]}
      >
        <View style={styles.column}>
          <View style={styles.masthead}>
            <View style={styles.meta}>
              <Text
                style={[
                  styles.category,
                  {
                    color:
                      article.content_type === "warning"
                        ? colors.danger
                        : colors.primaryText,
                  },
                ]}
              >
                {t(articleCategory(article.content_type))}
              </Text>
              <View style={styles.readingTime}>
                <Ionicons
                  name="time-outline"
                  size={15}
                  color={colors.textSecondary}
                  accessible={false}
                />
                <Text style={[styles.metaText, muted]}>
                  {t("feedArticleReadingTime", {
                    count: articleReadingMinutes(article),
                  })}
                </Text>
              </View>
            </View>
            <Text accessibilityRole="header" style={[styles.title, ink]}>
              {article.title}
            </Text>
            {!!article.summary && (
              <Text style={[styles.lead, muted]}>{article.summary}</Text>
            )}
          </View>
          <HealthFeedThumbnail item={article} style={styles.cover} />
          <View style={styles.prose}>
            {blocks.map((block, index) =>
              block.type === "heading" ? (
                <Text
                  key={index}
                  accessibilityRole="header"
                  style={[
                    block.level === 2
                      ? styles.sectionHeading
                      : styles.subheading,
                    ink,
                  ]}
                >
                  {articlePlainText(block.text)}
                </Text>
              ) : block.type === "paragraph" ? (
                <Text key={index} style={[styles.body, ink]}>
                  <ArticleText text={block.text} />
                </Text>
              ) : (
                <View key={index} style={styles.list}>
                  {block.items.map((text, itemIndex) => (
                    <View key={itemIndex} style={styles.listRow}>
                      <Text
                        style={[
                          styles.listMarker,
                          { color: colors.primaryText, width: markerWidth },
                        ]}
                        accessible={false}
                      >
                        {block.ordered ? `${block.ordinals[itemIndex]}.` : "•"}
                      </Text>
                      <Text style={[styles.body, styles.listCopy, ink]}>
                        <ArticleText text={text} />
                      </Text>
                    </View>
                  ))}
                </View>
              )
            )}
          </View>
          {article.checklist.length > 0 && (
            <View style={styles.takeaways}>
              <Text
                accessibilityRole="header"
                style={[styles.sectionHeading, ink]}
              >
                {t(articleChecklistHeading(article.content_type))}
              </Text>
              {article.checklist.map((item, index) => (
                <View key={index} style={styles.takeaway}>
                  <Text
                    style={[
                      styles.listMarker,
                      { color: colors.primaryText, width: markerWidth },
                    ]}
                    accessible={false}
                  >
                    {index + 1}.
                  </Text>
                  <Text style={[styles.body, styles.listCopy, ink]}>
                    <ChecklistText text={item} />
                  </Text>
                </View>
              ))}
            </View>
          )}
          <View style={[styles.references, { borderColor: colors.border }]}>
            <Text
              accessibilityRole="header"
              style={[styles.referenceTitle, ink]}
            >
              {t("healthSourcesTitle")}
            </Text>
            <Text style={[styles.referenceNote, muted]}>
              {t("feedArticleSourcesNote")}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("healthSourcesOpen")}
              onPress={onSources}
              style={styles.sourceAction}
            >
              <Text style={[styles.link, { color: colors.primaryText }]}>
                {t("healthSourcesOpen")}
              </Text>
              <Ionicons
                name="arrow-forward"
                size={18}
                color={colors.primaryText}
                accessible={false}
              />
            </Pressable>
          </View>
          {article.shareable && (
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("feedCopy")}
                accessibilityState={{ disabled: sharing }}
                disabled={sharing}
                onPress={onCopy}
                style={[
                  styles.action,
                  { backgroundColor: colors.surfaceMuted },
                ]}
              >
                <Ionicons
                  name="copy-outline"
                  size={19}
                  color={colors.primaryText}
                  accessible={false}
                />
                <Text
                  style={[styles.actionText, { color: colors.primaryText }]}
                >
                  {t("feedCopy")}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("feedShare")}
                accessibilityState={{ disabled: sharing, busy: sharing }}
                disabled={sharing}
                onPress={onShare}
                style={[
                  styles.action,
                  { backgroundColor: colors.primaryLight },
                ]}
              >
                <Ionicons
                  name="share-outline"
                  size={20}
                  color={colors.primaryText}
                  accessible={false}
                />
                <Text
                  style={[styles.actionText, { color: colors.primaryText }]}
                >
                  {t("feedShare")}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
  },
  scroll: { paddingHorizontal: 24, paddingTop: 20 },
  column: { width: "100%", maxWidth: 680, alignSelf: "center" },
  masthead: { gap: 16, marginBottom: 24 },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    columnGap: 16,
    rowGap: 8,
  },
  category: { fontSize: 13, lineHeight: 20, fontWeight: "700" },
  readingTime: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { fontSize: 13, lineHeight: 20 },
  title: {
    fontSize: 29,
    lineHeight: 40,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  lead: { fontSize: 18, lineHeight: 29 },
  cover: {
    width: "100%",
    aspectRatio: 1.85,
    borderRadius: 18,
    marginBottom: 28,
  },
  prose: { gap: 20 },
  body: { fontSize: 18, lineHeight: 30 },
  emphasis: { fontSize: 18, lineHeight: 30, fontWeight: "700" },
  sectionHeading: {
    fontSize: 22,
    lineHeight: 31,
    fontWeight: "700",
    marginTop: 8,
  },
  subheading: { fontSize: 20, lineHeight: 29, fontWeight: "700", marginTop: 4 },
  list: { gap: 14 },
  listRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  listMarker: {
    flexShrink: 0,
    fontSize: 18,
    lineHeight: 30,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  listCopy: { flex: 1, minWidth: 0 },
  takeaways: { gap: 20, marginTop: 24 },
  takeaway: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  references: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  referenceTitle: { fontSize: 16, lineHeight: 24, fontWeight: "700" },
  referenceNote: { fontSize: 14, lineHeight: 23 },
  sourceAction: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    flexWrap: "wrap",
    gap: 8,
    paddingVertical: 8,
  },
  link: { fontSize: 14, lineHeight: 23, fontWeight: "600" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 24 },
  action: {
    flexBasis: 180,
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 52,
    padding: 12,
    borderRadius: 14,
  },
  actionText: {
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "600",
    textAlign: "center",
  },
});
