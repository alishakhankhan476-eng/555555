import type { Colors } from "@/src/theme";

export type ChatTheme = {
  preset: string;
  label?: string;
  bg?: string | null;
  bubbleOut?: string;
  onBubbleOut?: string;
  bubbleIn?: string;
  onBubbleIn?: string;
  accent?: string;
};

// Backgrounds + bubble palettes. "default" follows the app theme.
export const CHAT_THEME_PRESETS: ChatTheme[] = [
  { preset: "default", label: "Default" },
  { preset: "sunset", label: "Sunset", bg: "#2b1055", bubbleOut: "#FF5E00", onBubbleOut: "#ffffff", bubbleIn: "rgba(255,255,255,0.12)", onBubbleIn: "#F5F6F8", accent: "#FF8C42" },
  { preset: "ocean", label: "Ocean", bg: "#0f2027", bubbleOut: "#2E86DE", onBubbleOut: "#ffffff", bubbleIn: "rgba(255,255,255,0.12)", onBubbleIn: "#EAF2FB", accent: "#54a0ff" },
  { preset: "forest", label: "Forest", bg: "#132a13", bubbleOut: "#31A24C", onBubbleOut: "#ffffff", bubbleIn: "rgba(255,255,255,0.12)", onBubbleIn: "#EAF7EA", accent: "#4ade80" },
  { preset: "rose", label: "Rose", bg: "#2d0a1f", bubbleOut: "#E84393", onBubbleOut: "#ffffff", bubbleIn: "rgba(255,255,255,0.12)", onBubbleIn: "#FBEAF3", accent: "#fd79a8" },
  { preset: "midnight", label: "Midnight", bg: "#0b1020", bubbleOut: "#5B6CFF", onBubbleOut: "#ffffff", bubbleIn: "rgba(255,255,255,0.1)", onBubbleIn: "#E7E9FF", accent: "#8E9BFF" },
  { preset: "paper", label: "Paper", bg: "#ECE5DD", bubbleOut: "#DCF8C6", onBubbleOut: "#111111", bubbleIn: "#ffffff", onBubbleIn: "#111111", accent: "#25D366" },
];

export const ACCENTS = ["#FF5E00", "#2E86DE", "#31A24C", "#E84393", "#8E44AD", "#F1C40F", "#E74C3C", "#1ABC9C"];

export type ResolvedChatTheme = {
  bg: string;
  bubbleOut: string;
  onBubbleOut: string;
  bubbleIn: string;
  onBubbleIn: string;
  accent: string;
  custom: boolean;
};

export function resolveChatTheme(theme: ChatTheme | null | undefined, colors: Colors): ResolvedChatTheme {
  if (!theme || !theme.preset || theme.preset === "default") {
    return {
      bg: colors.surface,
      bubbleOut: colors.bubbleOut,
      onBubbleOut: colors.onBubbleOut,
      bubbleIn: colors.bubbleIn,
      onBubbleIn: colors.onCard,
      accent: theme?.accent || colors.brandPrimary,
      custom: false,
    };
  }
  return {
    bg: theme.bg || colors.surface,
    bubbleOut: theme.bubbleOut || colors.bubbleOut,
    onBubbleOut: theme.onBubbleOut || "#ffffff",
    bubbleIn: theme.bubbleIn || "rgba(255,255,255,0.12)",
    onBubbleIn: theme.onBubbleIn || "#F5F6F8",
    accent: theme.accent || theme.bubbleOut || colors.brandPrimary,
    custom: true,
  };
}
