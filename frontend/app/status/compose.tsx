import { useState } from "react";
import { View, Pressable, TextInput, StyleSheet } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, spacing, radius, fontSize } from "@/src/theme";
import { AppText, Icon, useToast } from "@/src/ui";
import { api } from "@/src/api";

const BGS = ["#FF5E00", "#2E86DE", "#31A24C", "#8E44AD", "#E84393", "#111827", "#0f2027", "#E67E22"];

export default function ComposeStatus() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [text, setText] = useState("");
  const [bg, setBg] = useState(BGS[0]);
  const [saving, setSaving] = useState(false);

  const post = async () => {
    if (!text.trim()) { toast.show("Write something first", "info"); return; }
    setSaving(true);
    try {
      await api.post("/status", { kind: "text", text: text.trim(), bg });
      toast.show("Status posted", "success");
      router.back();
    } catch (e: any) { toast.show(e.message || "Failed to post", "error"); }
    finally { setSaving(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center" }}>
        <Pressable testID="compose-close" onPress={() => router.back()} hitSlop={10} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
          <Icon name="close" size={28} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }} />
        <AppText weight="bold" color="#fff">Text Status</AppText>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="translate-with-padding">
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
          <TextInput
            testID="status-text-input"
            value={text}
            onChangeText={setText}
            placeholder="Type a status…"
            placeholderTextColor="rgba(255,255,255,0.7)"
            multiline
            autoFocus
            maxLength={700}
            style={{ color: "#fff", fontSize: 26, fontWeight: "700", textAlign: "center", width: "100%" }}
          />
        </View>

        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "center", marginBottom: spacing.lg }}>
            {BGS.map((c) => (
              <Pressable key={c} onPress={() => setBg(c)} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c, borderWidth: bg === c ? 3 : 1, borderColor: "#fff" }} />
            ))}
          </View>
          <Pressable testID="post-status" onPress={post} disabled={saving} style={{ height: 52, borderRadius: radius.md, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
            <AppText weight="heavy" size="lg" color={bg}>{saving ? "Posting…" : "Post Status"}</AppText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({});
