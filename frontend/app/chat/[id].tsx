import { useEffect, useState, useCallback, useRef } from "react";
import {
  View, FlatList, Pressable, TextInput, StyleSheet,
  Platform, Modal, ScrollView, ActivityIndicator, Linking,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useAudioRecorder, useAudioRecorderState, RecordingPresets, AudioModule, setAudioModeAsync } from "expo-audio";
import { useTheme, spacing, radius, fontSize } from "@/src/theme";
import { AppText, Avatar, Icon, Loading, useToast } from "@/src/ui";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useWs } from "@/src/ws";
import { useCall } from "@/src/calls";
import { fileUrl, pickImageFromLibrary, captureImage, pickDocument, uploadImage, uploadDocument, uploadVoice } from "@/src/upload";
import { CHAT_THEME_PRESETS, ACCENTS, resolveChatTheme, type ChatTheme } from "@/src/chatThemes";
import dayjs from "dayjs";

type Msg = {
  message_id: string; chat_id: string; sender_id: string; text: string;
  status: string; reactions: Record<string, string>; starred_by: string[];
  edited: boolean; deleted: boolean; created_at: string; reply_to?: string | null;
  type?: string; attachment?: any;
};

const REACTIONS = ["👍", "❤️", "😂", "😮", "🙏", "🔥"];

const MSG_ACTIONS = [
  { key: "explain", label: "Explain", icon: "bulb-outline" },
  { key: "summarize", label: "Summarize", icon: "document-text-outline" },
  { key: "translate", label: "Translate", icon: "language-outline" },
  { key: "rewrite", label: "Draft a Reply", icon: "return-up-forward-outline" },
];

