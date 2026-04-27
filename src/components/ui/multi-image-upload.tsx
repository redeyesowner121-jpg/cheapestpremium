import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Image as ImageIcon, Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { uploadToStorage } from './image-upload/image-utils';
import { ImageGridItem } from './image-upload/ImageGridItem';

interface MultiImageUploadProps {
  values: string[];
  onChange: (urls: string[]) => void;
  maxImages?: number;
  className?: string;
  bucket?: string;
  folder?: string;
  maxSizeMB?: number;
}

const MultiImageUpload: React.FC<MultiImageUploadProps> = ({
  values = [],
  onChange,
  maxImages = 5,
  className,
  bucket = 'product-images',
  folder = 'products',
  maxSizeMB = 5,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    const remainingSlots = maxImages - values.length;
    const filesToUpload = imageFiles.slice(0, remainingSlots);

    if (filesToUpload.length === 0) {
      if (imageFiles.length > 0) toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    const newUrls: string[] = [];

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const url = await uploadToStorage(filesToUpload[i], { bucket, folder, maxSizeMB });
        newUrls.push(url);
        setUploadProgress(((i + 1) / filesToUpload.length) * 100);
      }
      onChange([...values, ...newUrls]);
      toast.success(`${newUrls.length} image${newUrls.length > 1 ? 's' : ''} uploaded!`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [values, onChange, maxImages, bucket, folder, maxSizeMB]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) handleFiles(e.target.files);
  }, [handleFiles]);

  const removeImage = useCallback((index: number) => {
    onChange(values.filter((_, i) => i !== index));
  }, [values, onChange]);

  const setAsPrimary = useCallback((index: number) => {
    if (index === 0) return;
    const newValues = [...values];
    const [removed] = newValues.splice(index, 1);
    newValues.unshift(removed);
    onChange(newValues);
    toast.success('Set as primary image');
  }, [values, onChange]);

  const canAddMore = values.length < maxImages;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid grid-cols-3 gap-2">
        <AnimatePresence mode="popLayout">
          {values.map((url, index) => (
            <ImageGridItem key={url} url={url} index={index} onSetPrimary={setAsPrimary} onRemove={removeImage} />
          ))}

          {canAddMore && !uploading && (
            <motion.div
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={cn(
                'aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all',
                isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50 hover:bg-muted/50'
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
            >
              <Plus className="w-6 h-6 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground mt-1">Add</span>
            </motion.div>
          )}

          {uploading && (
            <motion.div
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="aspect-square rounded-xl border-2 border-primary bg-primary/5 flex flex-col items-center justify-center"
            >
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <span className="text-[10px] text-primary mt-1">{Math.round(uploadProgress)}%</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      {values.length === 0 && !uploading && (
        <motion.div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'h-32 rounded-xl border-2 border-dashed cursor-pointer transition-all flex flex-col items-center justify-center gap-2',
            isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50 hover:bg-muted/50'
          )}
        >
          <motion.div animate={{ scale: isDragging ? 1.2 : 1, rotate: isDragging ? 5 : 0 }}>
            {isDragging ? (
              <Upload className="w-8 h-8 text-primary" />
            ) : (
              <ImageIcon className="w-8 h-8 text-muted-foreground" />
            )}
          </motion.div>
          <p className="text-xs text-muted-foreground">
            {isDragging ? 'Drop images here' : 'Click or drag to upload images'}
          </p>
          <p className="text-[10px] text-muted-foreground/70">
            Up to {maxImages} images, max {maxSizeMB}MB each
          </p>
        </motion.div>
      )}

      {values.length > 0 && (
        <p className="text-[10px] text-muted-foreground text-center">
          {values.length}/{maxImages} images • Click image to set as primary
        </p>
      )}
    </div>
  );
};

export default MultiImageUpload;
