import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { storage } from "@/src/utils/storage";
import { TOKEN_KEY } from "@/src/api";

const BASE = (process.env.EXPO_PUBLIC_BACKEND_URL || "") + "/api";

export function fileUrl(storagePath: string, token: string) {
  return `${BASE}/files/${storagePath}?token=${encodeURIComponent(token)}`;
}

async function buildFormPart(form: FormData, field: string, uri: string, name: string, type: string) {
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    form.append(field, blob, name);
  } else {
    form.append(field, { uri, name, type } as any);
  }
}

async function postForm(path: string, form: FormData) {
  const token = await storage.secureGet<string>(TOKEN_KEY, "");
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { detail: text }; }
  if (!res.ok) throw new Error(data?.detail || "Upload failed");
  return data;
}

export async function pickImageFromLibrary() {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error("permission-denied");
  return ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
}

export async function captureImage() {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error("permission-denied");
  return ImagePicker.launchCameraAsync({ quality: 0.7 });
}

export async function pickDocument() {
  return DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
}

export async function uploadImage(chatId: string, asset: any, caption = "") {
  const form = new FormData();
  await buildFormPart(form, "file", asset.uri, asset.fileName || `photo_${Date.now()}.jpg`, asset.mimeType || "image/jpeg");
  form.append("caption", caption);
  return postForm(`/chats/${chatId}/attachments`, form);
}

export async function uploadDocument(chatId: string, doc: any, caption = "") {
  const form = new FormData();
  await buildFormPart(form, "file", doc.uri, doc.name || `file_${Date.now()}`, doc.mimeType || "application/octet-stream");
  form.append("caption", caption);
  return postForm(`/chats/${chatId}/attachments`, form);
}

export async function uploadVoice(chatId: string, uri: string, duration: number) {
  const form = new FormData();
  const name = Platform.OS === "web" ? `voice_${Date.now()}.webm` : `voice_${Date.now()}.m4a`;
  const type = Platform.OS === "web" ? "audio/webm" : "audio/m4a";
  await buildFormPart(form, "file", uri, name, type);
  form.append("duration", String(Math.round(duration)));
  form.append("language", "en");
  return postForm(`/chats/${chatId}/voice`, form);
}
