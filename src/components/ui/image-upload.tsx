import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  className?: string;
  previewHeight?: string;
  useStorage?: boolean;
  bucket?: string;
  folder?: string;
  maxSizeMB?: number;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  value,
  onChange,
  placeholder = 'Enter image URL or drag & drop',
  className,
  previewHeight = 'h-40',
  useStorage = false,
  bucket = 'product-images',
  folder = 'products',
  maxSizeMB = 5
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const compressImage = async (file: File): Promise<Blob> => {
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
          (blob) => blob ? resolve(blob) : reject(new Error('Failed to compress')),
          'image/jpeg',
          0.85
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const uploadToStorage = async (file: File): Promise<string> => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      throw new Error(`File size must be less than ${maxSizeMB}MB`);
    }

    let uploadFile: File | Blob = file;
    
    // Compress if larger than 1MB
    if (file.size > 1024 * 1024) {
      uploadFile = await compressImage(file);
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, uploadFile, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    // Handle dropped URL text
    const text = e.dataTransfer.getData('text/plain');
    if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
      onChange(text);
      setPreviewError(false);
      return;
    }

    // Handle dropped files
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        if (useStorage) {
          setUploading(true);
          try {
            const url = await uploadToStorage(file);
            onChange(url);
            toast.success('Image uploaded successfully!');
          } catch (error: any) {
            toast.error(error.message || 'Failed to upload');
          } finally {
            setUploading(false);
          }
        } else {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              onChange(event.target.result as string);
              setPreviewError(false);
            }
          };
          reader.readAsDataURL(file);
        }
      }
    }
  }, [onChange, useStorage, bucket, folder]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    if (useStorage) {
      setUploading(true);
      try {
        const url = await uploadToStorage(file);
        onChange(url);
        setPreviewError(false);
        toast.success('Image uploaded successfully!');
      } catch (error: any) {
        toast.error(error.message || 'Failed to upload');
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onChange(event.target.result as string);
          setPreviewError(false);
        }
      };
      reader.readAsDataURL(file);
    }
  }, [onChange, useStorage, bucket, folder]);

  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setPreviewError(false);
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange('');
    setPreviewError(false);
  }, [onChange]);

  return (
    <div className={cn('space-y-3', className)}>
      {/* URL Input */}
      <div className="relative">
        <Input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={handleUrlChange}
          className="pr-10"
          disabled={uploading}
        />
        {value && !uploading && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Drop Zone / Preview */}
      <motion.div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={cn(
          'relative rounded-xl border-2 border-dashed cursor-pointer transition-all overflow-hidden',
          previewHeight,
          isDragging 
            ? 'border-primary bg-primary/5 scale-[1.02]' 
            : 'border-border hover:border-primary/50 hover:bg-muted/50',
          value && !previewError && 'border-solid border-primary/30',
          uploading && 'pointer-events-none opacity-70'
        )}
        animate={{ scale: isDragging ? 1.02 : 1 }}
        transition={{ duration: 0.2 }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />

        <AnimatePresence mode="wait">
          {uploading ? (
            <motion.div
              key="uploading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2"
            >
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-xs text-muted-foreground">Uploading...</p>
            </motion.div>
          ) : value && !previewError ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
            >
              <img
                src={value}
                alt="Preview"
                className="w-full h-full object-cover"
                onError={() => setPreviewError(true)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 hover:opacity-100 transition-opacity">
                <div className="absolute bottom-2 left-2 right-2 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="flex-1 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      inputRef.current?.click();
                    }}
                  >
                    <Upload className="w-3 h-3 mr-1" />
                    Change
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClear();
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground"
            >
              <motion.div
                animate={{ 
                  scale: isDragging ? 1.2 : 1,
                  rotate: isDragging ? 5 : 0
                }}
                transition={{ duration: 0.2 }}
              >
                {isDragging ? (
                  <Upload className="w-8 h-8 text-primary" />
                ) : (
                  <ImageIcon className="w-8 h-8" />
                )}
              </motion.div>
              <p className="text-xs text-center px-4">
                {isDragging ? 'Drop image here' : useStorage ? 'Click or drag to upload' : 'Click or drag image here'}
              </p>
              {useStorage && (
                <p className="text-[10px] text-muted-foreground/70">Max {maxSizeMB}MB, auto-optimized</p>
              )}
              {previewError && (
                <p className="text-xs text-destructive">
                  Failed to load image
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default ImageUpload;
