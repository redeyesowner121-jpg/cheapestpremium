import { supabase } from '@/integrations/supabase/client';

export const compressImage = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      const maxWidth = 1200;
      const maxHeight = 1200;
      let { width, height } = img;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Failed to compress'))),
        'image/jpeg',
        0.85
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

export interface UploadOptions {
  bucket: string;
  folder: string;
  maxSizeMB: number;
}

export const uploadToStorage = async (file: File, opts: UploadOptions): Promise<string> => {
  if (file.size > opts.maxSizeMB * 1024 * 1024) {
    throw new Error(`File size must be less than ${opts.maxSizeMB}MB`);
  }

  let uploadFile: File | Blob = file;
  if (file.size > 1024 * 1024) {
    uploadFile = await compressImage(file);
  }

  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `${opts.folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from(opts.bucket)
    .upload(fileName, uploadFile, { cacheControl: '3600', upsert: false });

  if (error) throw error;

  const { data: urlData } = supabase.storage.from(opts.bucket).getPublicUrl(data.path);
  return urlData.publicUrl;
};
