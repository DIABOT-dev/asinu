import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useTranslation } from "react-i18next";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";
import {
  RULER_TICK_SPACING,
  formatMeasurementValue,
  measurementRange,
  rulerOffsetForValue,
  rulerValueAtOffset,
  type MeasurementKind,
} from "./measurement-ruler";

const person = require("../../../assets/images/profile/measurement-person.png");
type Props = {
  kind: MeasurementKind;
  value: string;
  disabled?: boolean;
  onChange: (value: number) => void;
  onInteractionChange: (moving: boolean) => void;
};
export function MeasurementRuler({
  kind,
  value,
  disabled = false,
  onChange,
  onInteractionChange,
}: Props) {
  const { t } = useTranslation("profile");
  const { colors, isDark } = useThemeColors();
  const { height } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const initialValue = useRef(value).current;
  const range = useMemo(
    () => measurementRange(kind, initialValue),
    [kind, initialValue]
  );
  const selected = Number(value) > 0 ? Number(value) : range.initial;
  const unit = t(kind === "height" ? "unitCm" : "unitKg");
  const label = t(kind === "height" ? "height" : "weight");
  const ticks = useMemo(
    () =>
      Array.from(
        { length: Math.round((range.max - range.min) / range.step) + 1 },
        (_, index) => Number((range.min + index * range.step).toFixed(1))
      ),
    [range]
  );
  const list = useRef<FlatList<number>>(null);
  const touching = useRef(false);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastValue = useRef(selected);
  const stageHeight = Math.min(240, Math.max(170, height * 0.26));
  const bodyHeight = stageHeight - 32;
  // Weight changes width only; the reference figure is shown at 65 kg.
  const bodyWidthScale =
    kind === "weight"
      ? Math.max(0.65, Math.min(1.8, Math.sqrt(selected / 65)))
      : 1;
  const targetScale =
    kind === "height"
      ? 0.5 +
        0.5 *
          Math.max(
            0,
            Math.min(1, (selected - range.min) / (range.max - range.min))
          )
      : 0.92;
  const scale = useRef(new Animated.Value(targetScale)).current;
  useEffect(() => {
    const animation = Animated.timing(scale, {
      toValue: targetScale,
      duration: 100,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [scale, targetScale]);
  useEffect(() => {
    if (width && !touching.current)
      list.current?.scrollToOffset({
        offset: rulerOffsetForValue(selected, range),
        animated: false,
      });
    lastValue.current = selected;
  }, [width, selected, range]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  const emit = (next: number) => {
    if (disabled || !mounted.current || next === lastValue.current) return;
    lastValue.current = next;
    onChange(next);
  };
  const readScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (touching.current && !disabled)
      emit(rulerValueAtOffset(event.nativeEvent.contentOffset.x, range));
  };
  const finish = (offset: number) => {
    if (!mounted.current) return;
    if (timer.current) clearTimeout(timer.current);
    const next = rulerValueAtOffset(offset, range);
    if (!disabled) {
      lastValue.current = next;
      onChange(next);
    }
    touching.current = false;
    onInteractionChange(false);
    list.current?.scrollToOffset({
      offset: rulerOffsetForValue(next, range),
      animated: false,
    });
  };
  const start = () => {
    if (disabled) return;
    if (timer.current) clearTimeout(timer.current);
    touching.current = true;
    onInteractionChange(true);
  };
  const format = formatMeasurementValue;

  return (
    <View style={styles.container}>
      <View style={styles.readout} accessibilityLiveRegion="polite">
        <Text style={[styles.number, { color: colors.primaryText }]}>
          {format(selected)}
        </Text>
        <Text style={[styles.unit, { color: colors.textSecondary }]}>
          {unit}
        </Text>
      </View>
      <View
        style={[styles.personStage, { height: stageHeight }]}
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        <View
          style={[
            styles.personBackdrop,
            { backgroundColor: colors.primaryLight },
          ]}
        />
        <Animated.Image
          source={person}
          resizeMode="contain"
          resizeMethod="resize"
          style={{
            position: "absolute",
            bottom: kind === "weight" ? 28 : 14,
            height: bodyHeight,
            width: bodyHeight * 0.5,
            transform: [
              {
                translateY: scale.interpolate({
                  inputRange: [0, 1],
                  outputRange: [bodyHeight / 2, 0],
                }),
              },
              { scale },
              { scaleX: bodyWidthScale },
            ],
          }}
        />
        {kind === "weight" ? (
          <View
            style={[
              styles.scalePlatform,
              {
                backgroundColor: colors.primaryLight,
                borderColor: colors.primaryText,
              },
            ]}
          >
            <View
              style={[
                styles.scaleDisplay,
                { backgroundColor: colors.primaryText },
              ]}
            >
              <Text style={styles.scaleText}>{format(selected)}</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.floor, { backgroundColor: colors.border }]} />
        )}
      </View>
      <View
        style={styles.ruler}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        accessibilityValue={{
          min: range.min,
          max: range.max,
          now: selected,
          text: `${format(selected)} ${unit}`,
        }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(event) => {
          if (disabled) return;
          const step =
            event.nativeEvent.actionName === "increment"
              ? range.step
              : -range.step;
          const next = Math.min(
            range.max,
            Math.max(range.min, Number((selected + step).toFixed(1)))
          );
          onChange(next);
        }}
      >
        {width > 0 && (
          <FlatList<number>
            ref={list}
            testID="measurement-horizontal-ruler"
            horizontal
            data={ticks}
            scrollEnabled={!disabled}
            showsHorizontalScrollIndicator={false}
            bounces={false}
            overScrollMode="never"
            nestedScrollEnabled
            directionalLockEnabled
            snapToInterval={RULER_TICK_SPACING}
            decelerationRate="fast"
            contentContainerStyle={{
              paddingHorizontal: (width - RULER_TICK_SPACING) / 2,
            }}
            keyExtractor={(item) => String(item)}
            initialNumToRender={Math.ceil(width / RULER_TICK_SPACING) + 4}
            getItemLayout={(_data, index) => ({
              length: RULER_TICK_SPACING,
              offset: RULER_TICK_SPACING * index,
              index,
            })}
            onScroll={readScroll}
            scrollEventThrottle={16}
            onScrollBeginDrag={start}
            onMomentumScrollBegin={() => {
              if (touching.current) start();
            }}
            onScrollEndDrag={(event) => {
              readScroll(event);
              const offset = event.nativeEvent.contentOffset.x;
              timer.current = setTimeout(() => {
                if (touching.current) finish(offset);
              }, 140);
            }}
            onMomentumScrollEnd={(event) => {
              if (touching.current) finish(event.nativeEvent.contentOffset.x);
            }}
            renderItem={({ item }) => {
              const major =
                kind === "height"
                  ? item % 10 === 0
                  : Math.abs(item - Math.round(item)) < 0.001;
              const middle =
                kind === "height"
                  ? item % 5 === 0
                  : Math.abs(item * 2 - Math.round(item * 2)) < 0.001;
              return (
                <Pressable
                  accessible={false}
                  disabled={disabled}
                  style={styles.tick}
                  onPress={() => {
                    if (disabled) return;
                    lastValue.current = item;
                    onChange(item);
                    touching.current = false;
                    onInteractionChange(false);
                    list.current?.scrollToOffset({
                      offset: rulerOffsetForValue(item, range),
                      animated: false,
                    });
                  }}
                >
                  <View
                    style={{
                      width: major ? 2 : 1,
                      height: major ? 34 : middle ? 24 : 14,
                      backgroundColor: major
                        ? colors.primaryText
                        : colors.textSecondary,
                      opacity: isDark ? 0.9 : 0.65,
                    }}
                  />
                  {major && (
                    <Text
                      style={[
                        styles.tickLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {String(item)}
                    </Text>
                  )}
                </Pressable>
              );
            }}
          />
        )}
        <View
          style={[styles.pointer, { backgroundColor: colors.primary }]}
          pointerEvents="none"
        />
      </View>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        {t("dragMeasurementRuler")}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { gap: 10 },
  readout: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 8,
  },
  number: { fontSize: 36, fontWeight: "700" },
  unit: { fontSize: 17, fontWeight: "500" },
  personStage: { alignItems: "center", justifyContent: "flex-end" },
  personBackdrop: {
    position: "absolute",
    bottom: 12,
    width: 176,
    height: 176,
    borderRadius: 88,
    opacity: 0.6,
  },
  scalePlatform: {
    position: "absolute",
    bottom: 7,
    width: 122,
    height: 22,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scaleDisplay: {
    width: 56,
    height: 17,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  scaleText: { fontSize: 9, fontWeight: "700", color: "#F2FFFC" },
  floor: {
    position: "absolute",
    bottom: 10,
    width: 140,
    height: 3,
    borderRadius: 2,
  },
  ruler: { height: 78, overflow: "hidden" },
  tick: { width: RULER_TICK_SPACING, height: 76, alignItems: "center" },
  tickLabel: {
    position: "absolute",
    top: 40,
    width: 52,
    textAlign: "center",
    fontSize: 12,
  },
  pointer: {
    position: "absolute",
    left: "50%",
    top: 0,
    width: 3,
    height: 39,
    marginLeft: -1.5,
    borderRadius: 2,
  },
  hint: { fontSize: 14, textAlign: "center" },
});
