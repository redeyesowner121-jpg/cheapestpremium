import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { uploadToStorage } from './image-upload/image-utils';
import { ImagePreview } from './image-upload/ImagePreview';
import { ImagePlaceholder } from './image-upload/ImagePlaceholder';

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
  maxSizeMB = 5,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (useStorage) {
      setUploading(true);
      try {
        const url = await uploadToStorage(file, { bucket, folder, maxSizeMB });
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
      reader.onload = (e) => {
        if (e.target?.result) {
          onChange(e.target.result as string);
          setPreviewError(false);
        }
      };
      reader.readAsDataURL(file);
    }
  }, [onChange, useStorage, bucket, folder, maxSizeMB]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const text = e.dataTransfer.getData('text/plain');
    if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
      onChange(text);
      setPreviewError(false);
      return;
    }
    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
  }, [onChange, processFile]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
  }, [processFile]);

  const pickFile = useCallback(() => inputRef.current?.click(), []);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="relative">
        <Input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => { onChange(e.target.value); setPreviewError(false); }}
          className="pr-10"
          disabled={uploading}
        />
        {value && !uploading && (
          <button
            type="button"
            onClick={() => { onChange(''); setPreviewError(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <motion.div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && pickFile()}
        className={cn(
          'relative rounded-xl border-2 border-dashed cursor-pointer transition-all overflow-hidden',
          previewHeight,
          isDragging ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-border hover:border-primary/50 hover:bg-muted/50',
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
            <ImagePreview value={value} onChange={onChange} onPickFile={pickFile} setPreviewError={setPreviewError} />
          ) : (
            <ImagePlaceholder isDragging={isDragging} useStorage={useStorage} maxSizeMB={maxSizeMB} previewError={previewError} />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default ImageUpload;
