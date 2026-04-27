import React from 'react';
import { motion } from 'framer-motion';
import { Upload, Image as ImageIcon } from 'lucide-react';

interface Props {
  isDragging: boolean;
  useStorage?: boolean;
  maxSizeMB: number;
  previewError: boolean;
}

export const ImagePlaceholder: React.FC<Props> = ({ isDragging, useStorage, maxSizeMB, previewError }) => (
  <motion.div
    key="placeholder"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground"
  >
    <motion.div
      animate={{ scale: isDragging ? 1.2 : 1, rotate: isDragging ? 5 : 0 }}
      transition={{ duration: 0.2 }}
    >
      {isDragging ? <Upload className="w-8 h-8 text-primary" /> : <ImageIcon className="w-8 h-8" />}
    </motion.div>
    <p className="text-xs text-center px-4">
      {isDragging ? 'Drop image here' : useStorage ? 'Click or drag to upload' : 'Click or drag image here'}
    </p>
    {useStorage && <p className="text-[10px] text-muted-foreground/70">Max {maxSizeMB}MB, auto-optimized</p>}
    {previewError && <p className="text-xs text-destructive">Failed to load image</p>}
  </motion.div>
);
