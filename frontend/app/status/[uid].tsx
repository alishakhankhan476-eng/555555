import { useEffect, useRef, useState } from "react";
import { View, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, spacing } from "@/src/theme";
import { AppText, Avatar, Icon, useToast } from "@/src/ui";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { statusMediaUrl } from "@/src/upload";

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function StatusVideo({ uri, onEnd }: { uri: string; onEnd: () => void }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = false; p.play(); });
  useEffect(() => {
    const sub = player.addListener("playToEnd", () => onEnd());
    return () => sub.remove();
  }, [player]);
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />;
}

export default function StatusViewer() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const { user: me, token } = useAuth();

  const [author, setAuthor] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const timer = useRef<any>(null);
  const mine = uid === "me" || uid === me?.user_id;

  useEffect(() => {
    (async () => {
      try {
        const feed = await api.get("/status/feed");
        if (mine) { setAuthor(feed.mine_user); setItems(feed.mine); }
        else {
          const g = (feed.others || []).find((x: any) => x.user.user_id === uid);
          if (g) { setAuthor(g.user); setItems(g.statuses); }
        }
      } catch { toast.show("Could not load status", "error"); }
      finally { setLoading(false); }
    })();
  }, [uid]);

  const current = items[idx];

  const next = () => {
    if (idx < items.length - 1) setIdx((i) => i + 1);
    else router.back();
  };
  const prev = () => { if (idx > 0) setIdx((i) => i - 1); };

  // auto-advance + progress
  useEffect(() => {
    if (!current) return;
    setProgress(0);
    if (!mine) api.post(`/status/${current.id}/view`).catch(() => {});
    const dur = current.kind === "video" ? 15000 : 5000;
    const step = 50;
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setProgress((p) => {
        const np = p + step / dur;
        if (np >= 1) { clearInterval(timer.current); next(); return 1; }
        return np;
      });
    }, step);
    return () => clearInterval(timer.current);
  }, [idx, current?.id]);

  const del = async () => {
    if (!current) return;
    try {
      await api.del(`/status/${current.id}`);
      const rest = items.filter((x) => x.id !== current.id);
      toast.show("Status deleted", "success");
      if (rest.length === 0) { router.back(); return; }
      setItems(rest); setIdx((i) => Math.max(0, Math.min(i, rest.length - 1)));
    } catch { toast.show("Failed to delete", "error"); }
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" }}><ActivityIndicator color="#fff" /></View>;
  if (!current) return <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" }}><AppText color="#fff">No status to show</AppText></View>;

  const bg = current.kind === "text" ? (current.bg || "#FF5E00") : "#000";
  const mediaUri = current.kind === "image" ? current.media_b64
    : current.kind === "video" && token ? statusMediaUrl(current.media_path, token) : null;

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {current.kind === "image" && mediaUri ? (
        <Image source={{ uri: mediaUri }} style={StyleSheet.absoluteFill} contentFit="contain" />
      ) : current.kind === "video" && mediaUri ? (
        <StatusVideo key={current.id} uri={mediaUri} onEnd={next} />
      ) : null}

      {/* Progress bars */}
      <View style={{ position: "absolute", top: insets.top + 6, left: spacing.md, right: spacing.md, flexDirection: "row", gap: 4 }}>
        {items.map((s, i) => (
          <View key={s.id} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.35)", overflow: "hidden" }}>
            <View style={{ height: 3, borderRadius: 2, backgroundColor: "#fff", width: `${i < idx ? 100 : i === idx ? progress * 100 : 0}%` }} />
          </View>
        ))}
      </View>

      {/* Header */}
      <View style={{ position: "absolute", top: insets.top + 18, left: spacing.md, right: spacing.md, flexDirection: "row", alignItems: "center" }}>
        <Avatar name={author?.name} uri={author?.avatar} size={38} />
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <AppText weight="bold" color="#fff" numberOfLines={1}>{mine ? "My Status" : author?.name}</AppText>
          <AppText size="xs" color="rgba(255,255,255,0.8)">{ago(current.created_at)}</AppText>
        </View>
        {mine && (
          <Pressable testID="delete-status" onPress={del} hitSlop={10} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
            <Icon name="trash-outline" size={22} color="#fff" />
          </Pressable>
        )}
        <Pressable testID="close-viewer" onPress={() => router.back()} hitSlop={10} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
          <Icon name="close" size={26} color="#fff" />
        </Pressable>
      </View>

      {/* Text status body */}
      {current.kind === "text" && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xxl }}>
          <AppText color="#fff" center style={{ fontSize: 28, fontWeight: "800" }}>{current.text}</AppText>
        </View>
      )}

      {/* Caption for media */}
      {current.kind !== "text" && !!current.text && (
        <View style={{ position: "absolute", bottom: insets.bottom + 30, left: spacing.lg, right: spacing.lg }}>
          <AppText color="#fff" center weight="semibold" style={{ backgroundColor: "rgba(0,0,0,0.4)", padding: spacing.sm, borderRadius: 10 }}>{current.text}</AppText>
        </View>
      )}

      {mine && (
        <View style={{ position: "absolute", bottom: insets.bottom + 6, left: 0, right: 0, alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.4)", paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 999 }}>
            <Icon name="eye-outline" size={16} color="#fff" />
            <AppText color="#fff" size="sm" style={{ marginLeft: 6 }}>{current.views_count} views</AppText>
          </View>
        </View>
      )}

      {/* Tap zones */}
      <Pressable onPress={prev} style={{ position: "absolute", left: 0, top: 80, bottom: 0, width: "33%" }} />
      <Pressable onPress={next} style={{ position: "absolute", right: 0, top: 80, bottom: 0, width: "67%" }} />
    </View>
  );
}
