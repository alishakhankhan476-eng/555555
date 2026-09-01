import { useState, useRef, useEffect } from "react";
import { View, KeyboardAvoidingView, Platform, Pressable, TextInput, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, spacing, radius, fontSize } from "@/src/theme";
import { AppText, Button, useToast, Icon } from "@/src/ui";
import { useAuth } from "@/src/auth";

export default function Verify() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { verifyOtp, resendOtp } = useAuth();
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [cooldown, setCooldown] = useState(45);
  const inputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const setDigit = (i: number, v: string) => {
    const clean = v.replace(/[^0-9]/g, "");
    const next = [...digits];
    if (clean.length > 1) {
      // paste
      const chars = clean.slice(0, 6).split("");
      for (let k = 0; k < 6; k++) next[k] = chars[k] || "";
      setDigits(next);
      inputs.current[Math.min(chars.length, 5)]?.focus();
      return;
    }
    next[i] = clean;
    setDigits(next);
    if (clean && i < 5) inputs.current[i + 1]?.focus();
  };

  const onKeyPress = (i: number, key: string) => {
    if (key === "Backspace" && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
  };

  const onVerify = async () => {
    const code = digits.join("");
    if (code.length !== 6) { setErr("Enter the 6-digit code"); return; }
    setErr(""); setLoading(true);
    try {
      await verifyOtp(String(email), code);
      toast.show("Email verified", "success");
      router.replace("/(tabs)");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    try {
      await resendOtp(String(email));
      toast.show("New code sent", "success");
      setCooldown(45);
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, padding: spacing.xl, paddingTop: insets.top + spacing.lg }}>
        <Pressable testID="verify-back" onPress={() => router.back()} style={{ marginBottom: spacing.lg }}>
          <Icon name="chevron-back" size={26} />
        </Pressable>
        <AppText size="xxl" weight="heavy" style={{ marginBottom: 8 }}>Verify your email</AppText>
        <AppText muted style={{ marginBottom: spacing.xxl }}>
          Enter the 6-digit code we sent to{"\n"}
          <AppText weight="semibold">{email}</AppText>
        </AppText>

        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.lg }}>
          {digits.map((d, i) => (
            <TextInput
              key={i}
              testID={`otp-input-${i}`}
              ref={(r) => { inputs.current[i] = r; }}
              value={d}
              onChangeText={(v) => setDigit(i, v)}
              onKeyPress={(e) => onKeyPress(i, e.nativeEvent.key)}
              keyboardType="number-pad"
              maxLength={i === 0 ? 6 : 1}
              style={[styles.otpBox, { backgroundColor: colors.surfaceTertiary, borderColor: d ? colors.brandPrimary : colors.border, color: colors.onSurface }]}
            />
          ))}
        </View>
        {err ? <AppText size="sm" color={colors.error} style={{ marginBottom: spacing.md }}>{err}</AppText> : null}

        <Button testID="verify-submit-button" title="Verify" onPress={onVerify} loading={loading} />

        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: spacing.xl, alignItems: "center" }}>
          {cooldown > 0 ? (
            <AppText muted>Resend available in {cooldown}s</AppText>
          ) : (
            <Pressable testID="resend-otp-button" onPress={onResend}>
              <AppText weight="bold" color={colors.brandPrimary}>Resend Code</AppText>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  otpBox: { width: 48, height: 58, borderRadius: radius.md, borderWidth: 1.5, textAlign: "center", fontSize: fontSize.xxl, fontWeight: "700" },
});
