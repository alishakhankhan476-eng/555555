import { useState, useCallback } from "react";
import { View, ScrollView, Pressable, Modal, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, spacing, radius } from "@/src/theme";
import { AppText, Icon, Card, EmptyState, Loading, Input, Button, useToast } from "@/src/ui";
import { StackHeader } from "@/src/Header";
import { api } from "@/src/api";

export default function Reminders() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");

  const load = useCallback(async () => {
    try { const res = await api.get("/reminders"); setItems(res.reminders); } catch {} finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const complete = async (id: string) => { setItems((p) => p.map((x) => x.id === id ? { ...x, done: true } : x)); try { await api.put(`/reminders/${id}/done`); } catch { load(); } };
  const del = async (id: string) => { setItems((p) => p.filter((x) => x.id !== id)); try { await api.del(`/reminders/${id}`); } catch {} };
  const add = async () => {
    if (!title.trim()) return;
    try { await api.post("/reminders", { title: title.trim(), remind_at: when.trim() || null }); setTitle(""); setWhen(""); setAddOpen(false); load(); toast.show("Reminder set", "success"); }
    catch { toast.show("Failed", "error"); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Reminders" right={<Pressable testID="add-reminder-button" onPress={() => setAddOpen(true)}><Icon name="add-circle" size={28} color={colors.brandPrimary} /></Pressable>} />
      {loading ? <Loading /> : items.length === 0 ? (
        <EmptyState icon="alarm-outline" title="No reminders yet" subtitle="Set reminders manually or ask Chatly to remind you from a message." action={<Button title="Add Reminder" onPress={() => setAddOpen(true)} full={false} icon="add" />} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
          {items.map((r) => (
            <Card key={r.id} style={{ flexDirection: "row", alignItems: "center", padding: spacing.md }}>
              <Pressable testID={`complete-reminder-${r.id}`} onPress={() => complete(r.id)} hitSlop={8}>
                <Icon name={r.done ? "checkmark-circle" : "alarm-outline"} size={24} color={r.done ? colors.success : colors.brandPrimary} />
              </Pressable>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <AppText weight="medium" style={{ opacity: r.done ? 0.5 : 1, textDecorationLine: r.done ? "line-through" : "none" }}>{r.title}</AppText>
                {r.remind_at ? <AppText size="sm" muted style={{ marginTop: 2 }}>{r.remind_at}</AppText> : null}
              </View>
              <Pressable testID={`delete-reminder-${r.id}`} onPress={() => del(r.id)} hitSlop={8}><Icon name="trash-outline" size={18} color={colors.onSurfaceMuted} /></Pressable>
            </Card>
          ))}
        </ScrollView>
      )}

      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={() => setAddOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + spacing.lg }]}>
          <AppText weight="bold" size="lg" style={{ marginBottom: spacing.md }}>New Reminder</AppText>
          <Input testID="reminder-title-input" label="Remind me to" value={title} onChangeText={setTitle} placeholder="e.g. Reply to Rahul" />
          <Input testID="reminder-when-input" label="When (optional)" value={when} onChangeText={setWhen} placeholder="e.g. Tomorrow 9 AM" autoCapitalize="none" />
          <Button testID="save-reminder" title="Set Reminder" onPress={add} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg },
});
