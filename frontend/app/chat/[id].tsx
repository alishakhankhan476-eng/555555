import { useEffect, useState, useCallback, useRef } from "react";
import {
  View, FlatList, Pressable, TextInput, StyleSheet, KeyboardAvoidingView,
  Platform, Modal, ScrollView, ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useTheme, spacing, radius, fontSize } from "@/src/theme";
import { AppText, Avatar, Icon, Loading, useToast } from "@/src/ui";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useWs } from "@/src/ws";
import dayjs from "dayjs";

type Msg = {
  message_id: string; chat_id: string; sender_id: string; text: string;
  status: string; reactions: Record<string, string>; starred_by: string[];
  edited: boolean; deleted: boolean; created_at: string; reply_to?: string | null;
};

const REACTIONS = ["👍", "❤️", "😂", "😮", "🙏", "🔥"];

const MSG_ACTIONS = [
  { key: "explain", label: "Explain", icon: "bulb-outline" },
  { key: "summarize", label: "Summarize", icon: "document-text-outline" },
  { key: "translate", label: "Translate", icon: "language-outline" },
  { key: "rewrite", label: "Draft a Reply", icon: "return-up-forward-outline" },
];

const BRAIN_ACTIONS = [
  { key: "summary", label: "Summarize", icon: "document-text-outline" },
  { key: "important", label: "Important", icon: "flag-outline" },
  { key: "timeline", label: "Timeline", icon: "git-commit-outline" },
  { key: "pending", label: "Pending Replies", icon: "arrow-undo-outline" },
  { key: "decisions", label: "Decisions", icon: "checkmark-done-outline" },
];

