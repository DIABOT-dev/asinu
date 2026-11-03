import { useState, type ComponentProps } from "react";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  View,
  useWindowDimensions,
} from "react-native";
import { useTranslation } from "react-i18next";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useScaledFontSize } from "../../hooks/useScaledTypography";
import { HealthCoinIcon } from "./HealthCoinIcon";
import { coinDetailsStyles as s } from "./coin-details.styles";
import type { HealthCoinsController } from "./useHealthCoins";
import type { CoinTask } from "./v21.api";

type Icon = ComponentProps<typeof Ionicons>["name"];
function useCompactRows() {
  const { width } = useWindowDimensions();
  const fontSize = useScaledFontSize(100);
  return width < 360 || fontSize > 115;
}
const TASK_ICONS: Record<
  CoinTask["task_code"],
  ComponentProps<typeof MaterialCommunityIcons>["name"]
> = {
  CHECKIN: "heart-pulse",
  MED_ANSWER: "pill",
  VITAL: "chart-bar",
  GIFT_OPEN: "gift-open-outline",
  WEEKLY: "calendar-check-outline",
};

export function CoinAmount({
  count,
  earned = false,
}: {
  count: number;
  earned?: boolean;
}) {
  const { t } = useTranslation("v21");
  const { isDark } = useThemeColors();
  return (
    <View
      style={[s.amount, { backgroundColor: isDark ? "#3b311a" : "#fff2cc" }]}
    >
      <HealthCoinIcon size={20} />
      <Text style={[s.amountText, { color: isDark ? "#ffdf87" : "#875600" }]}>
        {t(earned ? "taskCoins" : "cost", { count })}
      </Text>
    </View>
  );
}

function CoinNotice({
  text,
  icon = "shield-checkmark-outline",
}: {
  text: string;
  icon?: Icon;
}) {
  const { colors } = useThemeColors();
  return (
    <View style={[s.notice, { backgroundColor: colors.primaryLight }]}>
      <Ionicons
        name={icon}
        size={20}
        color={colors.primaryText}
        style={s.noteIcon}
      />
      <Text style={[s.noticeText, { color: colors.primaryText }]}>{text}</Text>
    </View>
  );
}

function CoinButton({
  label,
  onPress,
  disabled = false,
  busy = false,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  secondary?: boolean;
}) {
  const { colors } = useThemeColors();
  const ink = secondary ? colors.primaryText : colors.background;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor: secondary ? colors.primaryLight : colors.primaryText,
        },
        (disabled || busy) && s.disabled,
        pressed && { opacity: 0.7 },
      ]}
    >
      {busy && <ActivityIndicator size="small" color={ink} />}
      <Text style={[s.buttonText, { color: ink }]}>{label}</Text>
    </Pressable>
  );
}

