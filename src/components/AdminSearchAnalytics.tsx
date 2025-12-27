import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SearchTerm {
  term: string;
  count: number;
  avg_results: number;
}

const AdminSearchAnalytics: React.FC = () => {
  const [topSearches, setTopSearches] = useState<SearchTerm[]>([]);
  const [totalSearches, setTotalSearches] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSearchAnalytics();
  }, []);

  const loadSearchAnalytics = async () => {
    setLoading(true);

    // Get total searches count
    const { count } = await supabase
      .from('search_logs')
      .select('*', { count: 'exact', head: true });
    
    setTotalSearches(count || 0);

    // Get all search logs and aggregate on client side
    const { data: searchLogs } = await supabase
      .from('search_logs')
      .select('search_term, results_count')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (searchLogs && searchLogs.length > 0) {
      // Aggregate search terms
      const termMap: Record<string, { count: number; totalResults: number }> = {};
      
      searchLogs.forEach(log => {
        const term = log.search_term.toLowerCase();
        if (!termMap[term]) {
          termMap[term] = { count: 0, totalResults: 0 };
        }
        termMap[term].count++;
        termMap[term].totalResults += log.results_count || 0;
      });

      // Convert to array and sort by count
      const sortedTerms = Object.entries(termMap)
        .map(([term, data]) => ({
          term,
          count: data.count,
          avg_results: Math.round(data.totalResults / data.count)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setTopSearches(sortedTerms);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="bg-card rounded-2xl p-4 shadow-card">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-muted rounded w-1/3"></div>
          <div className="h-4 bg-muted rounded w-full"></div>
          <div className="h-4 bg-muted rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  const maxCount = topSearches.length > 0 ? topSearches[0].count : 1;

  return (
    <div className="bg-card rounded-2xl p-4 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Search className="w-5 h-5 text-primary" />
          Search Analytics
        </h3>
        <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
          {totalSearches} total searches
        </span>
      </div>

      {topSearches.length === 0 ? (
        <div className="text-center py-6">
          <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No search data yet</p>
          <p className="text-xs text-muted-foreground">Users haven't searched for products</p>
        </div>
      ) : (
        <div className="space-y-3">
          {topSearches.map((item, index) => (
            <div key={item.term} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                    index === 0 ? 'bg-primary text-primary-foreground' :
                    index === 1 ? 'bg-secondary text-secondary-foreground' :
                    index === 2 ? 'bg-accent text-accent-foreground' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {index + 1}
                  </span>
                  <span className="font-medium text-sm text-foreground">"{item.term}"</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{item.count} searches</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    item.avg_results > 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                  }`}>
                    {item.avg_results} results
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${(item.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {topSearches.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="w-3 h-3" />
            <span>Showing top 10 most searched terms</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSearchAnalytics;