export default function ChatScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const { user } = useAuth();
  const { subscribe, send } = useWs();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [otherTyping, setOtherTyping] = useState(false);
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);

  const [selected, setSelected] = useState<Msg | null>(null);
  const [brainOpen, setBrainOpen] = useState(false);
  const [aiResult, setAiResult] = useState<{ title: string; body: string; canReply?: boolean } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const typingTimer = useRef<any>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ messages: Msg[] }>(`/chats/${id}/messages`);
      setMessages(res.messages);
    } catch { toast.show("Failed to load messages", "error"); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => subscribe((ev) => {
    if (ev.chat_id !== id) return;
    if (ev.type === "message") {
      setMessages((prev) => prev.some((m) => m.message_id === ev.message.message_id) ? prev : [...prev, ev.message]);
      setSmartReplies([]);
    } else if (ev.type === "typing") {
      setOtherTyping(ev.typing);
    } else if (ev.type === "reaction") {
      setMessages((prev) => prev.map((m) => m.message_id === ev.message_id ? { ...m, reactions: ev.reactions } : m));
    } else if (ev.type === "deleted") {
      setMessages((prev) => prev.map((m) => m.message_id === ev.message_id ? { ...m, deleted: true, text: "This message was deleted" } : m));
    }
  }), [subscribe, id]);

  const onSend = async () => {
    const body = text.trim();
    if (!body) return;
    setText(""); setSmartReplies([]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const optimistic: Msg = {
      message_id: "tmp_" + Date.now(), chat_id: String(id), sender_id: user!.user_id, text: body,
      status: "sending", reactions: {}, starred_by: [], edited: false, deleted: false, created_at: new Date().toISOString(),
    };
    setMessages((p) => [...p, optimistic]);
    try {
      const res = await api.post<{ message: Msg }>(`/chats/${id}/messages`, { text: body });
      setMessages((p) => p.map((m) => m.message_id === optimistic.message_id ? res.message : m));
    } catch {
      setMessages((p) => p.map((m) => m.message_id === optimistic.message_id ? { ...m, status: "failed" } : m));
      toast.show("Failed to send", "error");
    }
  };

  const onChangeText = (v: string) => {
    setText(v);
    send({ type: "ping" });
    api.post(`/chats/${id}/typing`, { typing: true }).catch(() => {});
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => api.post(`/chats/${id}/typing`, { typing: false }).catch(() => {}), 1500);
  };

  const fetchSmartReplies = async () => {
    setLoadingReplies(true);
    try {
      const res = await api.post<{ replies: string[] }>("/ai/smart-reply", { chat_id: id });
      setSmartReplies(res.replies);
      if (!res.replies.length) toast.show("No suggestions right now", "info");
    } catch { toast.show("Smart reply failed", "error"); }
    finally { setLoadingReplies(false); }
  };

  const runMsgAction = async (action: string) => {
    if (!selected) return;
    setAiLoading(true); setAiResult({ title: "Chatly", body: "" });
    try {
      const res = await api.post<{ result: string }>("/ai/message-action", {
        text: selected.text, action, target_lang: action === "translate" ? "English" : undefined,
      });
      const titles: any = { explain: "Explanation", summarize: "Summary", translate: "Translation", rewrite: "Suggested Reply" };
      setAiResult({ title: titles[action] || "Chatly", body: res.result, canReply: action === "rewrite" });
    } catch (e: any) { setAiResult({ title: "Error", body: e.message }); }
    finally { setAiLoading(false); }
  };

  const runBrain = async (kind: string) => {
    setAiLoading(true); setAiResult({ title: "Chatly", body: "" });
    try {
      const res = await api.post<{ result: string }>("/ai/chat-brain", { chat_id: id, kind });
      const t: any = { summary: "Summary", important: "Important Messages", timeline: "Timeline", pending: "Pending Replies", decisions: "Decisions" };
      setAiResult({ title: t[kind] || "Chatly", body: res.result });
    } catch (e: any) { setAiResult({ title: "Error", body: e.message }); }
    finally { setAiLoading(false); }
  };

  const createTaskFromMsg = async () => {
    if (!selected) return;
    try {
      await api.post("/tasks", { title: selected.text.slice(0, 120), source_chat_id: id, source_message_id: selected.message_id, priority: "high" });
      toast.show("Task created", "success");
      setSelected(null);
    } catch { toast.show("Failed to create task", "error"); }
  };

  const remindFromMsg = async () => {
    if (!selected) return;
    try {
      await api.post("/reminders", { title: selected.text.slice(0, 120), source_message_id: selected.message_id });
      toast.show("Reminder set", "success");
      setSelected(null);
    } catch { toast.show("Failed", "error"); }
  };

  const markImportant = async () => {
    if (!selected) return;
    try {
      const res = await api.post<{ important: boolean }>("/important", { message_id: selected.message_id, chat_id: id, text: selected.text, sender_name: name, level: "important" });
      toast.show(res.important ? "Marked important" : "Removed importance", "success");
      setSelected(null);
    } catch { toast.show("Failed", "error"); }
  };

  const star = async () => {
    if (!selected) return;
    try { await api.post(`/messages/${selected.message_id}/star`); toast.show("Updated", "success"); setSelected(null); }
    catch { toast.show("Failed", "error"); }
  };

  const react = async (emoji: string) => {
    if (!selected) return;
    try { await api.post(`/messages/${selected.message_id}/react`, { emoji }); setSelected(null); }
    catch { toast.show("Failed", "error"); }
  };

  const deleteMsg = async () => {
    if (!selected) return;
    try { await api.del(`/messages/${selected.message_id}`); setSelected(null); }
    catch (e: any) { toast.show(e.message, "error"); }
  };

  const renderMsg = ({ item }: { item: Msg }) => {
    const mine = item.sender_id === user?.user_id;
    const reactionList = Object.values(item.reactions || {});
    return (
      <Pressable
        onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); setSelected(item); }}
        style={{ alignItems: mine ? "flex-end" : "flex-start", marginVertical: 3, paddingHorizontal: spacing.md }}
      >
        <View style={[styles.bubble, {
          backgroundColor: mine ? colors.bubbleOut : colors.bubbleIn,
          borderColor: colors.border, borderWidth: mine ? 0 : 1,
          borderBottomRightRadius: mine ? 4 : radius.lg, borderBottomLeftRadius: mine ? radius.lg : 4,
        }]}>
          <AppText size="md" color={mine ? colors.onBubbleOut : colors.onCard} style={{ fontStyle: item.deleted ? "italic" : "normal", opacity: item.deleted ? 0.7 : 1 }}>
            {item.text}
          </AppText>
          <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-end", marginTop: 3 }}>
            {item.edited && !item.deleted && <AppText size="xs" color={mine ? "rgba(255,255,255,0.7)" : colors.onSurfaceMuted}>edited · </AppText>}
            <AppText size="xs" color={mine ? "rgba(255,255,255,0.7)" : colors.onSurfaceMuted}>{dayjs(item.created_at).format("HH:mm")}</AppText>
            {mine && <Icon name={item.status === "sending" ? "time-outline" : item.status === "read" ? "checkmark-done" : item.status === "failed" ? "alert-circle" : "checkmark"} size={13} color={item.status === "read" ? "#fff" : "rgba(255,255,255,0.7)"} />}
          </View>
        </View>
        {reactionList.length > 0 && (
          <View style={[styles.reactionBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <AppText size="sm">{reactionList.join(" ")}</AppText>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + 6, paddingBottom: spacing.sm, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable testID="chat-back" onPress={() => router.back()} hitSlop={10} style={{ marginRight: 6 }}>
          <Icon name="chevron-back" size={28} />
        </Pressable>
        <Avatar name={String(name)} size={40} online />
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <AppText weight="bold" size="lg" numberOfLines={1}>{name}</AppText>
          <AppText size="sm" color={otherTyping ? colors.brandPrimary : colors.onSurfaceMuted}>{otherTyping ? "typing…" : "online"}</AppText>
        </View>
        <Pressable testID="chat-brain-button" onPress={() => { setBrainOpen(true); setAiResult(null); }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
          <Icon name="sparkles" size={20} color={colors.brandPrimary} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={insets.top + 50}>
        {loading ? <Loading /> : (
          <FlatList
            data={messages}
            keyExtractor={(m) => m.message_id}
            renderItem={renderMsg}
            contentContainerStyle={{ paddingVertical: spacing.md }}
            ListEmptyComponent={<View style={{ padding: spacing.xxl, alignItems: "center" }}><AppText muted center>Say hello and start the conversation</AppText></View>}
          />
        )}

        {/* Smart replies */}
        {smartReplies.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm, paddingBottom: spacing.sm }}>
            {smartReplies.map((r, i) => (
              <Pressable key={i} testID={`smart-reply-${i}`} onPress={() => { setText(r); setSmartReplies([]); }} style={[styles.srChip, { backgroundColor: colors.brandTertiary, borderColor: colors.brandPrimary }]}>
                <AppText size="base" color={colors.onBrandTertiary} numberOfLines={1} style={{ maxWidth: 240 }}>{r}</AppText>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Composer */}
        <View style={{ flexDirection: "row", alignItems: "flex-end", paddingHorizontal: spacing.md, paddingBottom: insets.bottom + spacing.sm, paddingTop: spacing.sm, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Pressable testID="smart-reply-button" onPress={fetchSmartReplies} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", marginRight: 6 }}>
            {loadingReplies ? <ActivityIndicator size="small" color={colors.brandPrimary} /> : <Icon name="sparkles" size={20} color={colors.brandPrimary} />}
          </Pressable>
          <View style={{ flex: 1, backgroundColor: colors.surfaceTertiary, borderRadius: radius.xl, paddingHorizontal: spacing.md, minHeight: 42, justifyContent: "center", maxHeight: 120 }}>
            <TextInput
              testID="message-input"
              value={text}
              onChangeText={onChangeText}
              placeholder="Message"
              placeholderTextColor={colors.onSurfaceMuted}
              multiline
              style={{ color: colors.onSurface, fontSize: fontSize.lg, paddingVertical: Platform.OS === "ios" ? 10 : 6 }}
            />
          </View>
          <Pressable testID="send-button" onPress={onSend} disabled={!text.trim()} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: text.trim() ? colors.brandPrimary : colors.surfaceTertiary, alignItems: "center", justifyContent: "center", marginLeft: 6 }}>
            <Icon name="arrow-up" size={22} color={text.trim() ? "#fff" : colors.onSurfaceMuted} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Message action sheet */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={() => { setSelected(null); setAiResult(null); }} />
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + spacing.lg }]}>
          {aiResult ? (
            <ScrollView style={{ maxHeight: 420 }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
                <Icon name="sparkles" size={18} color={colors.brandPrimary} />
                <AppText weight="bold" size="lg" style={{ marginLeft: 8, flex: 1 }}>{aiResult.title}</AppText>
                <Pressable onPress={() => setAiResult(null)}><Icon name="close" size={22} /></Pressable>
              </View>
              {aiLoading ? <ActivityIndicator color={colors.brandPrimary} style={{ marginVertical: spacing.xl }} /> : (
                <AppText size="md" style={{ lineHeight: 22 }}>{aiResult.body}</AppText>
              )}
              {aiResult.canReply && !aiLoading && (
                <Pressable testID="use-as-reply" onPress={() => { setText(aiResult.body); setSelected(null); setAiResult(null); }} style={{ marginTop: spacing.lg, backgroundColor: colors.brandPrimary, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" }}>
                  <AppText weight="bold" color="#fff">Use as reply</AppText>
                </Pressable>
              )}
            </ScrollView>
          ) : (
            <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: "row", justifyContent: "space-around", marginBottom: spacing.md }}>
                {REACTIONS.map((e) => (
                  <Pressable key={e} testID={`react-${e}`} onPress={() => react(e)} style={{ padding: 6 }}><AppText size="xxl">{e}</AppText></Pressable>
                ))}
              </View>
              <View style={{ height: 1, backgroundColor: colors.divider, marginBottom: spacing.sm }} />
              <AppText weight="bold" size="sm" muted style={{ marginVertical: spacing.sm }}>ASK CHATLY</AppText>
              {MSG_ACTIONS.map((a) => (
                <Pressable key={a.key} testID={`msg-action-${a.key}`} onPress={() => runMsgAction(a.key)} style={styles.actionRow}>
                  <Icon name={a.icon as any} size={20} color={colors.brandPrimary} />
                  <AppText style={{ marginLeft: spacing.md }} weight="medium">{a.label}</AppText>
                </Pressable>
              ))}
              <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: spacing.sm }} />
              <Pressable testID="action-create-task" onPress={createTaskFromMsg} style={styles.actionRow}>
                <Icon name="checkbox-outline" size={20} /><AppText style={{ marginLeft: spacing.md }} weight="medium">Create Task</AppText>
              </Pressable>
              <Pressable testID="action-remind" onPress={remindFromMsg} style={styles.actionRow}>
                <Icon name="alarm-outline" size={20} /><AppText style={{ marginLeft: spacing.md }} weight="medium">Set Reminder</AppText>
              </Pressable>
              <Pressable testID="action-important" onPress={markImportant} style={styles.actionRow}>
                <Icon name="flag-outline" size={20} /><AppText style={{ marginLeft: spacing.md }} weight="medium">Mark Important</AppText>
              </Pressable>
              <Pressable testID="action-star" onPress={star} style={styles.actionRow}>
                <Icon name="star-outline" size={20} /><AppText style={{ marginLeft: spacing.md }} weight="medium">Star</AppText>
              </Pressable>
              {selected?.sender_id === user?.user_id && (
                <Pressable testID="action-delete" onPress={deleteMsg} style={styles.actionRow}>
                  <Icon name="trash-outline" size={20} color={colors.error} /><AppText style={{ marginLeft: spacing.md }} weight="medium" color={colors.error}>Delete</AppText>
                </Pressable>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Chat brain sheet */}
      <Modal visible={brainOpen} transparent animationType="slide" onRequestClose={() => setBrainOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={() => setBrainOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
            <Icon name="sparkles" size={20} color={colors.brandPrimary} />
            <AppText weight="bold" size="lg" style={{ marginLeft: 8, flex: 1 }}>Ask Chatly about this chat</AppText>
            <Pressable onPress={() => setBrainOpen(false)}><Icon name="close" size={22} /></Pressable>
          </View>
          {aiResult ? (
            <ScrollView style={{ maxHeight: 420 }}>
              <AppText weight="bold" size="md" color={colors.brandPrimary} style={{ marginBottom: spacing.sm }}>{aiResult.title}</AppText>
              {aiLoading ? <ActivityIndicator color={colors.brandPrimary} style={{ marginVertical: spacing.xl }} /> : <AppText size="md" style={{ lineHeight: 22 }}>{aiResult.body}</AppText>}
              <Pressable onPress={() => setAiResult(null)} style={{ marginTop: spacing.lg }}><AppText weight="bold" color={colors.brandPrimary}>← Back to actions</AppText></Pressable>
            </ScrollView>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {BRAIN_ACTIONS.map((a) => (
                <Pressable key={a.key} testID={`brain-${a.key}`} onPress={() => runBrain(a.key)} style={{ width: "50%", padding: spacing.xs }}>
                  <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, flexDirection: "row", alignItems: "center" }}>
                    <Icon name={a.icon as any} size={20} color={colors.brandPrimary} />
                    <AppText weight="semibold" style={{ marginLeft: 8 }} numberOfLines={1}>{a.label}</AppText>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: "80%", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg },
  reactionBadge: { marginTop: -6, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, borderWidth: 1 },
  srChip: { paddingHorizontal: spacing.md, height: 40, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  sheet: { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg },
  actionRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md },
});