function Empty({ text, icon }: { text: string; icon: Icon }) {
  const { colors } = useThemeColors();
  return (
    <View style={s.empty}>
      <Ionicons name={icon} size={42} color={colors.primaryText} />
      <Text style={[s.emptyText, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

export function CoinEarnTab({ coins }: { coins: HealthCoinsController }) {
  const { t } = useTranslation("v21");
  const { colors } = useThemeColors();
  const compact = useCompactRows();
  const tasks =
    coins.data?.tasks.filter(
      (task) =>
        task.coins > 0 && (task.daily_limit > 0 || task.weekly_limit > 0)
    ) ?? [];
  return (
    <View style={s.content}>
      <View style={s.list}>
        {tasks.map((task) => (
          <View key={task.task_code} style={s.row}>
            <View style={s.icon}>
              <MaterialCommunityIcons
                name={TASK_ICONS[task.task_code]}
                size={26}
                color={colors.primaryText}
              />
            </View>
            <View style={s.copy}>
              <Text style={[s.title, { color: colors.textPrimary }]}>
                {t(task.task_code)}
              </Text>
              <Text style={[s.caption, { color: colors.textSecondary }]}>
                {t(
                  task.task_code === "WEEKLY"
                    ? "coinsTaskWeekly"
                    : "coinsTaskDaily",
                  {
                    count:
                      task.task_code === "WEEKLY"
                        ? task.weekly_limit
                        : task.daily_limit,
                  }
                )}
              </Text>
              {compact && (
                <View style={{ alignSelf: "flex-start" }}>
                  <CoinAmount count={task.coins} earned />
                </View>
              )}
            </View>
            {!compact && <CoinAmount count={task.coins} earned />}
          </View>
        ))}
        {!tasks.length && (
          <Empty icon="leaf-outline" text={t("journeyNoTasks")} />
        )}
      </View>
      <CoinNotice text={t("coinsFairness")} />
      <View style={s.notes}>
        <View style={s.noteRow}>
          <Ionicons
            name="time-outline"
            size={19}
            color={colors.textSecondary}
            style={s.noteIcon}
          />
          <Text style={[s.noticeText, { color: colors.textSecondary }]}>
            {t("coinsExpiryShort")}
          </Text>
        </View>
        <View style={s.noteRow}>
          <Ionicons
            name="person-outline"
            size={19}
            color={colors.textSecondary}
            style={s.noteIcon}
          />
          <Text style={[s.noticeText, { color: colors.textSecondary }]}>
            {t("coinsPersonalShort")}
          </Text>
        </View>
      </View>
    </View>
  );
}

function RadioOption({
  label,
  selected,
  onPress,
  disabled,
  initials,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled: boolean;
  initials?: string;
}) {
  const { colors } = useThemeColors();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.option, disabled && s.disabled]}
    >
      {initials && (
        <View style={[s.avatar, { backgroundColor: colors.primaryLight }]}>
          <Text style={[s.avatarText, { color: colors.primaryText }]}>
            {initials}
          </Text>
        </View>
      )}
      <Text style={[s.title, s.copy, { color: colors.textPrimary }]}>
        {label}
      </Text>
      <Ionicons
        name={selected ? "checkmark-circle" : "ellipse-outline"}
        size={24}
        color={selected ? colors.primaryText : colors.textSecondary}
      />
    </Pressable>
  );
}

function CoinRewardSelection({ coins }: { coins: HealthCoinsController }) {
  const { t, i18n } = useTranslation("v21");
  const { colors } = useThemeColors();
  const [reviewing, setReviewing] = useState(false);
  const reward = coins.selected!;
  const recipient = coins.catalog?.recipients.find(
    (person) => person.id === coins.recipient
  );
  const template = coins.catalog?.templates.find(
    (item) => item.code === coins.template
  );
  const templateName = template
    ? i18n.language.startsWith("en")
      ? template.title_en
      : template.title
    : "";
  const missing = Math.max(0, reward.cost - (coins.data?.balance ?? 0));
  const valid =
    !missing &&
    (reward.code !== "GREETING_CARD" || Boolean(recipient && template));

  return (
    <View style={s.content}>
      <View style={s.selectionHeading}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("back")}
          onPress={() =>
            reviewing ? setReviewing(false) : coins.cancelReward()
          }
          disabled={coins.busy}
          style={s.back}
        >
          <Ionicons name="arrow-back" size={22} color={colors.primaryText} />
        </Pressable>
        <Text style={[s.sectionTitle, s.copy, { color: colors.textPrimary }]}>
          {t(reviewing ? "coinsReviewTitle" : reward.code)}
        </Text>
        <CoinAmount count={reward.cost} />
      </View>
      {missing > 0 && (
        <CoinNotice
          icon="information-circle-outline"
          text={t("missingCoins", { count: missing })}
        />
      )}
      {reviewing ? (
        <View style={s.review}>
          <Text style={[s.title, { color: colors.textPrimary }]}>
            {t("redeemConfirm", { count: reward.cost })}
          </Text>
          <View style={s.reviewRow}>
            <Text style={[s.caption, { color: colors.textSecondary }]}>
              {t("coinsChosenReward")}
            </Text>
            <Text style={[s.title, { color: colors.textPrimary }]}>
              {t(reward.code)}
            </Text>
          </View>
          {recipient && (
            <View style={s.reviewRow}>
              <Text style={[s.caption, { color: colors.textSecondary }]}>
                {t("chooseRecipient")}
              </Text>
              <Text style={[s.title, { color: colors.textPrimary }]}>
                {recipient.name}
              </Text>
            </View>
          )}
          {template && (
            <View style={s.reviewRow}>
              <Text style={[s.caption, { color: colors.textSecondary }]}>
                {t("chooseTemplate")}
              </Text>
              <Text style={[s.title, { color: colors.textPrimary }]}>
                {templateName}
              </Text>
            </View>
          )}
          <CoinButton
            label={t("redeem")}
            disabled={!valid}
            busy={coins.busy}
            onPress={() => void coins.redeem()}
          />
        </View>
      ) : (
        <>
          {reward.code === "GREETING_CARD" && (
            <>
              <View
                style={s.section}
                accessibilityRole="radiogroup"
                accessibilityLabel={t("chooseRecipient")}
              >
                <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>
                  {t("chooseRecipient")}
                </Text>
                {coins.catalog?.recipients.map((person) => (
                  <RadioOption
                    key={person.id}
                    label={person.name}
                    initials={person.name
                      .trim()
                      .split(/\s+/)
                      .map((word) => word[0])
                      .slice(0, 2)
                      .join("")}
                    selected={coins.recipient === person.id}
                    onPress={() => coins.selectRecipient(person.id)}
                    disabled={coins.busy}
                  />
                ))}
              </View>
              <View
                style={s.section}
                accessibilityRole="radiogroup"
                accessibilityLabel={t("chooseTemplate")}
              >
                <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>
                  {t("chooseTemplate")}
                </Text>
                {coins.catalog?.templates.map((item) => (
                  <RadioOption
                    key={item.code}
                    label={
                      i18n.language.startsWith("en")
                        ? item.title_en
                        : item.title
                    }
                    selected={coins.template === item.code}
                    onPress={() => coins.selectTemplate(item.code)}
                    disabled={coins.busy}
                  />
                ))}
              </View>
            </>
          )}
          <CoinButton
            label={t("coinsReviewAction")}
            disabled={!valid || coins.busy}
            onPress={() => setReviewing(true)}
          />
        </>
      )}
      <CoinButton
        secondary
        label={t("cancel")}
        disabled={coins.busy}
        onPress={coins.cancelReward}
      />
    </View>
  );
}

