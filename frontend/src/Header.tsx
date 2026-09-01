import React from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, spacing } from "@/src/theme";
import { AppText, Icon } from "@/src/ui";

export function StackHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={{ paddingTop: insets.top + 6, paddingBottom: spacing.sm, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Pressable testID="header-back" onPress={() => router.back()} hitSlop={10} style={{ marginRight: 6 }}>
        <Icon name="chevron-back" size={28} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <AppText weight="bold" size="xl" numberOfLines={1}>{title}</AppText>
        {subtitle ? <AppText size="sm" muted numberOfLines={1}>{subtitle}</AppText> : null}
      </View>
      {right}
    </View>
  );
}
