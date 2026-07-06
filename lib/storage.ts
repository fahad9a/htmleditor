import type { SupabaseClient } from "@supabase/supabase-js";

// Upload an image to the public "report-images" bucket and return its public
// URL. Storage URLs keep patches tiny — a data URL for a 2MB photo would
// bloat the patch log and exceed the Realtime broadcast payload limit.
export async function uploadImage(
  supabase: SupabaseClient,
  docId: string,
  file: File
): Promise<{ url: string } | { error: string }> {
  if (!file.type.startsWith("image/")) return { error: "Please choose an image file." };
  if (file.size > 10 * 1024 * 1024) return { error: "Image is too large (max 10 MB)." };

  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${docId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from("report-images").upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type,
  });
  if (error) return { error: error.message };

  const { data } = supabase.storage.from("report-images").getPublicUrl(path);
  return { url: data.publicUrl };
}
