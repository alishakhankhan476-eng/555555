import { useState, useEffect } from "react";
import { View, ScrollView, Switch } from "react-native";
import { useTheme, spacing, radius } from "@/src/theme";
import { AppText, Icon, Card, Loading, SettingRow, useToast } from "@/src/ui";
import { StackHeader } from "@/src/Header";
import { api } from "@/src/api";

const PERMS: { key: string; label: string; icon: string }[] = [
  { key: "messages", label: "Read Chats", icon: "chatbubbles-outline" },
  { key: "attachments", label: "Attachments", icon: "attach-outline" },
  { key: "images", label: "Image Analysis", icon: "image-outline" },
  { key: "documents", label: "Document Analysis", icon: "document-outline" },
  { key: "voice_messages", label: "Voice Messages", icon: "mic-outline" },
  { key: "group_intelligence", label: "Group Intelligence", icon: "people-outline" },
  { key: "memory", label: "Memory", icon: "bookmark-outline" },
  { key: "contacts", label: "Contacts", icon: "person-outline" },
  { key: "calendar", label: "Calendar", icon: "calendar-outline" },
  { key: "web_search", label: "Web Search", icon: "globe-outline" },
  { key: "location", label: "Location", icon: "location-outline" },
  { key: "calls", label: "Calls", icon: "call-outline" },
];

export default function Privacy() {
  const { colors } = useTheme();
  const toast = useToast();
  const [privacy, setPrivacy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lock, setLock] = useState(false);
  const [disappearing, setDisappearing] = useState(false);

  useEffect(() => {
    api.get("/ai/privacy").then((r) => setPrivacy(r.privacy)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggle = async (key: string) => {
    const next = { ...privacy, [key]: !privacy[key] };
    setPrivacy(next);
    try { await api.put("/ai/privacy", { [key]: next[key] }); } catch { toast.show("Failed to update", "error"); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Privacy & Security" />
      {loading || !privacy ? <Loading /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
          <View style={[{ padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.brandTertiary, flexDirection: "row", alignItems: "flex-start" }]}>
            <Icon name="shield-checkmark" size={18} color={colors.brandPrimary} />
            <AppText size="base" color={colors.onBrandTertiary} style={{ flex: 1, marginLeft: 8 }}>Chatly only accesses what you allow below. You can turn any of these off at any time.</AppText>
          </View>

          <View>
            <AppText weight="bold" muted size="sm" style={{ marginBottom: spacing.sm }}>WHAT CAN CHATLY ACCESS?</AppText>
            <Card style={{ paddingVertical: spacing.xs }}>
              {PERMS.map((p, i) => (
                <View key={p.key}>
                  <SettingRow icon={p.icon} label={p.label} testID={`perm-${p.key}`} right={
                    <Switch testID={`switch-${p.key}`} value={!!privacy[p.key]} onValueChange={() => toggle(p.key)} trackColor={{ true: colors.brandPrimary, false: colors.borderStrong }} thumbColor="#fff" />
                  } />
                  {i < PERMS.length - 1 && <View style={{ height: 1, backgroundColor: colors.divider, marginLeft: 46 }} />}
                </View>
              ))}
            </Card>
          </View>

          <View>
            <AppText weight="bold" muted size="sm" style={{ marginBottom: spacing.sm }}>SECURITY</AppText>
            <Card style={{ paddingVertical: spacing.xs }}>
              <SettingRow icon="lock-closed-outline" label="App Lock (PIN / Biometric)" right={<Switch testID="switch-lock" value={lock} onValueChange={setLock} trackColor={{ true: colors.brandPrimary, false: colors.borderStrong }} thumbColor="#fff" />} />
              <View style={{ height: 1, backgroundColor: colors.divider, marginLeft: 46 }} />
              <SettingRow icon="timer-outline" label="Disappearing Messages" right={<Switch testID="switch-disappearing" value={disappearing} onValueChange={setDisappearing} trackColor={{ true: colors.brandPrimary, false: colors.borderStrong }} thumbColor="#fff" />} />
            </Card>
            <AppText size="sm" muted style={{ marginTop: spacing.sm }}>App lock and biometric protection activate on a device build.</AppText>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
