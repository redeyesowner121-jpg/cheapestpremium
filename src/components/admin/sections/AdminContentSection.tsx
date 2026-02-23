import React from 'react';
import { Image, Zap, Bell, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AdminContentSectionProps {
  banners: any[];
  flashSales: any[];
  onShowBannerModal: () => void;
  onShowFlashSaleModal: () => void;
  onShowAnnouncementModal: () => void;
  onDeleteBanner: (bannerId: string) => void;
  onToggleBanner: (bannerId: string, isActive: boolean) => void;
  onDeleteFlashSale: (saleId: string) => void;
}

const AdminContentSection: React.FC<AdminContentSectionProps> = ({
  banners,
  flashSales,
  onShowBannerModal,
  onShowFlashSaleModal,
  onShowAnnouncementModal,
  onDeleteBanner,
  onToggleBanner,
  onDeleteFlashSale,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={onShowBannerModal} variant="outline" className="flex-1 rounded-xl">
          <Image className="w-4 h-4 mr-2" />
          Add Banner
        </Button>
        <Button onClick={onShowFlashSaleModal} variant="outline" className="flex-1 rounded-xl">
          <Zap className="w-4 h-4 mr-2" />
          Add Flash Sale
        </Button>
        <Button onClick={onShowAnnouncementModal} variant="outline" className="flex-1 rounded-xl">
          <Bell className="w-4 h-4 mr-2" />
          Announce
        </Button>
      </div>

      {/* Banners */}
      <div>
        <h4 className="font-semibold text-foreground mb-2">Banners ({banners.length})</h4>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {banners.map((banner: any) => (
            <div key={banner.id} className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg">
              <img src={banner.image_url} alt="" className="w-16 h-10 rounded object-cover" />
              <p className="flex-1 text-sm font-medium truncate">{banner.title}</p>
              <Button size="sm" variant="ghost" onClick={() => onToggleBanner(banner.id, banner.is_active)}>
                {banner.is_active ? <CheckCircle className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-muted-foreground" />}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onDeleteBanner(banner.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Flash Sales */}
      <div>
        <h4 className="font-semibold text-foreground mb-2">Flash Sales ({flashSales.length})</h4>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {flashSales.map((sale: any) => (
            <div key={sale.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
              <div>
                <p className="text-sm font-medium">{sale.products?.name}</p>
                <p className="text-xs text-muted-foreground">₹{sale.sale_price}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => onDeleteFlashSale(sale.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminContentSection;
