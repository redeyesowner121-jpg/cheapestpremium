import React, { useRef, useState } from 'react';
import { Plus, FolderOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCategoryActions } from './category-manager/useCategoryActions';
import CategoryRow from './category-manager/CategoryRow';

interface AdminCategoryManagerProps {
  products: any[];
  onCategoryChange: () => void;
}

const AdminCategoryManager: React.FC<AdminCategoryManagerProps> = ({ products, onCategoryChange }) => {
  const { categories, loading, saving, addCategory, renameCategory, deleteCategory, toggleActive, uploadIcon } =
    useCategoryActions(products, onCategoryChange);
  const [newCategory, setNewCategory] = useState('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const pendingUploadId = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAdd = async () => {
    const ok = await addCategory(newCategory);
    if (ok) setNewCategory('');
  };

  if (loading) {
    return (
      <div className="bg-card rounded-2xl p-4 shadow-card mb-4">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl p-4 shadow-card mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-primary" />
          Categories ({categories.length})
        </h3>
      </div>

      <div className="flex gap-2 mb-4">
        <Input placeholder="New category name..." value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          className="flex-1 h-10 rounded-xl"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          disabled={saving} />
        <Button onClick={handleAdd} size="sm" className="h-10 px-4" disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
          Add
        </Button>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {categories.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-4">No categories yet. Add your first category!</p>
        ) : (
          categories.map((category) => (
            <CategoryRow
              key={category.id}
              category={category}
              saving={saving}
              uploadingId={uploadingId}
              onRename={renameCategory}
              onDelete={deleteCategory}
              onToggle={toggleActive}
              onIconClick={(id) => {
                pendingUploadId.current = id;
                fileInputRef.current?.click();
              }}
            />
          ))
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          const targetId = pendingUploadId.current;
          if (file && targetId) {
            setUploadingId(targetId);
            await uploadIcon(targetId, file);
            setUploadingId(null);
          }
          pendingUploadId.current = null;
          e.target.value = '';
        }} />
    </div>
  );
};

export default AdminCategoryManager;
