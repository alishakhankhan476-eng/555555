import { useState } from "react";
import { View, KeyboardAvoidingView, Platform, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, spacing } from "@/src/theme";
import { AppText, Input, Button, useToast, Icon } from "@/src/ui";
import { useAuth } from "@/src/auth";

export default function Forgot() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { forgot, reset } = useAuth();
  const [stage, setStage] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPass, setNewPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const onSend = async () => {
    if (!email.trim()) { setErr("Enter your email"); return; }
    setErr(""); setLoading(true);
    try {
      await forgot(email.trim());
      toast.show("If the account exists, a reset code was sent", "success");
      setStage("reset");
    } catch (e: any) {
      setErr(e.message);
    } finally { setLoading(false); }
  };

  const onReset = async () => {
    if (code.length !== 6) { setErr("Enter the 6-digit code"); return; }
    if (newPass.length < 6) { setErr("Password must be at least 6 characters"); return; }
    setErr(""); setLoading(true);
    try {
      await reset(email.trim(), code, newPass);
      toast.show("Password updated. Please log in.", "success");
      router.replace("/(auth)/login");
    } catch (e: any) {
      setErr(e.message);
    } finally { setLoading(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: insets.top + spacing.lg, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <Pressable testID="forgot-back" onPress={() => router.back()} style={{ marginBottom: spacing.lg }}>
            <Icon name="chevron-back" size={26} />
          </Pressable>
          <AppText size="xxl" weight="heavy" style={{ marginBottom: 8 }}>Reset password</AppText>
          <AppText muted style={{ marginBottom: spacing.xl }}>
            {stage === "email" ? "Enter your email to receive a reset code" : "Enter the code and your new password"}
          </AppText>

          {stage === "email" ? (
            <>
              <Input testID="forgot-email-input" label="Email" icon="mail-outline" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" error={err} />
              <Button testID="forgot-send-button" title="Send Code" onPress={onSend} loading={loading} />
            </>
          ) : (
            <>
              <Input testID="reset-code-input" label="6-digit code" icon="keypad-outline" value={code} onChangeText={(v: string) => setCode(v.replace(/[^0-9]/g, "").slice(0, 6))} placeholder="000000" keyboardType="number-pad" />
              <Input testID="reset-password-input" label="New password" icon="lock-closed-outline" value={newPass} onChangeText={setNewPass} placeholder="At least 6 characters" secureTextEntry error={err} />
              <Button testID="reset-submit-button" title="Update Password" onPress={onReset} loading={loading} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
