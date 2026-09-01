import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useColorScheme } from "react-native";
import { storage } from "@/src/utils/storage";

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 6, md: 12, lg: 16, xl: 24, pill: 9999 };
export const fontSize = { xs: 11, sm: 12, base: 14, md: 15, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

const light = {
  surface: "#F5F6F8",
  onSurface: "#1C1C1E",
  onSurfaceMuted: "#8E8E93",
  card: "#FFFFFF",
  onCard: "#1C1C1E",
  surfaceTertiary: "#EAECEF",
  inverse: "#1C1C1E",
  onInverse: "#FFFFFF",
  brand: "#FF6600",
  brandPrimary: "#FF5E00",
  onBrand: "#FFFFFF",
  brandSecondary: "#FF8C42",
  brandTertiary: "#FFF0E6",
  onBrandTertiary: "#FF5E00",
  success: "#34C759",
  warning: "#FF9F0A",
  error: "#FF3B30",
  border: "#E5E5EA",
  borderStrong: "#D1D1D6",
  divider: "#E5E5EA",
  bubbleIn: "#FFFFFF",
  bubbleOut: "#FF5E00",
  onBubbleOut: "#FFFFFF",
  overlay: "rgba(0,0,0,0.4)",
};

const dark = {
  surface: "#121214",
  onSurface: "#F5F6F8",
  onSurfaceMuted: "#8E8E93",
  card: "#1C1C1E",
  onCard: "#FFFFFF",
  surfaceTertiary: "#2C2C2E",
  inverse: "#FFFFFF",
  onInverse: "#1C1C1E",
  brand: "#FF6600",
  brandPrimary: "#FF5E00",
  onBrand: "#FFFFFF",
  brandSecondary: "#FF8C42",
  brandTertiary: "#3A1E0D",
  onBrandTertiary: "#FF8C42",
  success: "#32D74B",
  warning: "#FFD60A",
  error: "#FF453A",
  border: "#2C2C2E",
  borderStrong: "#3A3A3C",
  divider: "#2C2C2E",
  bubbleIn: "#1C1C1E",
  bubbleOut: "#FF5E00",
  onBubbleOut: "#FFFFFF",
  overlay: "rgba(0,0,0,0.6)",
};

export type Colors = typeof light;
export type ThemeMode = "light" | "dark" | "system";

type Ctx = {
  colors: Colors;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
};

const ThemeContext = createContext<Ctx>({
  colors: light,
  isDark: false,
  mode: "system",
  setMode: () => {},
});

const KEY = "chatly_theme_mode";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    storage.getItem<ThemeMode>(KEY, "system").then((m) => m && setModeState(m as ThemeMode));
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    storage.setItem(KEY, m);
  }, []);

  const isDark = mode === "system" ? system === "dark" : mode === "dark";
  const colors = isDark ? dark : light;

  return (
    <ThemeContext.Provider value={{ colors, isDark, mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
