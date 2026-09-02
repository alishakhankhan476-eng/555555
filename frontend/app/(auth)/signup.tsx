import { useState } from "react";
import { View, KeyboardAvoidingView, Platform, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, spacing } from "@/src/theme";
import { AppText, Input, Button, useToast, Icon } from "@/src/ui";
import { useAuth } from "@/src/auth";
import { LegalLinks } from "@/src/LegalDoc";

export default function Signup() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const onSignup = async () => {
    if (!name.trim()) { setErr("Enter your name"); return; }
    if (!email.trim()) { setErr("Enter your email"); return; }
    if (password.length < 6) { setErr("Password must be at least 6 characters"); return; }
    if (password !== confirm) { setErr("Passwords do not match"); return; }
    setErr(""); setLoading(true);
    try {
      await signup(name.trim(), email.trim(), password);
      toast.show("Verification code sent to your email", "success");
      router.push({ pathname: "/(auth)/verify", params: { email: email.trim() } });
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: insets.top + spacing.lg, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <Pressable testID="signup-back" onPress={() => router.back()} style={{ marginBottom: spacing.lg }}>
            <Icon name="chevron-back" size={26} />
          </Pressable>
          <AppText size="xxl" weight="heavy" style={{ marginBottom: 4 }}>Create account</AppText>
          <AppText muted style={{ marginBottom: spacing.xl }}>Join Chatly and let AI handle the busywork</AppText>

          <Input testID="signup-name-input" label="Name" icon="person-outline" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" />
          <Input testID="signup-email-input" label="Email" icon="mail-outline" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
          <Input testID="signup-password-input" label="Password" icon="lock-closed-outline" value={password} onChangeText={setPassword} placeholder="At least 6 characters" secureTextEntry />
          <Input testID="signup-confirm-input" label="Confirm password" icon="lock-closed-outline" value={confirm} onChangeText={setConfirm} placeholder="Re-enter password" secureTextEntry error={err} />

          <Button testID="signup-submit-button" title="Create Account" onPress={onSignup} loading={loading} style={{ marginTop: spacing.sm }} />

          <View style={{ flexDirection: "row", justifyContent: "center", marginTop: spacing.xl }}>
            <AppText muted>Already have an account? </AppText>
            <Pressable onPress={() => router.replace("/(auth)/login")}>
              <AppText weight="bold" color={colors.brandPrimary}>Log In</AppText>
            </Pressable>
          </View>

          <AppText muted center size="sm" style={{ marginTop: spacing.xl, lineHeight: 18 }}>
            By creating an account you agree to our
          </AppText>
          <LegalLinks style={{ marginTop: 6, paddingBottom: insets.bottom + spacing.md }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
