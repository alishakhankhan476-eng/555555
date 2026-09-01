import { useState, useEffect, useRef } from "react";
import { View, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAudioRecorder, useAudioRecorderState, RecordingPresets, AudioModule, setAudioModeAsync } from "expo-audio";
import { useTheme, spacing, radius } from "@/src/theme";
import { AppText, Icon, Card, Button, useToast, Loading, Input } from "@/src/ui";
import { StackHeader } from "@/src/Header";
import { api } from "@/src/api";

const BASE = (process.env.EXPO_PUBLIC_BACKEND_URL || "") + "/api";

export default function CallIntelligence() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [call, setCall] = useState<any>(null);
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [ask, setAsk] = useState("");
  const [answer, setAnswer] = useState<{ text: string; source: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder);
  const recStart = useRef(0);

  const load = async () => {
    try {
      const [c, t] = await Promise.all([api.get(`/calls/${id}`), api.get(`/calls/${id}/transcript`)]);
      setCall(c.call); setTranscript(t.transcript || "");
      if (c.call.summary) setSummary(c.call.summary);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);

  const recordAudio = async () => {
    if (recState.isRecording) {
      setBusy("transcribe");
      try {
        await recorder.stop();
        const uri = recorder.uri;
        if (uri) {
          const res = await uploadCallAudio(String(id), uri);
          setTranscript(res.transcript || "");
          toast.show("Transcribed", "success");
        }
      } catch { toast.show("Transcription failed", "error"); }
      finally { setBusy(null); }
      return;
    }
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) { toast.show("Microphone permission needed", "error"); return; }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recStart.current = Date.now();
    } catch { toast.show("Could not start recording", "error"); }
  };

  const saveNotes = async () => {
    if (!notes.trim()) return;
    setBusy("notes");
    try { const r = await api.post(`/calls/${id}/transcript-text`, { text: notes.trim() }); setTranscript(r.transcript); setNotes(""); toast.show("Saved", "success"); }
    catch (e: any) { toast.show(e.message, "error"); }
    finally { setBusy(null); }
  };

  const genSummary = async () => {
    setBusy("summary");
    try { const r = await api.post(`/calls/${id}/ai`, { action: "summary" }); setSummary(r.summary); }
    catch (e: any) { toast.show(e.message, "error"); }
    finally { setBusy(null); }
  };
  const genTasks = async () => {
    setBusy("tasks");
    try { const r = await api.post(`/calls/${id}/ai`, { action: "tasks" }); setItems(r.items || []); if (!r.items?.length) toast.show("No action items found", "info"); }
    catch (e: any) { toast.show(e.message, "error"); }
    finally { setBusy(null); }
  };
  const doAsk = async () => {
    if (!ask.trim()) return;
    setBusy("ask"); setAnswer(null);
    try { const r = await api.post(`/calls/${id}/ai`, { action: "ask", question: ask.trim() }); setAnswer({ text: r.answer, source: r.source }); }
    catch (e: any) { toast.show(e.message, "error"); }
    finally { setBusy(null); }
  };

  const createFromItem = async (it: any) => {
    try {
      if (it.type === "meeting") await api.post("/calendar", { title: it.title, when: it.when, source_call_id: id });
      else if (it.type === "followup" || it.type === "deadline") await api.post("/reminders", { title: it.title + (it.when ? ` (${it.when})` : "") });
      else await api.post("/tasks", { title: it.title, due: it.when || null, person: it.owner || null, priority: "high" });
      toast.show("Created — needs your review in the list", "success");
    } catch { toast.show("Failed", "error"); }
  };

  const deleteTranscript = async () => {
    try { await api.del(`/calls/${id}/transcript`); setTranscript(""); setSummary(null); setItems([]); setAnswer(null); toast.show("Deleted", "success"); }
    catch { toast.show("Failed", "error"); }
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: colors.surface }}><StackHeader title="Call" /><Loading /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Call Intelligence" subtitle={call?.peer?.name} right={<Icon name="sparkles" size={22} color={colors.brandPrimary} />} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.brandTertiary }}>
          <Icon name="shield-checkmark" size={16} color={colors.brandPrimary} />
          <AppText size="base" color={colors.onBrandTertiary} style={{ flex: 1, marginLeft: 8 }}>Chatly only processes calls you choose. Recording is never automatic — add notes or a recording below.</AppText>
        </View>

        {!transcript ? (
          <Card style={{ gap: spacing.md }}>
            <AppText weight="bold" size="lg">Add call transcript</AppText>
            <Pressable testID="record-call-audio" onPress={recordAudio} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", height: 52, borderRadius: radius.md, backgroundColor: recState.isRecording ? colors.error : colors.brandPrimary }}>
              {busy === "transcribe" ? <ActivityIndicator color="#fff" /> : <><Icon name={recState.isRecording ? "stop" : "mic"} size={20} color="#fff" /><AppText weight="bold" color="#fff" style={{ marginLeft: 8 }}>{recState.isRecording ? "Stop & Transcribe" : "Record call notes"}</AppText></>}
            </Pressable>
            <AppText muted size="sm" center>or type notes</AppText>
            <Input testID="call-notes-input" value={notes} onChangeText={setNotes} placeholder="Type what was discussed…" multiline />
            <Button testID="save-notes" title="Save Notes" variant="secondary" onPress={saveNotes} loading={busy === "notes"} />
          </Card>
        ) : (
          <>
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.sm }}>
                <AppText weight="bold" size="lg" style={{ flex: 1 }}>Transcript</AppText>
                <Pressable testID="delete-transcript" onPress={deleteTranscript} hitSlop={8}><Icon name="trash-outline" size={18} color={colors.error} /></Pressable>
              </View>
              <AppText size="md" style={{ lineHeight: 22 }}>{transcript}</AppText>
            </Card>

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Button testID="gen-summary" title="Summary" icon="document-text-outline" onPress={genSummary} loading={busy === "summary"} style={{ flex: 1 }} />
              <Button testID="gen-tasks" title="Action Items" variant="secondary" icon="checkbox-outline" onPress={genTasks} loading={busy === "tasks"} style={{ flex: 1 }} />
            </View>

            {summary && (
              <Card style={{ gap: spacing.sm }}>
                <AppText weight="bold" size="lg" color={colors.brandPrimary}>Summary</AppText>
                <AppText size="md" style={{ lineHeight: 22 }}>{summary.summary}</AppText>
                {["decisions", "action_items", "deadlines", "follow_ups"].map((k) => (summary[k]?.length ? (
                  <View key={k} style={{ marginTop: spacing.sm }}>
                    <AppText weight="bold" size="sm" muted style={{ textTransform: "uppercase" }}>{k.replace("_", " ")}</AppText>
                    {summary[k].map((x: string, i: number) => <AppText key={i} style={{ marginTop: 2 }}>• {x}</AppText>)}
                  </View>
                ) : null))}
              </Card>
            )}

            {items.length > 0 && (
              <Card style={{ gap: spacing.sm }}>
                <AppText weight="bold" size="lg">Detected Actions</AppText>
                {items.map((it, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: colors.divider }}>
                    <View style={{ flex: 1 }}>
                      <AppText weight="semibold">{it.title}</AppText>
                      <AppText size="sm" muted>{it.type}{it.owner ? ` · ${it.owner}` : ""}{it.when ? ` · ${it.when}` : ""}</AppText>
                    </View>
                    <Pressable testID={`create-item-${i}`} onPress={() => createFromItem(it)} style={{ paddingHorizontal: spacing.md, height: 34, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }}>
                      <AppText size="base" weight="bold" color="#fff">{it.type === "meeting" ? "Add" : "Create"}</AppText>
                    </Pressable>
                  </View>
                ))}
              </Card>
            )}

            <Card style={{ gap: spacing.sm }}>
              <AppText weight="bold" size="lg">Ask Chatly about this call</AppText>
              <Input testID="call-ask-input" value={ask} onChangeText={setAsk} placeholder="e.g. What decisions were made?" onSubmitEditing={doAsk} returnKeyType="search" />
              <Button testID="call-ask-submit" title="Ask" onPress={doAsk} loading={busy === "ask"} />
              {answer && (
                <View style={{ marginTop: spacing.sm }}>
                  <AppText size="md" style={{ lineHeight: 22 }}>{answer.text}</AppText>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: spacing.sm }}>
                    <Icon name="link" size={14} color={colors.brandPrimary} />
                    <AppText size="sm" color={colors.brandPrimary} style={{ marginLeft: 6 }}>{answer.source}</AppText>
                  </View>
                </View>
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// upload call audio via the calls transcript endpoint
async function uploadCallAudio(callId: string, uri: string) {
  const { storage } = await import("@/src/utils/storage");
  const { Platform } = await import("react-native");
  const token = await storage.secureGet<string>("chatly_token", "");
  const form = new FormData();
  const name = Platform.OS === "web" ? "call.webm" : "call.m4a";
  const type = Platform.OS === "web" ? "audio/webm" : "audio/m4a";
  if (Platform.OS === "web") { const blob = await (await fetch(uri)).blob(); form.append("file", blob, name); }
  else form.append("file", { uri, name, type } as any);
  form.append("language", "en");
  const res = await fetch(`${BASE}/calls/${callId}/transcript`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
  const t = await res.text();
  let d: any = null; try { d = t ? JSON.parse(t) : null; } catch { d = { detail: t }; }
  if (!res.ok) throw new Error(d?.detail || "Failed");
  return d;
}

const styles = StyleSheet.create({});
