export async function fetchTelegramAvatar(botToken: string, telegramId: number): Promise<string | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getUserProfilePhotos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: telegramId, limit: 1 }),
    });
    const data = await res.json();
    if (!data?.result?.photos?.length) return null;

    const photos = data.result.photos[0];
    const fileId = photos[photos.length - 1].file_id;

    const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId }),
    });
    const fileData = await fileRes.json();
    if (!fileData?.result?.file_path) return null;

    return `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
  } catch (e) {
    console.error("fetchTelegramAvatar error:", e);
    return null;
  }
}

export async function downloadAndUploadAvatar(
  supabase: any,
  photoUrl: string,
  userId: string
): Promise<string | null> {
  try {
    const response = await fetch(photoUrl);
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const filePath = `avatars/${userId}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(filePath, uint8Array, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("Avatar upload error:", uploadError);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("product-images")
      .getPublicUrl(filePath);

    return urlData?.publicUrl || null;
  } catch (e) {
    console.error("downloadAndUploadAvatar error:", e);
    return null;
  }
}
