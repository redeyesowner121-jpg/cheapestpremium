import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Image as ImageIcon, Loader2, Plus, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  maxSizeMB = 5
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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

    const fileExt = file.name.split('.').pop() || 'jpg';
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

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    const remainingSlots = maxImages - values.length;
    const filesToUpload = imageFiles.slice(0, remainingSlots);

    if (filesToUpload.length === 0) {
      if (imageFiles.length > 0) {
        toast.error(`Maximum ${maxImages} images allowed`);
      }
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    const newUrls: string[] = [];

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const url = await uploadToStorage(filesToUpload[i]);
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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  }, [handleFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  }, [handleFiles]);

  const removeImage = useCallback((index: number) => {
    const newValues = values.filter((_, i) => i !== index);
    onChange(newValues);
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
      {/* Image Grid */}
      <div className="grid grid-cols-3 gap-2">
        <AnimatePresence mode="popLayout">
          {values.map((url, index) => (
            <motion.div
              key={url}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={cn(
                'relative aspect-square rounded-xl overflow-hidden border-2 group cursor-pointer',
                index === 0 ? 'border-primary' : 'border-border'
              )}
              onClick={() => setAsPrimary(index)}
            >
              <img
                src={url}
                alt={`Product ${index + 1}`}
                className="w-full h-full object-cover"
              />
              
              {/* Primary badge */}
              {index === 0 && (
                <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                  Primary
                </div>
              )}
              
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {index !== 0 && (
                  <button
                    type="button"
                    className="p-1.5 bg-white/20 rounded-full hover:bg-white/40 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAsPrimary(index);
                    }}
                  >
                    <GripVertical className="w-3 h-3 text-white" />
                  </button>
                )}
                <button
                  type="button"
                  className="p-1.5 bg-destructive/80 rounded-full hover:bg-destructive transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(index);
                  }}
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            </motion.div>
          ))}

          {/* Add More Button */}
          {canAddMore && !uploading && (
            <motion.div
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={cn(
                'aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all',
                isDragging 
                  ? 'border-primary bg-primary/10' 
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
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

          {/* Uploading indicator */}
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

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      {/* Drop zone for empty state */}
      {values.length === 0 && !uploading && (
        <motion.div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'h-32 rounded-xl border-2 border-dashed cursor-pointer transition-all flex flex-col items-center justify-center gap-2',
            isDragging 
              ? 'border-primary bg-primary/10' 
              : 'border-border hover:border-primary/50 hover:bg-muted/50'
          )}
        >
          <motion.div
            animate={{ 
              scale: isDragging ? 1.2 : 1,
              rotate: isDragging ? 5 : 0
            }}
          >
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

      {/* Info text */}
      {values.length > 0 && (
        <p className="text-[10px] text-muted-foreground text-center">
          {values.length}/{maxImages} images • Click image to set as primary
        </p>
      )}
    </div>
  );
};

export default MultiImageUpload;