export function CoinSpendTab({ coins }: { coins: HealthCoinsController }) {
  const { t } = useTranslation("v21");
  const { colors } = useThemeColors();
  const compact = useCompactRows();
  if (coins.selected)
    return <CoinRewardSelection key={coins.selected.code} coins={coins} />;
  return (
    <View style={s.content}>
      <View style={s.list}>
        {!coins.catalog?.items.length && (
          <Empty text={t("noRewards")} icon="gift-outline" />
        )}
        {coins.catalog?.items.map((reward) => {
          const missing = Math.max(0, reward.cost - (coins.data?.balance ?? 0));
          return (
            <View key={reward.code} style={s.reward}>
              <View style={s.rewardHeader}>
                <View style={s.icon}>
                  <Ionicons
                    name={
                      reward.code === "GREETING_CARD"
                        ? "mail-open-outline"
                        : "ticket-outline"
                    }
                    size={30}
                    color={colors.primaryText}
                  />
                </View>
                <View style={s.copy}>
                  <Text style={[s.title, { color: colors.textPrimary }]}>
                    {t(reward.code)}
                  </Text>
                  {compact && (
                    <View style={{ alignSelf: "flex-start" }}>
                      <CoinAmount count={reward.cost} />
                    </View>
                  )}
                </View>
                {!compact && <CoinAmount count={reward.cost} />}
              </View>
              <CoinButton
                secondary
                label={
                  missing
                    ? t("missingCoins", { count: missing })
                    : t("coinsChooseReward")
                }
                disabled={coins.busy || missing > 0}
                onPress={() => coins.selectReward(reward)}
              />
            </View>
          );
        })}
      </View>
      {coins.catalog?.drawPeriodId && (
        <CoinButton
          secondary
          label={t("drawRules")}
          onPress={coins.openDrawRules}
        />
      )}
      <CoinNotice icon="information-circle-outline" text={t("coinLimits")} />
    </View>
  );
}

export function CoinHistoryTab({ coins }: { coins: HealthCoinsController }) {
  const { t, i18n } = useTranslation("v21");
  const { colors } = useThemeColors();
  return (
    <View style={s.content}>
      {!coins.history.length && (
        <Empty text={t("emptyHistory")} icon="time-outline" />
      )}
      <View style={s.list}>
        {coins.history.map((entry) => (
          <View key={entry.id} style={s.row}>
            <View style={s.icon}>
              <Ionicons
                name={
                  entry.delta > 0
                    ? "add-circle-outline"
                    : "remove-circle-outline"
                }
                size={25}
                color={
                  entry.delta > 0 ? colors.primaryText : colors.textSecondary
                }
              />
            </View>
            <View style={s.copy}>
              <Text style={[s.title, { color: colors.textPrimary }]}>
                {t(entry.reason)}
              </Text>
              <Text style={[s.caption, { color: colors.textSecondary }]}>
                {new Date(entry.created_at).toLocaleString(i18n.language, {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
              {entry.reward_status && (
                <Text style={[s.status, { color: colors.primaryText }]}>
                  {t(entry.reward_status)}
                </Text>
              )}
              {entry.ticket_no && (
                <Text style={[s.caption, { color: colors.textSecondary }]}>
                  {t("ticketNumber", { number: entry.ticket_no })}
                </Text>
              )}
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <Text
                style={[
                  s.delta,
                  {
                    color:
                      entry.delta > 0
                        ? colors.primaryText
                        : colors.textSecondary,
                  },
                ]}
              >
                {entry.delta > 0 ? "+" : ""}
                {entry.delta}
              </Text>
              <HealthCoinIcon size={20} />
            </View>
          </View>
        ))}
      </View>
      {coins.hasMore && (
        <CoinButton
          secondary
          label={t("more")}
          busy={coins.busy}
          onPress={() => void coins.more()}
        />
      )}
    </View>
  );
}
