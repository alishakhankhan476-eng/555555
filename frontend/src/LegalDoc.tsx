import React from "react";
import { View, ScrollView, Pressable, Linking } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, spacing, radius } from "@/src/theme";
import { AppText, Icon } from "@/src/ui";
import { StackHeader } from "@/src/Header";

export const SUPPORT_EMAIL = "jarvisai9077@gmail.com";

export function LegalLinks({ style }: { style?: any }) {
  const router = useRouter();
  return (
    <View style={[{ flexDirection: "row", justifyContent: "center", alignItems: "center", flexWrap: "wrap" }, style]}>
      <Pressable testID="link-privacy" hitSlop={8} onPress={() => router.push("/legal/privacy")}>
        <AppText size="sm" muted weight="semibold">Privacy Policy</AppText>
      </Pressable>
      <AppText size="sm" muted style={{ marginHorizontal: 8 }}>·</AppText>
      <Pressable testID="link-terms" hitSlop={8} onPress={() => router.push("/legal/terms")}>
        <AppText size="sm" muted weight="semibold">Terms &amp; Conditions</AppText>
      </Pressable>
    </View>
  );
}

export function LegalContainer({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title={title} />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + spacing.xxl }} showsVerticalScrollIndicator={false}>
        <AppText size="xxl" weight="heavy" style={{ letterSpacing: -0.5 }}>{title}</AppText>
        <AppText muted size="sm" style={{ marginTop: 4, marginBottom: spacing.xl }}>Last updated: {updated}</AppText>
        {children}
        <Contact />
      </ScrollView>
    </View>
  );
}

export function Section({ n, title, children }: { n?: number; title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <AppText size="lg" weight="bold" style={{ marginBottom: spacing.sm, letterSpacing: -0.2 }}>{n ? `${n}. ` : ""}{title}</AppText>
      {children}
    </View>
  );
}

export function Para({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <AppText size="md" style={{ lineHeight: 22, color: colors.onSurface, opacity: 0.9, marginBottom: spacing.sm }}>{children}</AppText>;
}

export function Bullets({ items }: { items: React.ReactNode[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: 2, marginBottom: spacing.xs }}>
      {items.map((it, i) => (
        <View key={i} style={{ flexDirection: "row", marginBottom: 8, paddingRight: spacing.sm }}>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.brandPrimary, marginTop: 8, marginRight: 12 }} />
          <AppText size="md" style={{ flex: 1, lineHeight: 22, color: colors.onSurface, opacity: 0.9 }}>{it}</AppText>
        </View>
      ))}
    </View>
  );
}

export function Contact() {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.brandTertiary }}>
      <AppText size="lg" weight="bold" color={colors.onBrandTertiary}>Contact &amp; Support</AppText>
      <AppText size="md" style={{ marginTop: 6, marginBottom: spacing.md, lineHeight: 22, color: colors.onSurface, opacity: 0.9 }}>
        Questions, requests, or concerns about this document or your data? We&apos;re here to help.
      </AppText>
      <Pressable testID="legal-contact-email" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", marginRight: spacing.sm }}>
          <Icon name="mail-outline" size={18} color={colors.brandPrimary} />
        </View>
        <AppText weight="bold" color={colors.brandPrimary}>{SUPPORT_EMAIL}</AppText>
      </Pressable>
    </View>
  );
}
