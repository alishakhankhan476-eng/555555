import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import {
  View, Text, Pressable, TextInput, StyleSheet, ActivityIndicator,
  ViewStyle, TextStyle, StyleProp, Animated, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useTheme, spacing, radius, fontSize, Colors } from "@/src/theme";

/* ---------------- Text ---------------- */
export function AppText({
  children, size = "base", weight = "regular", color, muted, style, numberOfLines, center,
}: {
  children: React.ReactNode;
  size?: keyof typeof fontSize;
  weight?: "regular" | "medium" | "semibold" | "bold" | "heavy";
  color?: string;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  center?: boolean;
}) {
  const { colors } = useTheme();
  const wMap: Record<string, TextStyle["fontWeight"]> = {
    regular: "400", medium: "500", semibold: "600", bold: "700", heavy: "800",
  };
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        { fontSize: fontSize[size], fontWeight: wMap[weight], color: color || (muted ? colors.onSurfaceMuted : colors.onSurface) },
        center && { textAlign: "center" },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/* ---------------- Icon ---------------- */
export function Icon({ name, size = 22, color }: { name: any; size?: number; color?: string }) {
  const { colors } = useTheme();
  return <Ionicons name={name} size={size} color={color || colors.onSurface} />;
}

/* ---------------- Button ---------------- */
export function Button({
  title, onPress, variant = "primary", loading, disabled, icon, style, testID, full = true,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  icon?: any;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  full?: boolean;
}) {
  const { colors } = useTheme();
  const bg =
    variant === "primary" ? colors.brandPrimary :
    variant === "secondary" ? colors.surfaceTertiary :
    variant === "danger" ? colors.error : "transparent";
  const fg =
    variant === "primary" || variant === "danger" ? "#FFFFFF" :
    variant === "ghost" ? colors.brandPrimary : colors.onSurface;
  return (
    <Pressable
      testID={testID}
      disabled={disabled || loading}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        full && { alignSelf: "stretch" },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.btnRow}>
          {icon && <Ionicons name={icon} size={18} color={fg} style={{ marginRight: 8 }} />}
          <Text style={{ color: fg, fontWeight: "700", fontSize: fontSize.lg }}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

/* ---------------- Card ---------------- */
export function Card({ children, style, onPress, testID }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; testID?: string;
}) {
  const { colors } = useTheme();
  const content = (
    <View testID={testID} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      {children}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
        {content}
      </Pressable>
    );
  }
  return content;
}

/* ---------------- Avatar ---------------- */
export function Avatar({ name, uri, size = 48, online }: {
  name?: string; uri?: string | null; size?: number; online?: boolean;
}) {
  const { colors } = useTheme();
  const initials = (name || "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  return (
    <View>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />
      ) : (
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.onBrandTertiary, fontWeight: "700", fontSize: size * 0.36 }}>{initials}</Text>
        </View>
      )}
      {online && (
        <View style={{ position: "absolute", right: 0, bottom: 0, width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14, backgroundColor: colors.success, borderWidth: 2, borderColor: colors.card }} />
      )}
    </View>
  );
}

/* ---------------- Input ---------------- */
export function Input({
  value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize, testID,
  icon, label, error, onSubmitEditing, returnKeyType, multiline, style,
}: any) {
  const { colors } = useTheme();
  const [focus, setFocus] = useState(false);
  const [hide, setHide] = useState(!!secureTextEntry);
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label && <AppText size="sm" weight="semibold" muted style={{ marginBottom: 6 }}>{label}</AppText>}
      <View style={[styles.inputWrap, { backgroundColor: colors.surfaceTertiary, borderColor: error ? colors.error : focus ? colors.brandPrimary : colors.border }, style]}>
        {icon && <Ionicons name={icon} size={18} color={colors.onSurfaceMuted} style={{ marginRight: 8 }} />}
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.onSurfaceMuted}
          secureTextEntry={hide}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize || "none"}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          multiline={multiline}
          style={{ flex: 1, color: colors.onSurface, fontSize: fontSize.lg, paddingVertical: 0, minHeight: multiline ? 80 : undefined }}
        />
        {secureTextEntry && (
          <Pressable onPress={() => setHide((h) => !h)} hitSlop={10}>
            <Ionicons name={hide ? "eye-off-outline" : "eye-outline"} size={18} color={colors.onSurfaceMuted} />
          </Pressable>
        )}
      </View>
      {error ? <AppText size="sm" color={colors.error} style={{ marginTop: 4 }}>{error}</AppText> : null}
    </View>
  );
}

