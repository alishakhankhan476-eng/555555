import { useState, useEffect } from "react";
import { View, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, spacing, radius, fontSize } from "@/src/theme";
import { AppText, Icon, Card, EmptyState } from "@/src/ui";
import { StackHeader } from "@/src/Header";
import { api } from "@/src/api";
import dayjs from "dayjs";

const STEPS = ["Searching the web…", "Reading sources…", "Comparing information…", "Synthesizing report…"];

export default function Research() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  const loadHistory = () => api.get("/ai/research").then((r) => setHistory(r.research)).catch(() => {});
  useEffect(() => { loadHistory(); }, []);

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 1800);
    return () => clearInterval(t);
  }, [loading]);

  const research = async (query: string) => {
    if (!query.trim()) return;
    setLoading(true); setResult(null); setStep(0);
    try {
      const res = await api.post("/ai/research", { query: query.trim() });
      setResult(res); loadHistory();
    } catch (e: any) { setResult({ report: e.message, sources: [] }); }
    finally { setLoading(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="Deep Research" subtitle="Web research with citations" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={insets.top + 50}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
          {loading && (
            <View style={{ alignItems: "center", padding: spacing.xl }}>
              <Icon name="globe-outline" size={30} color={colors.brandPrimary} />
              <AppText weight="semibold" style={{ marginTop: spacing.md }}>{STEPS[step]}</AppText>
            </View>
          )}

          {result && (
            <Card style={{ marginBottom: spacing.lg }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.sm }}>
                <Icon name="document-text-outline" size={18} color={colors.brandPrimary} />
                <AppText weight="bold" size="lg" style={{ marginLeft: 6, flex: 1 }} numberOfLines={2}>{result.query || "Report"}</AppText>
              </View>
              <AppText size="md" style={{ lineHeight: 23 }}>{result.report}</AppText>
              {result.sources?.length > 0 && (
                <>
                  <AppText weight="bold" muted size="sm" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>SOURCES</AppText>
                  {result.sources.map((s: any, i: number) => (
                    <Pressable key={i} testID={`research-source-${i}`} onPress={() => s.url && Linking.openURL(s.url)} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6 }}>
                      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", marginRight: 8 }}>
                        <AppText size="xs" weight="bold" color={colors.brandPrimary}>{i + 1}</AppText>
                      </View>
                      <AppText size="base" color={colors.brandPrimary} numberOfLines={1} style={{ flex: 1 }}>{s.title}</AppText>
                    </Pressable>
                  ))}
                </>
              )}
            </Card>
          )}

          {!loading && !result && (
            history.length === 0 ? (
              <EmptyState icon="globe-outline" title="Research anything" subtitle="Ask a question and Chatly will search the web, compare sources and write a cited report." />
            ) : (
              <>
                <AppText weight="bold" muted size="sm" style={{ marginBottom: spacing.sm }}>RECENT RESEARCH</AppText>
                <View style={{ gap: spacing.sm }}>
                  {history.map((h) => (
                    <Card key={h.id} testID={`history-${h.id}`} onPress={() => setResult(h)} style={{ padding: spacing.md }}>
                      <AppText weight="semibold" numberOfLines={1}>{h.query}</AppText>
                      <AppText size="sm" muted style={{ marginTop: 2 }}>{dayjs(h.created_at).format("DD MMM YYYY")}</AppText>
                    </Card>
                  ))}
                </View>
              </>
            )
          )}
        </ScrollView>

        <View style={{ flexDirection: "row", alignItems: "center", padding: spacing.md, paddingBottom: insets.bottom + spacing.sm, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border }}>
          <View style={{ flex: 1, backgroundColor: colors.surfaceTertiary, borderRadius: radius.xl, paddingHorizontal: spacing.md, height: 44, justifyContent: "center" }}>
            <TextInput testID="research-input" value={q} onChangeText={setQ} placeholder="Research a topic" placeholderTextColor={colors.onSurfaceMuted} onSubmitEditing={() => research(q)} returnKeyType="search" style={{ color: colors.onSurface, fontSize: fontSize.lg }} />
          </View>
          <Pressable testID="research-submit" onPress={() => research(q)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginLeft: 6 }}>
            <Icon name="arrow-up" size={22} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
