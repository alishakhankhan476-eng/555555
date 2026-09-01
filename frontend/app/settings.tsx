import { useState } from "react";
import { View, ScrollView, Switch } from "react-native";
import { useTheme, spacing } from "@/src/theme";
import { AppText, Card, SettingRow } from "@/src/ui";
import { StackHeader } from "@/src/Header";

export default function Settings() {
  const { colors, mode, setMode } = useTheme();
  const [notif, setNotif] = useState(true);
  const [aiNotif, setAiNotif] = useState(true);
  const [preview, setPreview] = useState(true);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Settings" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View>
          <AppText weight="bold" muted size="sm" style={{ marginBottom: spacing.sm }}>NOTIFICATIONS</AppText>
          <Card style={{ paddingVertical: spacing.xs }}>
            <SettingRow icon="notifications-outline" label="Message Notifications" right={<Switch testID="switch-notif" value={notif} onValueChange={setNotif} trackColor={{ true: colors.brandPrimary, false: colors.borderStrong }} thumbColor="#fff" />} />
            <View style={{ height: 1, backgroundColor: colors.divider, marginLeft: 46 }} />
            <SettingRow icon="sparkles-outline" label="AI Notification Summary" right={<Switch testID="switch-ai-notif" value={aiNotif} onValueChange={setAiNotif} trackColor={{ true: colors.brandPrimary, false: colors.borderStrong }} thumbColor="#fff" />} />
            <View style={{ height: 1, backgroundColor: colors.divider, marginLeft: 46 }} />
            <SettingRow icon="eye-outline" label="Message Preview" right={<Switch testID="switch-preview" value={preview} onValueChange={setPreview} trackColor={{ true: colors.brandPrimary, false: colors.borderStrong }} thumbColor="#fff" />} />
          </Card>
        </View>

        <View>
          <AppText weight="bold" muted size="sm" style={{ marginBottom: spacing.sm }}>APPEARANCE</AppText>
          <Card style={{ paddingVertical: spacing.xs }}>
            {(["light", "dark", "system"] as const).map((m, i) => (
              <View key={m}>
                <SettingRow testID={`settings-theme-${m}`} icon={m === "light" ? "sunny-outline" : m === "dark" ? "moon-outline" : "contrast-outline"} label={m.charAt(0).toUpperCase() + m.slice(1)} onPress={() => setMode(m)} right={mode === m ? <AppText color={colors.brandPrimary} weight="bold">✓</AppText> : null} />
                {i < 2 && <View style={{ height: 1, backgroundColor: colors.divider, marginLeft: 46 }} />}
              </View>
            ))}
          </Card>
        </View>

        <View>
          <AppText weight="bold" muted size="sm" style={{ marginBottom: spacing.sm }}>ABOUT</AppText>
          <Card style={{ paddingVertical: spacing.xs }}>
            <SettingRow icon="information-circle-outline" label="Version" value="1.0.0" right={null} />
            <View style={{ height: 1, backgroundColor: colors.divider, marginLeft: 46 }} />
            <SettingRow icon="hardware-chip-outline" label="AI Provider" value="Sarvam AI" right={null} />
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
