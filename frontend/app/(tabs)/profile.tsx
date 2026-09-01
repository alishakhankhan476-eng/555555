import { useState } from "react";
import { View, ScrollView, Pressable, Modal, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, spacing, radius } from "@/src/theme";
import { AppText, Avatar, Icon, Card, SettingRow, Input, Button, useToast } from "@/src/ui";
import { useAuth } from "@/src/auth";
import { api } from "@/src/api";

export default function Profile() {
  const { colors, mode, setMode } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { user, logout, setUser } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await api.put<{ user: any }>("/auth/me", { name, bio });
      setUser(res.user);
      toast.show("Profile updated", "success");
      setEditOpen(false);
    } catch { toast.show("Failed to update", "error"); }
    finally { setSaving(false); }
  };

  const doDelete = async () => {
    try { await api.del("/auth/me"); await logout(); router.replace("/(auth)/login"); }
    catch { toast.show("Failed", "error"); }
  };

  const modes: any[] = [["light", "sunny-outline"], ["dark", "moon-outline"], ["system", "contrast-outline"]];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <View style={{ alignItems: "center", paddingTop: insets.top + spacing.lg, paddingBottom: spacing.lg }}>
          <Avatar name={user?.name} uri={user?.avatar} size={96} />
          <AppText size="xxl" weight="heavy" style={{ marginTop: spacing.md }}>{user?.name}</AppText>
          <AppText muted>@{user?.username}</AppText>
          {user?.bio ? <AppText center style={{ marginTop: 6, maxWidth: 280 }}>{user.bio}</AppText> : null}
          <Pressable testID="edit-profile-button" onPress={() => setEditOpen(true)} style={{ marginTop: spacing.md, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, height: 40, borderRadius: radius.pill, backgroundColor: colors.brandTertiary }}>
            <Icon name="create-outline" size={16} color={colors.brandPrimary} />
            <AppText weight="semibold" color={colors.brandPrimary} style={{ marginLeft: 6 }}>Edit Profile</AppText>
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
          <Card style={{ paddingVertical: spacing.xs }}>
            <SettingRow testID="row-ai-memory" icon="bookmark-outline" label="AI Memory" onPress={() => router.push("/memory")} />
            <SettingRow testID="row-creations" icon="color-wand-outline" label="AI Creations" onPress={() => router.push("/creations")} />
            <SettingRow testID="row-research" icon="globe-outline" label="Research History" onPress={() => router.push("/research")} />
            <SettingRow testID="row-reminders" icon="alarm-outline" label="Reminders" onPress={() => router.push("/reminders")} />
          </Card>

          <View>
            <AppText weight="bold" muted size="sm" style={{ marginBottom: spacing.sm }}>APPEARANCE</AppText>
            <Card style={{ flexDirection: "row", gap: spacing.sm, padding: spacing.sm }}>
              {modes.map(([m, ic]) => (
                <Pressable key={m} testID={`theme-${m}`} onPress={() => setMode(m)} style={{ flex: 1, alignItems: "center", paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: mode === m ? colors.brandPrimary : colors.surfaceTertiary }}>
                  <Icon name={ic} size={20} color={mode === m ? "#fff" : colors.onSurface} />
                  <AppText size="sm" weight="semibold" color={mode === m ? "#fff" : colors.onSurface} style={{ marginTop: 4, textTransform: "capitalize" }}>{m}</AppText>
                </Pressable>
              ))}
            </Card>
          </View>

          <Card style={{ paddingVertical: spacing.xs }}>
            <SettingRow testID="row-privacy" icon="shield-checkmark-outline" label="Privacy & Security" onPress={() => router.push("/privacy")} />
            <SettingRow testID="row-settings" icon="settings-outline" label="Settings" onPress={() => router.push("/settings")} />
          </Card>

          <Card style={{ paddingVertical: spacing.xs }}>
            <SettingRow testID="logout-button" icon="log-out-outline" label="Log Out" color={colors.error} onPress={async () => { await logout(); router.replace("/(auth)/login"); }} right={null} />
            <SettingRow testID="delete-account-button" icon="trash-outline" label="Delete Account" color={colors.error} onPress={() => setConfirmDelete(true)} right={null} />
          </Card>
        </View>
      </ScrollView>

      {/* Edit modal */}
      <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={() => setEditOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + spacing.lg }]}>
          <AppText weight="bold" size="lg" style={{ marginBottom: spacing.md }}>Edit Profile</AppText>
          <Input testID="edit-name" label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
          <Input testID="edit-bio" label="Bio" value={bio} onChangeText={setBio} placeholder="A short bio" multiline />
          <Button testID="save-profile" title="Save" onPress={saveProfile} loading={saving} />
        </View>
      </Modal>

      {/* Delete confirm */}
      <Modal visible={confirmDelete} transparent animationType="fade" onRequestClose={() => setConfirmDelete(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
          <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.xl, width: "100%" }}>
            <AppText weight="bold" size="lg" center>Delete account?</AppText>
            <AppText muted center style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>This will deactivate your account and data. This cannot be undone.</AppText>
            <Button testID="confirm-delete" title="Delete Account" variant="danger" onPress={doDelete} />
            <Pressable onPress={() => setConfirmDelete(false)} style={{ marginTop: spacing.md, alignItems: "center" }}><AppText weight="semibold">Cancel</AppText></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg },
});
