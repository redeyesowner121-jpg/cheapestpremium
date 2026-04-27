import React, { useState } from 'react';
import { Edit, Trash2, Check, X, GripVertical, Loader2, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Category } from './useCategoryActions';

interface Props {
  category: Category;
  saving: boolean;
  uploadingId: string | null;
  onRename: (id: string, name: string) => void;
  onDelete: (c: Category) => void;
  onToggle: (c: Category) => void;
  onIconClick: (id: string) => void;
}

const CategoryRow: React.FC<Props> = ({ category, saving, uploadingId, onRename, onDelete, onToggle, onIconClick }) => {
  const [editing, setEditing] = useState(false);
  const [editedName, setEditedName] = useState(category.name);

  const submit = () => {
    if (!editedName.trim()) return;
    onRename(category.id, editedName);
    setEditing(false);
  };

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl group transition-colors ${category.is_active ? 'bg-muted' : 'bg-muted/50 opacity-60'}`}>
      {editing ? (
        <>
          <Input value={editedName} onChange={(e) => setEditedName(e.target.value)}
            className="flex-1 h-8 text-sm" autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') setEditing(false);
            }}
            disabled={saving} />
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={submit} disabled={saving}>
            <Check className="w-4 h-4 text-success" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(false)}>
            <X className="w-4 h-4 text-destructive" />
          </Button>
        </>
      ) : (
        <>
          <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
          <button onClick={() => onIconClick(category.id)}
            className="relative w-10 h-10 rounded-lg bg-muted/50 border border-dashed border-border flex items-center justify-center overflow-hidden hover:border-primary transition-colors flex-shrink-0"
            title="Click to change icon">
            {uploadingId === category.id ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : category.icon_url ? (
              <img src={category.icon_url} alt="" className="w-full h-full object-cover rounded-lg" />
            ) : (
              <ImagePlus className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          <div className="flex-1">
            <p className="font-medium text-sm text-foreground">{category.name}</p>
            <p className="text-xs text-muted-foreground">{category.productCount || 0} product(s)</p>
          </div>
          <Switch checked={category.is_active ?? true} onCheckedChange={() => onToggle(category)} className="scale-75" />
          <Button size="icon" variant="ghost"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => { setEditedName(category.name); setEditing(true); }}>
            <Edit className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
            onClick={() => onDelete(category)} disabled={saving}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </>
      )}
    </div>
  );
};

export default CategoryRow;
