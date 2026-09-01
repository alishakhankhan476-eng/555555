import { useState, useCallback } from "react";
import { View, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme, spacing, radius } from "@/src/theme";
import { AppText, Avatar, Icon, EmptyState } from "@/src/ui";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

export default function Status() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [contacts, setContacts] = useState<any[]>([]);

  const load = useCallback(async () => {
    try { const res = await api.get("/contacts"); setContacts(res.contacts.slice(0, 6)); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <AppText size="xxxl" weight="heavy">Status</AppText>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {/* My status */}
        <Pressable testID="add-status" onPress={() => router.push("/assistant?prompt=Write a short status update for me")} style={[styles.myRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <View>
            <Avatar name={user?.name} uri={user?.avatar} size={54} />
            <View style={{ position: "absolute", right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.card }}>
              <Icon name="add" size={14} color="#fff" />
            </View>
          </View>
          <View style={{ marginLeft: spacing.md, flex: 1 }}>
            <AppText weight="semibold" size="lg">My Status</AppText>
            <AppText muted size="base">Tap to create with Chatly AI</AppText>
          </View>
          <Icon name="sparkles" size={20} color={colors.brandPrimary} />
        </Pressable>

        <AppText weight="bold" muted size="sm" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>RECENT UPDATES</AppText>
        {contacts.length === 0 ? (
          <EmptyState icon="radio-outline" title="No recent updates" subtitle="Status updates from your contacts will appear here." />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {contacts.map((c) => (
              <View key={c.user_id} style={[styles.statusRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <LinearGradient colors={[colors.brandPrimary, colors.brandSecondary]} style={{ padding: 2, borderRadius: 30 }}>
                  <View style={{ borderRadius: 28, borderWidth: 2, borderColor: colors.card }}>
                    <Avatar name={c.name} uri={c.avatar} size={48} />
                  </View>
                </LinearGradient>
                <View style={{ marginLeft: spacing.md }}>
                  <AppText weight="semibold">{c.name}</AppText>
                  <AppText muted size="base">Tap to view update</AppText>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  myRow: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  statusRow: { flexDirection: "row", alignItems: "center", padding: spacing.sm, borderRadius: radius.lg, borderWidth: 1 },
});
