import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { EscrowDeal } from './escrow/types';
import EscrowList from './escrow/EscrowList';
import CreateEscrowForm from './escrow/CreateEscrowForm';
import EscrowDealDetail from './escrow/EscrowDealDetail';

const EscrowPage: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { dealId } = useParams<{ dealId?: string }>();

  const [deals, setDeals] = useState<EscrowDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'create'>('list');
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('active');

  const userId = user?.id;
  const walletBalance = Number(profile?.wallet_balance || 0);

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from('escrow_deals').select('*')
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order('created_at', { ascending: false }).limit(100);
    setDeals((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [userId]);

  // Realtime list updates
  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel('escrow-page-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'escrow_deals' },
        (p: any) => {
          const row = p.new || p.old;
          if (row && (row.buyer_id === userId || row.seller_id === userId)) load();
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-muted-foreground mb-3">Please sign in to use Escrow.</p>
          <button onClick={() => navigate('/auth')} className="text-primary underline text-sm">Sign in</button>
        </div>
      </div>
    );
  }

  // Detail route /escrow/:dealId
  if (dealId) {
    return (
      <div className="min-h-screen bg-background p-4 pb-24">
        <EscrowDealDetail
          dealId={dealId}
          userId={userId}
          onBack={() => navigate('/escrow')}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      {view === 'create' ? (
        <CreateEscrowForm
          userId={userId}
          walletBalance={walletBalance}
          onBack={() => setView('list')}
          onCreated={() => { setView('list'); load(); }}
        />
      ) : (
        <EscrowList
          userId={userId}
          deals={deals}
          loading={loading}
          filter={filter}
          setFilter={setFilter}
          onCreate={() => setView('create')}
          onOpenDeal={(d) => navigate(`/escrow/${d.id}`)}
        />
      )}
    </div>
  );
};

export default EscrowPage;
