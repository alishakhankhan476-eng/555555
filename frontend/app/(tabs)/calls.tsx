import { useState, useCallback } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, spacing, radius } from "@/src/theme";
import { AppText, Avatar, Icon, EmptyState, useToast } from "@/src/ui";
import { api } from "@/src/api";

export default function Calls() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [contacts, setContacts] = useState<any[]>([]);

  const load = useCallback(async () => {
    try { const res = await api.get("/contacts"); setContacts(res.contacts.filter((c: any) => c.is_bot)); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const types = ["missed", "incoming", "outgoing"];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <AppText size="xxxl" weight="heavy">Calls</AppText>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {contacts.length === 0 ? (
          <EmptyState icon="call-outline" title="No calls yet" subtitle="Your voice and video calls will show up here." />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {contacts.map((c, i) => {
              const t = types[i % 3];
              return (
                <View key={c.user_id} style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Avatar name={c.name} uri={c.avatar} size={48} />
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <AppText weight="semibold">{c.name}</AppText>
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                      <Icon name={t === "missed" ? "arrow-down" : t === "incoming" ? "arrow-down-outline" : "arrow-up-outline"} size={14} color={t === "missed" ? colors.error : colors.onSurfaceMuted} />
                      <AppText muted size="base" style={{ marginLeft: 4 }}>{t === "missed" ? "Missed" : t === "incoming" ? "Incoming" : "Outgoing"} · yesterday</AppText>
                    </View>
                  </View>
                  <Icon name="videocam-outline" size={22} color={colors.brandPrimary} />
                  <View style={{ width: spacing.lg }} />
                  <Icon name="call-outline" size={22} color={colors.brandPrimary} />
                </View>
              );
            })}
          </View>
        )}
        <View style={[styles.note, { backgroundColor: colors.brandTertiary }]}>
          <Icon name="information-circle-outline" size={18} color={colors.brandPrimary} />
          <AppText size="base" color={colors.onBrandTertiary} style={{ flex: 1, marginLeft: 8 }}>
            Live voice & video calls activate on a device build. The AI Call Assistant will transcribe and summarize your calls.
          </AppText>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  note: { flexDirection: "row", alignItems: "flex-start", padding: spacing.md, borderRadius: radius.md, marginTop: spacing.xl },
});
