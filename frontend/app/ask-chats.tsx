import { useState } from "react";
import { View, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, spacing, radius, fontSize } from "@/src/theme";
import { AppText, Icon, Card, EmptyState } from "@/src/ui";
import { StackHeader } from "@/src/Header";
import { api } from "@/src/api";
import dayjs from "dayjs";

const EXAMPLES = [
  "What did Rahul say about the deadline?",
  "Find the invoice amount Aman sent",
  "What did we decide about the project?",
];

export default function AskChats() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<any[]>([]);

  const ask = async (query: string) => {
    if (!query.trim()) return;
    setLoading(true); setAnswer(null); setSources([]);
    try {
      const res = await api.post<{ answer: string; sources: any[] }>("/ai/ask-chats", { query: query.trim() });
      setAnswer(res.answer); setSources(res.sources);
    } catch (e: any) { setAnswer(e.message); }
    finally { setLoading(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Ask Your Chats" subtitle="Search across your conversations" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={insets.top + 50}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
          {!answer && !loading && (
            <View style={{ marginBottom: spacing.lg }}>
              <AppText muted style={{ marginBottom: spacing.sm }}>Try asking</AppText>
              <View style={{ gap: spacing.sm }}>
                {EXAMPLES.map((e) => (
                  <Pressable key={e} testID={`example-${e.slice(0,6)}`} onPress={() => { setQ(e); ask(e); }} style={{ padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
                    <AppText>{e}</AppText>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {loading && (
            <View style={{ alignItems: "center", padding: spacing.xl }}>
              <Icon name="search" size={28} color={colors.brandPrimary} />
              <AppText muted style={{ marginTop: spacing.md }}>Searching your conversations…</AppText>
            </View>
          )}

          {answer && (
            <Card style={{ marginBottom: spacing.lg }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.sm }}>
                <Icon name="sparkles" size={16} color={colors.brandPrimary} />
                <AppText weight="bold" style={{ marginLeft: 6 }}>Chatly</AppText>
              </View>
              <AppText size="md" style={{ lineHeight: 22 }}>{answer}</AppText>
            </Card>
          )}

          {sources.length > 0 && (
            <>
              <AppText weight="bold" muted size="sm" style={{ marginBottom: spacing.sm }}>SOURCES</AppText>
              <View style={{ gap: spacing.sm }}>
                {sources.map((s, i) => (
                  <Pressable key={i} testID={`source-${i}`} onPress={() => router.push({ pathname: "/chat/[id]", params: { id: s.chat_id, name: s.chat_name } })}>
                    <Card style={{ padding: spacing.md }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                        <AppText size="sm" weight="bold" color={colors.brandPrimary}>{s.chat_name}</AppText>
                        <AppText size="xs" muted>{dayjs(s.ts).format("DD MMM, HH:mm")}</AppText>
                      </View>
                      <AppText size="base" numberOfLines={2}>{s.sender}: {s.text}</AppText>
                    </Card>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          {answer && sources.length === 0 && !loading && (
            <EmptyState icon="search-outline" title="No matching messages" subtitle="Try rephrasing your question." />
          )}
        </ScrollView>

        <View style={{ flexDirection: "row", alignItems: "center", padding: spacing.md, paddingBottom: insets.bottom + spacing.sm, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border }}>
          <View style={{ flex: 1, backgroundColor: colors.surfaceTertiary, borderRadius: radius.xl, paddingHorizontal: spacing.md, height: 44, justifyContent: "center" }}>
            <TextInput testID="ask-chats-input" value={q} onChangeText={setQ} placeholder="Ask about your chats" placeholderTextColor={colors.onSurfaceMuted} onSubmitEditing={() => ask(q)} returnKeyType="search" style={{ color: colors.onSurface, fontSize: fontSize.lg }} />
          </View>
          <Pressable testID="ask-chats-submit" onPress={() => ask(q)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginLeft: 6 }}>
            <Icon name="arrow-up" size={22} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
