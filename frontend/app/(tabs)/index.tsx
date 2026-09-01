import { useEffect, useState, useCallback } from "react";
import { View, FlatList, Pressable, RefreshControl, TextInput, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, spacing, radius, fontSize } from "@/src/theme";
import { AppText, Avatar, Icon, EmptyState, Skeleton } from "@/src/ui";
import { api } from "@/src/api";
import { useWs } from "@/src/ws";
import dayjs from "dayjs";

type Chat = {
  chat_id: string;
  other: { user_id: string; name: string; avatar?: string; online?: boolean; is_bot?: boolean };
  last_message?: string;
  last_ts?: string;
  unread: number;
  pinned: boolean;
};

export default function Chats() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { subscribe } = useWs();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      setError(false);
      const res = await api.get<{ chats: Chat[] }>("/chats");
      setChats(res.chats);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => subscribe((ev) => { if (ev.type === "message") load(); }), [subscribe, load]);

  const filtered = chats.filter((c) => c.other?.name?.toLowerCase().includes(query.toLowerCase()));
  const sorted = [...filtered].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  const renderRow = ({ item }: { item: Chat }) => (
    <Pressable
      testID={`chat-row-${item.other?.user_id}`}
      onPress={() => router.push({ pathname: "/chat/[id]", params: { id: item.chat_id, name: item.other?.name } })}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceTertiary : "transparent" }]}
    >
      <Avatar name={item.other?.name} uri={item.other?.avatar} size={54} online={item.other?.online} />
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <AppText weight="semibold" size="lg" style={{ flex: 1 }} numberOfLines={1}>{item.other?.name}</AppText>
          <AppText size="sm" muted>{item.last_ts ? dayjs(item.last_ts).format("HH:mm") : ""}</AppText>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3 }}>
          <AppText muted size="base" style={{ flex: 1 }} numberOfLines={1}>{item.last_message || "Tap to start chatting"}</AppText>
          {item.pinned && <Icon name="pin" size={14} color={colors.onSurfaceMuted} />}
          {item.unread > 0 && (
            <View style={{ backgroundColor: colors.brandPrimary, borderRadius: 11, minWidth: 22, height: 22, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, marginLeft: 6 }}>
              <AppText size="xs" weight="bold" color="#fff">{item.unread}</AppText>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, backgroundColor: colors.surface }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md }}>
          <AppText size="xxxl" weight="heavy">Chats</AppText>
          <Pressable testID="new-chat-button" onPress={() => router.push("/new-chat")} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
            <Icon name="create-outline" size={22} color={colors.brandPrimary} />
          </Pressable>
        </View>
        <View style={[styles.search, { backgroundColor: colors.surfaceTertiary }]}>
          <Icon name="search" size={18} color={colors.onSurfaceMuted} />
          <TextInput
            testID="chat-search-input"
            value={query}
            onChangeText={setQuery}
            placeholder="Search chats"
            placeholderTextColor={colors.onSurfaceMuted}
            style={{ flex: 1, marginLeft: 8, color: colors.onSurface, fontSize: fontSize.lg, paddingVertical: 0 }}
          />
        </View>
      </View>

      {loading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {[...Array(6)].map((_, i) => <Skeleton key={i} height={64} />)}
        </View>
      ) : error ? (
        <EmptyState icon="cloud-offline-outline" title="Unable to load chats" subtitle="Check your connection and try again" action={<Pressable testID="retry-chats" onPress={load}><AppText weight="bold" color={colors.brandPrimary}>Retry</AppText></Pressable>} />
      ) : sorted.length === 0 ? (
        <EmptyState icon="chatbubbles-outline" title="No conversations yet" subtitle="Start a chat and let Chatly turn messages into tasks, summaries and more." />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(c) => c.chat_id}
          renderItem={renderRow}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.divider, marginLeft: 66 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, borderRadius: radius.md },
  search: { flexDirection: "row", alignItems: "center", height: 44, borderRadius: radius.pill, paddingHorizontal: spacing.md },
});
