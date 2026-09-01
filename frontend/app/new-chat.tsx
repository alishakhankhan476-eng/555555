import { useState, useEffect } from "react";
import { View, FlatList, Pressable, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useTheme, spacing, radius, fontSize } from "@/src/theme";
import { AppText, Avatar, Icon, Loading, EmptyState, useToast } from "@/src/ui";
import { StackHeader } from "@/src/Header";
import { api } from "@/src/api";

export default function NewChat() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    api.get("/contacts").then((r) => setContacts(r.contacts)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const start = async (c: any) => {
    try {
      const res = await api.post<{ chat_id: string }>("/chats", { contact_id: c.user_id });
      router.replace({ pathname: "/chat/[id]", params: { id: res.chat_id, name: c.name } });
    } catch { toast.show("Failed to open chat", "error"); }
  };

  const filtered = contacts.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="New Chat" />
      <View style={{ padding: spacing.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", height: 44, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, paddingHorizontal: spacing.md }}>
          <Icon name="search" size={18} color={colors.onSurfaceMuted} />
          <TextInput testID="contact-search" value={q} onChangeText={setQ} placeholder="Search contacts" placeholderTextColor={colors.onSurfaceMuted} style={{ flex: 1, marginLeft: 8, color: colors.onSurface, fontSize: fontSize.lg }} />
        </View>
      </View>
      {loading ? <Loading /> : filtered.length === 0 ? (
        <EmptyState icon="people-outline" title="No contacts found" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.user_id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg }}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.divider, marginLeft: 62 }} />}
          renderItem={({ item }) => (
            <Pressable testID={`contact-${item.user_id}`} onPress={() => start(item)} style={{ flexDirection: "row", alignItems: "center", paddingVertical: spacing.md }}>
              <Avatar name={item.name} uri={item.avatar} size={48} online={item.online} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <AppText weight="semibold" size="lg">{item.name}</AppText>
                <AppText muted size="base" numberOfLines={1}>{item.bio || "@" + item.username}</AppText>
              </View>
              <Icon name="chatbubble-outline" size={20} color={colors.brandPrimary} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
