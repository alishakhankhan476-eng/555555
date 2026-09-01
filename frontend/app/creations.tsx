import { useState, useCallback } from "react";
import { View, ScrollView, Pressable, Modal, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, spacing, radius } from "@/src/theme";
import { AppText, Icon, Card, EmptyState, Loading, Input, Button, useToast } from "@/src/ui";
import { StackHeader } from "@/src/Header";
import { api } from "@/src/api";
import dayjs from "dayjs";

const KINDS = [
  { key: "document", label: "Document", icon: "document-text-outline" },
  { key: "presentation", label: "Presentation", icon: "easel-outline" },
  { key: "spreadsheet", label: "Spreadsheet", icon: "grid-outline" },
  { key: "notes", label: "Notes", icon: "reader-outline" },
  { key: "checklist", label: "Checklist", icon: "list-outline" },
  { key: "plan", label: "Plan", icon: "map-outline" },
];

export default function Creations() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [kind, setKind] = useState("document");
  const [prompt, setPrompt] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try { const res = await api.get("/ai/creations"); setItems(res.creations); } catch {} finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const create = async () => {
    if (!prompt.trim()) return;
    setCreating(true);
    try {
      const res = await api.post<{ id: string }>("/ai/create", { kind, prompt: prompt.trim() });
      setPrompt(""); setAddOpen(false); load();
      router.push({ pathname: "/creation/[id]", params: { id: res.id } });
    } catch (e: any) { toast.show(e.message || "Failed to create", "error"); }
    finally { setCreating(false); }
  };

  const del = async (id: string) => { setItems((p) => p.filter((x) => x.id !== id)); try { await api.del(`/ai/creations/${id}`); } catch {} };

  const iconFor = (k: string) => KINDS.find((x) => x.key === k)?.icon || "document-outline";

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="AI Creation Studio" right={<Pressable testID="new-creation-button" onPress={() => setAddOpen(true)}><Icon name="add-circle" size={28} color={colors.brandPrimary} /></Pressable>} />
      {loading ? <Loading /> : items.length === 0 ? (
        <EmptyState icon="color-wand-outline" title="Create without leaving Chatly" subtitle="Generate documents, presentations, spreadsheets and more from a single prompt." action={<Button title="Create Something" onPress={() => setAddOpen(true)} full={false} icon="sparkles" />} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
          {items.map((c) => (
            <Card key={c.id} testID={`creation-${c.id}`} onPress={() => router.push({ pathname: "/creation/[id]", params: { id: c.id } })} style={{ flexDirection: "row", alignItems: "center", padding: spacing.md }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
                <Icon name={iconFor(c.kind) as any} size={22} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <AppText weight="semibold" numberOfLines={1}>{c.title}</AppText>
                <AppText size="sm" muted style={{ textTransform: "capitalize" }}>{c.kind} · {dayjs(c.created_at).format("DD MMM")}</AppText>
              </View>
              <Pressable testID={`delete-creation-${c.id}`} onPress={() => del(c.id)} hitSlop={8}><Icon name="trash-outline" size={18} color={colors.onSurfaceMuted} /></Pressable>
            </Card>
          ))}
        </ScrollView>
      )}

      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={() => !creating && setAddOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + spacing.lg }]}>
          <AppText weight="bold" size="lg" style={{ marginBottom: spacing.md }}>Create with Chatly</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.md }}>
            {KINDS.map((k) => (
              <Pressable key={k.key} testID={`kind-${k.key}`} onPress={() => setKind(k.key)} style={{ paddingHorizontal: spacing.md, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: kind === k.key ? colors.brandPrimary : colors.border, backgroundColor: kind === k.key ? colors.brandPrimary : colors.card, flexDirection: "row", alignItems: "center", flexShrink: 0 }}>
                <Icon name={k.icon as any} size={16} color={kind === k.key ? "#fff" : colors.onSurfaceMuted} />
                <AppText weight="semibold" color={kind === k.key ? "#fff" : colors.onSurface} style={{ marginLeft: 6 }}>{k.label}</AppText>
              </Pressable>
            ))}
          </ScrollView>
          <Input testID="creation-prompt" value={prompt} onChangeText={setPrompt} placeholder={`Describe the ${kind} you want…`} multiline />
          <Button testID="generate-creation" title={creating ? "Generating…" : "Generate"} onPress={create} loading={creating} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg },
});