const ATT_ACTIONS = [
  { key: "summarize", label: "Summarize", icon: "document-text-outline" },
  { key: "explain", label: "Explain", icon: "bulb-outline" },
  { key: "find_amount", label: "Find Amounts", icon: "cash-outline" },
  { key: "find_dates", label: "Find Dates", icon: "calendar-outline" },
  { key: "extract", label: "Extract Info", icon: "list-outline" },
  { key: "translate", label: "Translate", icon: "language-outline" },
  { key: "create_task", label: "Create Task", icon: "checkbox-outline" },
  { key: "create_notes", label: "Create Notes", icon: "reader-outline" },
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
  const { id, name, group } = useLocalSearchParams<{ id: string; name: string; group?: string }>();
  const { user, token } = useAuth();
  const { subscribe, send } = useWs();
  const { startCall } = useCall();
  const isGroup = group === "1" || String(id).startsWith("group_");

  const [messages, setMessages] = useState<Msg[]>([]);
  const [attachOpen, setAttachOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder);
  const recStart = useRef<number>(0);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [otherTyping, setOtherTyping] = useState(false);
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);

  const [selected, setSelected] = useState<Msg | null>(null);
  const [brainOpen, setBrainOpen] = useState(false);
  const [aiResult, setAiResult] = useState<{ title: string; body: string; canReply?: boolean } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const [otherId, setOtherId] = useState<string | null>(null);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [blockedMe, setBlockedMe] = useState(false);
  const [chatTheme, setChatTheme] = useState<ChatTheme | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ct = resolveChatTheme(chatTheme, colors);

  const typingTimer = useRef<any>(null);

  const loadMeta = useCallback(async () => {
    try {
      const c = await api.get<any>(`/chats/${id}`);
      if (!isGroup && c.other?.user_id) setOtherId(c.other.user_id);
      setBlockedByMe(!!c.blocked_by_me);
      setBlockedMe(!!c.blocked_me);
      setChatTheme(c.theme || null);
    } catch {}
  }, [id, isGroup]);
  useEffect(() => { loadMeta(); }, [loadMeta]);

  const openProfile = () => {
    if (isGroup) { router.push({ pathname: "/group/[id]", params: { id: String(id), name: String(name) } }); return; }
    if (otherId) router.push({ pathname: "/user/[id]", params: { id: otherId } });
  };

  const applyTheme = async (theme: ChatTheme | null) => {
    setChatTheme(theme);
    try { await api.post(`/chats/${id}/theme`, { theme }); }
    catch { toast.show("Couldn't save theme", "error"); }
  };

  const toggleBlock = async () => {
    if (!otherId) return;
    setMenuOpen(false);
    try {
      const res = await api.post<{ blocked: boolean }>("/contacts/block", { user_id: otherId });
      setBlockedByMe(res.blocked);
      toast.show(res.blocked ? "User blocked" : "User unblocked", "success");
    } catch { toast.show("Failed", "error"); }
  };

  const deleteChat = async () => {
    setConfirmDelete(false); setMenuOpen(false);
    try { await api.del(`/chats/${id}`); router.replace("/(tabs)"); }
    catch { toast.show("Failed to delete chat", "error"); }
  };

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

  const doUpload = async (fn: () => Promise<any>) => {
    setAttachOpen(false); setUploading(true);
    try {
      const res = await fn();
      if (res?.message) setMessages((p) => [...p, res.message]);
    } catch (e: any) {
      if (String(e.message).includes("permission")) toast.show("Permission needed to continue", "error");
      else toast.show(e.message || "Upload failed", "error");
    } finally { setUploading(false); }
  };

  const onPickImage = () => doUpload(async () => {
    const r = await pickImageFromLibrary();
    if (r.canceled) return null;
    return uploadImage(String(id), r.assets[0]);
  });
  const onCamera = () => doUpload(async () => {
    const r = await captureImage();
    if (r.canceled) return null;
    return uploadImage(String(id), r.assets[0]);
  });
  const onPickDoc = () => doUpload(async () => {
    const r = await pickDocument();
    if (r.canceled) return null;
    return uploadDocument(String(id), r.assets[0]);
  });

  const startRecording = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) { toast.show("Microphone permission needed", "error"); return; }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recStart.current = Date.now();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch { toast.show("Could not start recording", "error"); }
  };
  const stopRecording = async (cancel = false) => {
    try {
      await recorder.stop();
      const uri = recorder.uri;
      const dur = (Date.now() - recStart.current) / 1000;
      if (cancel || !uri || dur < 1) return;
      setUploading(true);
      const res = await uploadVoice(String(id), uri, dur);
      if (res?.message) setMessages((p) => [...p, res.message]);
    } catch (e: any) { toast.show("Voice send failed", "error"); }
    finally { setUploading(false); }
  };

  const runAttachmentAI = async (action: string) => {
    if (!selected) return;
    setAiLoading(true); setAiResult({ title: "Chatly", body: "" });
    try {
      const res = await api.post<{ result: string; source: string }>("/ai/attachment", { message_id: selected.message_id, action });
      const titles: any = { summarize: "Summary", explain: "Explanation", translate: "Translation", find_amount: "Amounts", find_dates: "Dates", extract: "Extracted Info", create_task: "Task", create_notes: "Notes" };
      setAiResult({ title: titles[action] || "Chatly", body: res.result + (res.source ? `\n\nSource: ${res.source}` : "") });
    } catch (e: any) { setAiResult({ title: "Error", body: e.message }); }
    finally { setAiLoading(false); }
  };

  const openFile = (att: any) => {
    if (!token) return;
    Linking.openURL(fileUrl(att.storage_path, token));
  };

  const renderMsg = ({ item }: { item: Msg }) => {
    if (item.type === "system") {
      return <View style={{ alignItems: "center", marginVertical: spacing.sm }}><View style={{ backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 }}><AppText size="xs" muted>{item.text}</AppText></View></View>;
    }
    const mine = item.sender_id === user?.user_id;
    const reactionList = Object.values(item.reactions || {});
    return (
      <Pressable
        onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); setSelected(item); }}
        style={{ alignItems: mine ? "flex-end" : "flex-start", marginVertical: 3, paddingHorizontal: spacing.md }}
      >
        <View style={[styles.bubble, {
          backgroundColor: mine ? ct.bubbleOut : ct.bubbleIn,
          borderColor: ct.custom ? "transparent" : colors.border, borderWidth: mine ? 0 : (ct.custom ? 0 : 1),
          borderBottomRightRadius: mine ? 4 : radius.lg, borderBottomLeftRadius: mine ? radius.lg : 4,
        }]}>
          {isGroup && !mine && (
            <AppText size="xs" weight="bold" color={colors.brandPrimary} style={{ marginBottom: 2 }}>{item.sender_id.slice(0, 6)}</AppText>
          )}
          {item.attachment?.kind === "image" && (
            <Pressable onPress={() => openFile(item.attachment)}>
              <Image source={{ uri: token ? fileUrl(item.attachment.storage_path, token) : undefined }} style={{ width: 220, height: 220, borderRadius: radius.md, marginBottom: item.text ? 6 : 0 }} contentFit="cover" />
            </Pressable>
          )}
          {item.attachment?.kind === "file" && (
            <Pressable onPress={() => openFile(item.attachment)} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 4, minWidth: 200 }}>
              <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: mine ? "rgba(255,255,255,0.2)" : colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
                <Icon name="document-text" size={20} color={mine ? "#fff" : colors.brandPrimary} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <AppText size="base" weight="semibold" color={mine ? "#fff" : colors.onCard} numberOfLines={1}>{item.attachment.filename}</AppText>
                <AppText size="xs" color={mine ? "rgba(255,255,255,0.7)" : colors.onSurfaceMuted}>{Math.max(1, Math.round((item.attachment.size || 0) / 1024))} KB</AppText>
              </View>
            </Pressable>
          )}
          {item.attachment?.kind === "voice" && (
            <View style={{ minWidth: 210 }}>
              <Pressable onPress={() => openFile(item.attachment)} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 4 }}>
                <Icon name="play-circle" size={34} color={mine ? "#fff" : colors.brandPrimary} />
                <View style={{ flex: 1, height: 3, backgroundColor: mine ? "rgba(255,255,255,0.4)" : colors.border, marginHorizontal: 10, borderRadius: 2 }} />
                <AppText size="sm" color={mine ? "rgba(255,255,255,0.9)" : colors.onSurfaceMuted}>{Math.round(item.attachment.duration || 0)}s</AppText>
              </Pressable>
              {item.attachment.transcript ? (
                <AppText size="base" color={mine ? "rgba(255,255,255,0.95)" : colors.onCard} style={{ marginTop: 4, fontStyle: "italic" }}>“{item.attachment.transcript}”</AppText>
              ) : null}
            </View>
          )}
          {!!item.text && (
            <AppText size="md" color={mine ? ct.onBubbleOut : ct.onBubbleIn} style={{ fontStyle: item.deleted ? "italic" : "normal", opacity: item.deleted ? 0.7 : 1 }}>
              {item.text}
            </AppText>
          )}
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
        <Pressable testID="chat-header-profile" onPress={openProfile} style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
          <Avatar name={String(name)} size={40} online={!isGroup && !blockedMe} />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <AppText weight="bold" size="lg" numberOfLines={1}>{name}</AppText>
            <AppText size="sm" color={otherTyping ? colors.brandPrimary : colors.onSurfaceMuted}>{isGroup ? "Tap for group info" : blockedByMe ? "Blocked" : otherTyping ? "typing…" : "tap for profile"}</AppText>
          </View>
        </Pressable>
        <Pressable testID="voice-call-button" onPress={() => startCall(String(id), String(name), "voice")} style={{ width: 38, height: 40, alignItems: "center", justifyContent: "center" }}>
          <Icon name="call" size={22} color={colors.brandPrimary} />
        </Pressable>
        <Pressable testID="video-call-button" onPress={() => startCall(String(id), String(name), "video")} style={{ width: 38, height: 40, alignItems: "center", justifyContent: "center" }}>
          <Icon name="videocam" size={22} color={colors.brandPrimary} />
        </Pressable>
        <Pressable testID="chat-brain-button" onPress={() => { setBrainOpen(true); setAiResult(null); }} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
          <Icon name="sparkles" size={19} color={colors.brandPrimary} />
        </Pressable>
        {!isGroup && (
          <Pressable testID="chat-menu-button" onPress={() => setMenuOpen(true)} style={{ width: 36, height: 40, alignItems: "center", justifyContent: "center", marginLeft: 2 }}>
            <Icon name="ellipsis-vertical" size={20} />
          </Pressable>
        )}
      </View>

      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: ct.bg }} behavior="translate-with-padding" keyboardVerticalOffset={0}>
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

        {/* Composer / blocked banner */}
        {(blockedByMe || blockedMe) ? (
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.md, paddingTop: spacing.md, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, alignItems: "center" }}>
            <AppText muted center>{blockedByMe ? "You blocked this contact. Unblock to send messages." : "You can't reply to this conversation."}</AppText>
            {blockedByMe && (
              <Pressable testID="unblock-inline" onPress={toggleBlock} style={{ marginTop: spacing.sm }}>
                <AppText weight="bold" color={colors.brandPrimary}>Unblock</AppText>
              </Pressable>
            )}
          </View>
        ) : (
        <View style={{ flexDirection: "row", alignItems: "flex-end", paddingHorizontal: spacing.md, paddingBottom: insets.bottom + spacing.sm, paddingTop: spacing.sm, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Pressable testID="attach-button" onPress={() => setAttachOpen(true)} style={{ width: 40, height: 42, alignItems: "center", justifyContent: "center" }}>
            {uploading ? <ActivityIndicator size="small" color={colors.brandPrimary} /> : <Icon name="add-circle-outline" size={26} color={colors.brandPrimary} />}
          </Pressable>
          <Pressable testID="smart-reply-button" onPress={fetchSmartReplies} style={{ width: 36, height: 42, alignItems: "center", justifyContent: "center" }}>
            {loadingReplies ? <ActivityIndicator size="small" color={colors.brandPrimary} /> : <Icon name="sparkles" size={20} color={colors.brandPrimary} />}
          </Pressable>
          <View style={{ flex: 1, backgroundColor: colors.surfaceTertiary, borderRadius: radius.xl, paddingHorizontal: spacing.md, minHeight: 42, justifyContent: "center", maxHeight: 120 }}>
            <TextInput
              testID="message-input"
              value={text}
              onChangeText={onChangeText}
              placeholder={recState.isRecording ? "Recording…" : "Message"}
              placeholderTextColor={colors.onSurfaceMuted}
              multiline
              editable={!recState.isRecording}
              style={{ color: colors.onSurface, fontSize: fontSize.lg, paddingVertical: Platform.OS === "ios" ? 10 : 6 }}
            />
          </View>
          {text.trim() ? (
            <Pressable testID="send-button" onPress={onSend} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: ct.accent, alignItems: "center", justifyContent: "center", marginLeft: 6 }}>
              <Icon name="arrow-up" size={22} color="#fff" />
            </Pressable>
          ) : (
            <Pressable
              testID="voice-button"
              onPressIn={startRecording}
              onPressOut={() => stopRecording(false)}
              style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: recState.isRecording ? colors.error : ct.accent, alignItems: "center", justifyContent: "center", marginLeft: 6 }}
            >
              <Icon name={recState.isRecording ? "stop" : "mic"} size={22} color="#fff" />
            </Pressable>
          )}
        </View>
        )}
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
              {selected?.attachment ? ATT_ACTIONS.map((a) => (
                <Pressable key={a.key} testID={`att-action-${a.key}`} onPress={() => runAttachmentAI(a.key)} style={styles.actionRow}>
                  <Icon name={a.icon as any} size={20} color={colors.brandPrimary} />
                  <AppText style={{ marginLeft: spacing.md }} weight="medium">{a.label}</AppText>
                </Pressable>
              )) : MSG_ACTIONS.map((a) => (
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

      {/* Attachment options */}
      <Modal visible={attachOpen} transparent animationType="slide" onRequestClose={() => setAttachOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={() => setAttachOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + spacing.lg }]}>
          <AppText weight="bold" size="lg" style={{ marginBottom: spacing.md }}>Share</AppText>
          <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
            {[
              { key: "camera", label: "Camera", icon: "camera", onPress: onCamera },
              { key: "gallery", label: "Photos", icon: "image", onPress: onPickImage },
              { key: "document", label: "Document", icon: "document", onPress: onPickDoc },
            ].map((o) => (
              <Pressable key={o.key} testID={`attach-${o.key}`} onPress={o.onPress} style={{ alignItems: "center" }}>
                <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
                  <Icon name={o.icon as any} size={28} color={colors.brandPrimary} />
                </View>
                <AppText size="base" weight="semibold" style={{ marginTop: 8 }}>{o.label}</AppText>
              </Pressable>
            ))}
          </View>
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

      {/* 3-dot menu */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={{ flex: 1 }} onPress={() => setMenuOpen(false)}>
          <View style={{ position: "absolute", top: insets.top + 52, right: spacing.md, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, minWidth: 210, paddingVertical: spacing.xs, ...Platform.select({ ios: { shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }, android: { elevation: 8 } }) }}>
            <Pressable testID="menu-theme" onPress={() => { setMenuOpen(false); setThemeOpen(true); }} style={styles.menuRow}>
              <Icon name="color-palette-outline" size={20} color={colors.brandPrimary} />
              <AppText style={{ marginLeft: 12 }} weight="medium">Chat Theme</AppText>
            </Pressable>
            <Pressable testID="menu-block" onPress={toggleBlock} style={styles.menuRow}>
              <Icon name={blockedByMe ? "lock-open-outline" : "ban-outline"} size={20} color={colors.error} />
              <AppText style={{ marginLeft: 12 }} weight="medium" color={colors.error}>{blockedByMe ? "Unblock User" : "Block User"}</AppText>
            </Pressable>
            <Pressable testID="menu-delete" onPress={() => { setMenuOpen(false); setConfirmDelete(true); }} style={styles.menuRow}>
              <Icon name="trash-outline" size={20} color={colors.error} />
              <AppText style={{ marginLeft: 12 }} weight="medium" color={colors.error}>Delete Chat</AppText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Chat theme customizer */}
      <Modal visible={themeOpen} transparent animationType="slide" onRequestClose={() => setThemeOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={() => setThemeOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + spacing.lg }]}>
          <AppText weight="bold" size="lg" style={{ marginBottom: spacing.md }}>Chat Theme</AppText>
          <AppText muted size="sm" weight="bold" style={{ marginBottom: spacing.sm }}>BACKGROUND</AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {CHAT_THEME_PRESETS.map((p) => {
              const active = (chatTheme?.preset || "default") === p.preset;
              return (
                <Pressable key={p.preset} testID={`theme-${p.preset}`} onPress={() => applyTheme(p.preset === "default" ? (chatTheme?.accent ? { preset: "default", accent: chatTheme.accent } : null) : { ...p, accent: chatTheme?.accent || p.accent })} style={{ alignItems: "center", width: 72 }}>
                  <View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: p.bg || colors.surface, borderWidth: active ? 3 : 1, borderColor: active ? colors.brandPrimary : colors.border, alignItems: "center", justifyContent: "center" }}>
                    {p.bubbleOut ? <View style={{ width: 26, height: 14, borderRadius: 7, backgroundColor: p.bubbleOut }} /> : <Icon name="contrast-outline" size={18} color={colors.onSurfaceMuted} />}
                  </View>
                  <AppText size="xs" style={{ marginTop: 4 }}>{p.label}</AppText>
                </Pressable>
              );
            })}
          </View>
          <AppText muted size="sm" weight="bold" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>ACCENT COLOR</AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {ACCENTS.map((a) => (
              <Pressable key={a} testID={`accent-${a}`} onPress={() => applyTheme({ ...(chatTheme || {}), preset: chatTheme?.preset || "default", accent: a })} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: a, borderWidth: ct.accent === a ? 3 : 1, borderColor: ct.accent === a ? colors.onSurface : colors.border }} />
            ))}
          </View>
          <Pressable testID="reset-theme" onPress={() => applyTheme(null)} style={{ marginTop: spacing.lg, alignSelf: "center" }}>
            <AppText weight="bold" color={colors.brandPrimary}>Reset to Default</AppText>
          </Pressable>
        </View>
      </Modal>

      {/* Delete chat confirm */}
      <Modal visible={confirmDelete} transparent animationType="fade" onRequestClose={() => setConfirmDelete(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
          <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.xl, width: "100%" }}>
            <AppText weight="bold" size="lg" center>Delete this chat?</AppText>
            <AppText muted center style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>The conversation is removed from your chats. It reappears if you receive a new message.</AppText>
            <Pressable testID="confirm-delete-chat" onPress={deleteChat} style={{ height: 48, borderRadius: radius.md, backgroundColor: colors.error, alignItems: "center", justifyContent: "center" }}><AppText weight="bold" color="#fff">Delete Chat</AppText></Pressable>
            <Pressable onPress={() => setConfirmDelete(false)} style={{ marginTop: spacing.md, alignItems: "center" }}><AppText weight="semibold">Cancel</AppText></Pressable>
          </View>
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
  menuRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
});
