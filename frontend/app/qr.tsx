import { useEffect, useState } from "react";
import { View, ScrollView, Pressable, Share, Platform } from "react-native";
import { useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { useTheme, spacing, radius } from "@/src/theme";
import { AppText, Avatar, Icon, Button, Loading, useToast } from "@/src/ui";
import { StackHeader } from "@/src/Header";
import { api } from "@/src/api";

export default function MyQR() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setData(await api.get("/me/qr")); }
      catch { toast.show("Could not load your QR code", "error"); }
      finally { setLoading(false); }
    })();
  }, []);

  const share = async () => {
    if (!data?.payload) return;
    try {
      await Share.share({ message: `Add me on Chatly: ${data.payload}` });
    } catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StackHeader title="My QR Code" />
      {loading ? <Loading /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, alignItems: "center" }}>
          <Avatar name={data?.user?.name} uri={data?.user?.avatar} size={84} />
          <AppText size="xxl" weight="heavy" style={{ marginTop: spacing.md }}>{data?.user?.name}</AppText>
          <AppText muted>@{data?.user?.username}</AppText>

          <View style={{ backgroundColor: "#fff", padding: spacing.xl, borderRadius: radius.xl, marginTop: spacing.xl, borderWidth: 1, borderColor: colors.border }} testID="qr-code-box">
            {data?.payload ? (
              <QRCode value={data.payload} size={230} color="#111" backgroundColor="#fff" />
            ) : null}
          </View>
          <AppText muted center size="base" style={{ marginTop: spacing.lg, maxWidth: 300 }}>
            Let others scan this code to add you on Chatly. Your code is unique to your account.
          </AppText>

          <View style={{ height: spacing.xl }} />
          <Button testID="share-qr" title="Share My Code" icon="share-outline" onPress={share} />
          <Pressable testID="open-scanner" onPress={() => router.push("/scan")} style={{ marginTop: spacing.lg, flexDirection: "row", alignItems: "center" }}>
            <Icon name="scan-outline" size={18} color={colors.brandPrimary} />
            <AppText weight="bold" color={colors.brandPrimary} style={{ marginLeft: 8 }}>Scan a code</AppText>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}
