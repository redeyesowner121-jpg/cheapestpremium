import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';

interface InlineEditProps {
  value: number;
  onSave: (value: number) => Promise<void>;
  prefix?: string;
  suffix?: string;
  type?: string;
  step?: string;
}

const InlineEdit: React.FC<InlineEditProps> = ({ 
  value, 
  onSave, 
  prefix = '', 
  suffix = '', 
  type = 'number', 
  step = '1' 
}) => {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value.toString());
  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = async () => {
    const numValue = parseFloat(localValue) || 0;
    if (numValue !== value) {
      await onSave(numValue);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setLocalValue(value.toString());
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        type={type}
        step={step}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="h-7 w-20 text-right text-sm"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="px-2 py-1 rounded hover:bg-muted transition-colors text-sm font-medium"
    >
      {prefix}{value.toLocaleString()}{suffix}
    </button>
  );
};

export default InlineEdit;
