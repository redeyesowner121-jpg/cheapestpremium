import React from 'react';
import { Image, Zap, Bell, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

interface AdminContentTabProps {
  banners: any[];
  flashSales: any[];
  announcements: any[];
  onShowBannerModal: () => void;
  onShowFlashSaleModal: () => void;
  onShowAnnouncementModal: () => void;
  onDeleteBanner: (id: string) => void;
  onToggleBanner: (id: string, isActive: boolean) => void;
  onDeleteFlashSale: (id: string) => void;
}

const AdminContentTab: React.FC<AdminContentTabProps> = ({
  banners,
  flashSales,
  announcements,
  onShowBannerModal,
  onShowFlashSaleModal,
  onShowAnnouncementModal,
  onDeleteBanner,
  onToggleBanner,
  onDeleteFlashSale
}) => {
  return (
    <div className="space-y-6">
      {/* Banners Section */}
      <div className="bg-card rounded-2xl p-4 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Image className="w-5 h-5 text-primary" />
            Banners
          </h3>
          <Button size="sm" onClick={onShowBannerModal}>
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>
        <div className="space-y-2">
          {banners.map((banner: any) => (
            <div key={banner.id} className="flex items-center gap-3 p-2 bg-muted rounded-xl">
              <img src={banner.image_url} alt="" className="w-24 h-12 rounded object-cover" />
              <div className="flex-1">
                <p className="text-sm font-medium">{banner.title}</p>
                {banner.link && <p className="text-xs text-muted-foreground truncate">{banner.link}</p>}
              </div>
              <Switch 
                checked={banner.is_active} 
                onCheckedChange={() => onToggleBanner(banner.id, banner.is_active)}
              />
              <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => onDeleteBanner(banner.id)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
          {banners.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-4">No banners yet</p>
          )}
        </div>
      </div>
      
      {/* Flash Sales Section */}
      <div className="bg-card rounded-2xl p-4 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Zap className="w-5 h-5 text-accent" />
            Flash Sales
          </h3>
          <Button size="sm" onClick={onShowFlashSaleModal}>
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>
        <div className="space-y-2">
          {flashSales.map((sale: any) => (
            <div key={sale.id} className="flex items-center gap-3 p-2 bg-muted rounded-xl">
              <img src={sale.products?.image_url || 'https://via.placeholder.com/50'} alt="" className="w-12 h-12 rounded object-cover" />
              <div className="flex-1">
                <p className="text-sm font-medium">{sale.products?.name}</p>
                <p className="text-xs text-success font-bold">₹{sale.sale_price}</p>
                <p className="text-[10px] text-muted-foreground">
                  Ends: {new Date(sale.end_time).toLocaleString()}
                </p>
              </div>
              <Switch checked={sale.is_active} />
              <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => onDeleteFlashSale(sale.id)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
          {flashSales.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-4">No flash sales yet</p>
          )}
        </div>
      </div>
      
      {/* Announcements Section */}
      <div className="bg-card rounded-2xl p-4 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Bell className="w-5 h-5 text-secondary" />
            Announcements
          </h3>
          <Button size="sm" onClick={onShowAnnouncementModal}>
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>
        <div className="space-y-2">
          {announcements.map((ann: any) => (
            <div key={ann.id} className="p-3 bg-muted rounded-xl">
              <p className="font-medium text-sm">{ann.title}</p>
              <p className="text-xs text-muted-foreground">{ann.message}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {new Date(ann.created_at).toLocaleString()}
              </p>
            </div>
          ))}
          {announcements.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-4">No announcements yet</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminContentTab;
