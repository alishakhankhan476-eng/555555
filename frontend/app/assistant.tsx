import { useState, useEffect, useRef } from "react";
import {
  View, FlatList, Pressable, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, StyleSheet,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, spacing, radius, fontSize } from "@/src/theme";
import { AppText, Icon, useToast } from "@/src/ui";
import { StackHeader } from "@/src/Header";
import { api } from "@/src/api";

type Turn = { role: "user" | "assistant"; text: string; id: string };

const SUGGESTIONS = [
  "Summarize my important messages today",
  "Draft a polite follow-up to Rahul",
  "Create a study plan for React Native",
  "What are my pending tasks?",
];

export default function Assistant() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { prompt } = useLocalSearchParams<{ prompt?: string }>();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [convId, setConvId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const sendMsg = async (msg: string) => {
    if (!msg.trim() || sending) return;
    const userTurn: Turn = { role: "user", text: msg.trim(), id: "u" + Date.now() };
    setTurns((p) => [...p, userTurn]);
    setText(""); setSending(true);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      const res = await api.post<{ conversation_id: string; reply: string }>("/ai/chat", { message: msg.trim(), conversation_id: convId });
      setConvId(res.conversation_id);
      setTurns((p) => [...p, { role: "assistant", text: res.reply || "…", id: "a" + Date.now() }]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      toast.show(e.message || "Chatly failed", "error");
      setTurns((p) => [...p, { role: "assistant", text: "Sorry, I couldn't process that. Please try again.", id: "e" + Date.now() }]);
    } finally { setSending(false); }
  };

  useEffect(() => { if (prompt) sendMsg(String(prompt)); }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Chatly" subtitle="AI Assistant" right={<Icon name="sparkles" size={22} color={colors.brandPrimary} />} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={insets.top + 50}>
        {turns.length === 0 ? (
          <ScrollView contentContainerStyle={{ padding: spacing.xl, flexGrow: 1, justifyContent: "center" }}>
            <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
              <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
                <Icon name="sparkles" size={34} color={colors.brandPrimary} />
              </View>
              <AppText size="xl" weight="bold" style={{ marginTop: spacing.md }}>How can I help?</AppText>
              <AppText muted center style={{ marginTop: 4 }}>Ask anything in English, Hindi or Hinglish</AppText>
            </View>
            <View style={{ gap: spacing.sm }}>
              {SUGGESTIONS.map((s) => (
                <Pressable key={s} testID={`suggestion-${s.slice(0,6)}`} onPress={() => sendMsg(s)} style={{ padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, flexDirection: "row", alignItems: "center" }}>
                  <Icon name="arrow-forward-circle-outline" size={20} color={colors.brandPrimary} />
                  <AppText style={{ marginLeft: spacing.sm, flex: 1 }}>{s}</AppText>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        ) : (
          <FlatList
            ref={listRef}
            data={turns}
            keyExtractor={(t) => t.id}
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
            renderItem={({ item }) => (
              <View style={{ alignItems: item.role === "user" ? "flex-end" : "flex-start" }}>
                {item.role === "assistant" && (
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                    <Icon name="sparkles" size={14} color={colors.brandPrimary} />
                    <AppText size="xs" weight="bold" color={colors.brandPrimary} style={{ marginLeft: 4 }}>CHATLY</AppText>
                  </View>
                )}
                <View style={[styles.bubble, { backgroundColor: item.role === "user" ? colors.brandPrimary : colors.card, borderColor: colors.border, borderWidth: item.role === "user" ? 0 : 1 }]}>
                  <AppText size="md" color={item.role === "user" ? "#fff" : colors.onCard} style={{ lineHeight: 22 }}>{item.text}</AppText>
                </View>
              </View>
            )}
            ListFooterComponent={sending ? <View style={{ flexDirection: "row", alignItems: "center", padding: spacing.sm }}><ActivityIndicator size="small" color={colors.brandPrimary} /><AppText muted size="sm" style={{ marginLeft: 8 }}>Chatly is thinking…</AppText></View> : null}
          />
        )}

        <View style={{ flexDirection: "row", alignItems: "flex-end", padding: spacing.md, paddingBottom: insets.bottom + spacing.sm, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border }}>
          <View style={{ flex: 1, backgroundColor: colors.surfaceTertiary, borderRadius: radius.xl, paddingHorizontal: spacing.md, minHeight: 44, justifyContent: "center", maxHeight: 120 }}>
            <TextInput testID="assistant-input" value={text} onChangeText={setText} placeholder="Ask Chatly anything" placeholderTextColor={colors.onSurfaceMuted} multiline style={{ color: colors.onSurface, fontSize: fontSize.lg, paddingVertical: Platform.OS === "ios" ? 12 : 8 }} />
          </View>
          <Pressable testID="assistant-send" onPress={() => sendMsg(text)} disabled={!text.trim() || sending} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: text.trim() ? colors.brandPrimary : colors.surfaceTertiary, alignItems: "center", justifyContent: "center", marginLeft: 6 }}>
            <Icon name="arrow-up" size={22} color={text.trim() ? "#fff" : colors.onSurfaceMuted} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: "88%", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg },
});
