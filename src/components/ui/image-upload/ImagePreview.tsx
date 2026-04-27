import React from 'react';
import { motion } from 'framer-motion';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onPickFile: () => void;
  setPreviewError: (b: boolean) => void;
}

export const ImagePreview: React.FC<Props> = ({ value, onChange, onPickFile, setPreviewError }) => (
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
          onClick={(e) => { e.stopPropagation(); onPickFile(); }}
        >
          <Upload className="w-3 h-3 mr-1" />
          Change
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          className="text-xs"
          onClick={(e) => { e.stopPropagation(); onChange(''); setPreviewError(false); }}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>
  </motion.div>
);
