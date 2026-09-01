import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { View, Modal, Pressable, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useTheme, spacing, radius } from "@/src/theme";
import { AppText, Avatar, Icon } from "@/src/ui";
import { api } from "@/src/api";
import { useWs } from "@/src/ws";

type Call = any;
type CallCtx = { startCall: (chatId: string, name: string, type: "voice" | "video") => Promise<void> };
const Ctx = createContext<CallCtx>({ startCall: async () => {} });

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const router = useRouter();
  const { subscribe } = useWs();
  const [call, setCall] = useState<Call | null>(null);
  const [phase, setPhase] = useState<"incoming" | "outgoing" | "connected" | "ended">("outgoing");
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [camOff, setCamOff] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timer = useRef<any>(null);

  const clearTimer = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
  const startTimer = () => { clearTimer(); setSeconds(0); timer.current = setInterval(() => setSeconds((s) => s + 1), 1000); };

  const reset = useCallback((goIntel?: string) => {
    clearTimer(); setCall(null); setPhase("outgoing"); setMuted(false); setCamOff(false);
    if (goIntel) router.push({ pathname: "/call-intelligence/[id]", params: { id: goIntel } });
  }, [router]);

  useEffect(() => subscribe((ev) => {
    if (ev.type === "incoming_call") {
      setCall(ev.call); setPhase("incoming");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    } else if (ev.type === "call_accepted") {
      setPhase("connected"); startTimer();
    } else if (ev.type === "call_rejected") {
      setPhase("ended"); setTimeout(() => reset(), 1200);
    } else if (ev.type === "call_ended") {
      setPhase("ended");
      const cid = call?.call_id || ev.call_id;
      setTimeout(() => reset(ev.duration > 0 ? cid : undefined), 1200);
    }
  }), [subscribe, call, reset]);

  const startCall = useCallback(async (chatId: string, name: string, type: "voice" | "video") => {
    try {
      const res = await api.post<{ call: Call }>("/calls", { chat_id: chatId, type });
      setCall({ ...res.call, caller_name: "You", peerName: name });
      setPhase("outgoing"); setCamOff(type === "voice");
    } catch { /* ignore */ }
  }, []);

  const accept = async () => {
    if (!call) return;
    try { await api.post(`/calls/${call.call_id}/accept`); setPhase("connected"); startTimer(); } catch {}
  };
  const reject = async () => {
    if (!call) return;
    try { await api.post(`/calls/${call.call_id}/reject`); } catch {}
    reset();
  };
  const end = async () => {
    if (!call) return;
    try { const r = await api.post<{ duration: number }>(`/calls/${call.call_id}/end`); reset(r.duration > 0 ? call.call_id : undefined); }
    catch { reset(); }
  };

  const visible = !!call;
  const isVideo = call?.type === "video";
  const peerName = call?.peerName || call?.caller_name || call?.peer?.name || "Call";
  const peerAvatar = call?.caller_avatar || call?.peer?.avatar;
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const statusLabel = phase === "incoming" ? `Incoming ${isVideo ? "video" : "voice"} call`
    : phase === "outgoing" ? "Calling…" : phase === "ended" ? "Call ended" : fmt(seconds);

  return (
    <Ctx.Provider value={{ startCall }}>
      {children}
      <Modal visible={visible} animationType="slide" onRequestClose={() => {}}>
        <LinearGradient colors={isVideo ? ["#101014", "#1C1C1E"] : [colors.brandPrimary, "#B33F00"]} style={styles.fill}>
          <View style={styles.center}>
            <Avatar name={peerName} uri={peerAvatar} size={120} />
            <AppText size="xxl" weight="heavy" color="#fff" style={{ marginTop: spacing.lg }}>{peerName}</AppText>
            <AppText size="lg" color="rgba(255,255,255,0.85)" style={{ marginTop: 6 }}>{statusLabel}</AppText>
            {phase === "connected" && (
              <View style={{ marginTop: spacing.lg, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill }}>
                <Icon name="cellular" size={14} color="#fff" />
                <AppText size="sm" color="#fff" style={{ marginLeft: 6 }}>Connected · media activates on device build</AppText>
              </View>
            )}
          </View>

          <View style={{ paddingBottom: 48, paddingHorizontal: spacing.xl }}>
            {phase === "incoming" ? (
              <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
                <CallBtn testID="reject-call" icon="close" bg={colors.error} label="Decline" onPress={reject} />
                <CallBtn testID="accept-call" icon="call" bg={colors.success} label="Accept" onPress={accept} />
              </View>
            ) : (
              <>
                {phase === "connected" && (
                  <View style={{ flexDirection: "row", justifyContent: "center", gap: spacing.xl, marginBottom: spacing.xl }}>
                    <CallBtn testID="toggle-mute" icon={muted ? "mic-off" : "mic"} bg="rgba(255,255,255,0.2)" label={muted ? "Unmute" : "Mute"} small onPress={() => setMuted((m) => !m)} />
                    <CallBtn testID="toggle-speaker" icon={speaker ? "volume-high" : "volume-mute"} bg="rgba(255,255,255,0.2)" label="Speaker" small onPress={() => setSpeaker((s) => !s)} />
                    {isVideo && <CallBtn testID="toggle-cam" icon={camOff ? "videocam-off" : "videocam"} bg="rgba(255,255,255,0.2)" label="Camera" small onPress={() => setCamOff((c) => !c)} />}
                  </View>
                )}
                <View style={{ alignItems: "center" }}>
                  <CallBtn testID="end-call" icon="call" bg={colors.error} label="End" rotate onPress={end} />
                </View>
              </>
            )}
          </View>
        </LinearGradient>
      </Modal>
    </Ctx.Provider>
  );
}

function CallBtn({ icon, bg, label, onPress, small, rotate, testID }: any) {
  const size = small ? 56 : 68;
  return (
    <Pressable testID={testID} onPress={onPress} style={{ alignItems: "center" }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={small ? 24 : 30} color="#fff" />
      </View>
      <AppText size="sm" color="rgba(255,255,255,0.9)" style={{ marginTop: 8 }}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: "space-between", paddingTop: 100 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});

export const useCall = () => useContext(Ctx);