/* ---------------- Chip ---------------- */
export function Chip({ label, active, onPress, icon, testID }: {
  label: string; active?: boolean; onPress?: () => void; icon?: any; testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: active ? colors.brandPrimary : colors.card, borderColor: active ? colors.brandPrimary : colors.border }]}
    >
      {icon && <Ionicons name={icon} size={14} color={active ? "#fff" : colors.onSurfaceMuted} style={{ marginRight: 6 }} />}
      <Text style={{ color: active ? "#fff" : colors.onSurface, fontWeight: "600", fontSize: fontSize.base }}>{label}</Text>
    </Pressable>
  );
}

/* ---------------- Empty / Loading / Error ---------------- */
export function EmptyState({ icon, title, subtitle, action }: {
  icon?: any; title: string; subtitle?: string; action?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.centerBox}>
      {icon && (
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg }}>
          <Ionicons name={icon} size={32} color={colors.brandPrimary} />
        </View>
      )}
      <AppText size="lg" weight="bold" center>{title}</AppText>
      {subtitle && <AppText muted center style={{ marginTop: 6, maxWidth: 280 }}>{subtitle}</AppText>}
      {action && <View style={{ marginTop: spacing.lg }}>{action}</View>}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.centerBox}>
      <ActivityIndicator color={colors.brandPrimary} size="large" />
      {label && <AppText muted style={{ marginTop: spacing.md }}>{label}</AppText>}
    </View>
  );
}

export function Skeleton({ height = 64, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[{ height, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, opacity: 0.7 }, style]} />;
}

/* ---------------- Toast ---------------- */
type ToastType = "info" | "success" | "error";
const ToastCtx = createContext<{ show: (msg: string, type?: ToastType) => void }>({ show: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const [msg, setMsg] = useState<string | null>(null);
  const [type, setType] = useState<ToastType>("info");
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<any>(null);

  const show = useCallback((m: string, t: ToastType = "info") => {
    setMsg(m); setType(t);
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setMsg(null));
    }, 2800);
  }, [opacity]);

  const bg = type === "error" ? colors.error : type === "success" ? colors.success : colors.inverse;
  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      {msg && (
        <Animated.View pointerEvents="none" style={[styles.toast, { opacity, backgroundColor: bg }]}>
          <Text style={{ color: "#fff", fontWeight: "600", textAlign: "center" }}>{msg}</Text>
        </Animated.View>
      )}
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/* ---------------- Row ---------------- */
export function SettingRow({ icon, label, value, onPress, right, testID, color }: {
  icon?: any; label: string; value?: string; onPress?: () => void; right?: React.ReactNode; testID?: string; color?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.settingRow, { opacity: pressed ? 0.7 : 1 }]}>
      {icon && (
        <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", marginRight: spacing.md }}>
          <Ionicons name={icon} size={18} color={colors.brandPrimary} />
        </View>
      )}
      <AppText style={{ flex: 1 }} weight="medium" color={color}>{label}</AppText>
      {value ? <AppText muted style={{ marginRight: 6 }}>{value}</AppText> : null}
      {right !== undefined ? right : onPress ? <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceMuted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { height: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  btnRow: { flexDirection: "row", alignItems: "center" },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg },
  inputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, minHeight: 52 },
  chip: { flexDirection: "row", alignItems: "center", height: 38, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, flexShrink: 0 },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  toast: {
    position: "absolute", bottom: 90, left: spacing.xl, right: spacing.xl, padding: spacing.md,
    borderRadius: radius.md, ...Platform.select({ ios: { shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 6 } }),
  },
  settingRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, minHeight: 48 },
});
