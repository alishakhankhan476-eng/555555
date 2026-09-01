import { useState, useEffect } from "react";
import { View, ScrollView, Pressable, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useTheme, spacing, radius, fontSize } from "@/src/theme";
import { AppText, Avatar, Icon, Button, Input, useToast, Loading } from "@/src/ui";
import { StackHeader } from "@/src/Header";
import { api } from "@/src/api";

export default function NewGroup() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get("/contacts").then((r) => setContacts(r.contacts)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggle = (u: any) => setSelected((p) => { const n = { ...p }; if (n[u.user_id]) delete n[u.user_id]; else n[u.user_id] = u; return n; });

  const create = async () => {
    if (!name.trim()) { toast.show("Enter a group name", "error"); return; }
    const ids = Object.keys(selected);
    if (ids.length === 0) { toast.show("Add at least one member", "error"); return; }
    setCreating(true);
    try {
      const res = await api.post<{ chat_id: string }>("/groups", { name: name.trim(), member_ids: ids });
      router.replace({ pathname: "/chat/[id]", params: { id: res.chat_id, name: name.trim(), group: "1" } });
    } catch (e: any) { toast.show(e.message, "error"); }
    finally { setCreating(false); }
  };

  const chosen = Object.values(selected);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="New Group" />
      <View style={{ padding: spacing.lg }}>
        <Input testID="group-name-input" label="Group name" value={name} onChangeText={setName} placeholder="e.g. Project Team" autoCapitalize="words" />
        {chosen.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.sm }}>
            {chosen.map((u: any) => (
              <View key={u.user_id} style={{ alignItems: "center", width: 60 }}>
                <Avatar name={u.name} uri={u.avatar} size={48} />
                <AppText size="xs" numberOfLines={1} style={{ marginTop: 4 }}>{u.name.split(" ")[0]}</AppText>
              </View>
            ))}
          </ScrollView>
        )}
        <AppText weight="bold" muted size="sm" style={{ marginTop: spacing.sm }}>ADD MEMBERS</AppText>
      </View>
      {loading ? <Loading /> : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 120 }}>
          {contacts.map((u) => {
            const on = !!selected[u.user_id];
            return (
              <Pressable key={u.user_id} testID={`select-${u.user_id}`} onPress={() => toggle(u)} style={{ flexDirection: "row", alignItems: "center", paddingVertical: spacing.md }}>
                <Avatar name={u.name} uri={u.avatar} size={46} online={u.online} />
                <AppText weight="semibold" size="lg" style={{ flex: 1, marginLeft: spacing.md }}>{u.name}</AppText>
                <Icon name={on ? "checkmark-circle" : "ellipse-outline"} size={26} color={on ? colors.brandPrimary : colors.borderStrong} />
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: spacing.lg, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border }}>
        <Button testID="create-group-button" title={`Create Group${chosen.length ? ` (${chosen.length})` : ""}`} onPress={create} loading={creating} />
      </View>
    </View>
  );
}
