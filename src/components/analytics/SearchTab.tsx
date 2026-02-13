import React, { useState, useEffect, useMemo } from 'react';
import { Search, TrendingUp, BarChart3, Clock, Users, AlertCircle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';

interface SearchTerm {
  term: string;
  count: number;
  avg_results: number;
}

const SearchTab: React.FC = () => {
  const [topSearches, setTopSearches] = useState<SearchTerm[]>([]);
  const [totalSearches, setTotalSearches] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchLogs, setSearchLogs] = useState<any[]>([]);

  useEffect(() => {
    loadSearchAnalytics();
  }, []);

  const loadSearchAnalytics = async () => {
    setLoading(true);
    const { count } = await supabase.from('search_logs').select('*', { count: 'exact', head: true });
    setTotalSearches(count || 0);

    const { data } = await supabase.from('search_logs').select('search_term, results_count, created_at, user_id').order('created_at', { ascending: false }).limit(1000);
    
    if (data && data.length > 0) {
      setSearchLogs(data);
      const termMap: Record<string, { count: number; totalResults: number }> = {};
      data.forEach(log => {
        const term = log.search_term.toLowerCase();
        if (!termMap[term]) termMap[term] = { count: 0, totalResults: 0 };
        termMap[term].count++;
        termMap[term].totalResults += log.results_count || 0;
      });
      setTopSearches(
        Object.entries(termMap)
          .map(([term, d]) => ({ term, count: d.count, avg_results: Math.round(d.totalResults / d.count) }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 15)
      );
    }
    setLoading(false);
  };

  // Search volume by day
  const searchByDay = useMemo(() => {
    const days = 14;
    return Array.from({ length: days }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      const dateStr = date.toISOString().split('T')[0];
      const count = searchLogs.filter(l => l.created_at?.split('T')[0] === dateStr).length;
      return { date: new Date(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }), searches: count };
    });
  }, [searchLogs]);

  // Zero result searches
  const zeroResultSearches = useMemo(() => {
    const map: Record<string, number> = {};
    searchLogs.filter(l => (l.results_count || 0) === 0).forEach(l => {
      const term = l.search_term.toLowerCase();
      map[term] = (map[term] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [searchLogs]);

  // Unique searchers
  const uniqueSearchers = useMemo(() => {
    return new Set(searchLogs.filter(l => l.user_id).map(l => l.user_id)).size;
  }, [searchLogs]);

  if (loading) {
    return (
      <div className="bg-card rounded-2xl p-4 shadow-card">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-2/3" />
        </div>
      </div>
    );
  }

  const maxCount = topSearches.length > 0 ? topSearches[0].count : 1;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Searches', value: totalSearches, icon: Search, color: 'from-primary/20 to-primary/5' },
          { label: 'Unique Terms', value: topSearches.length, icon: BarChart3, color: 'from-accent/20 to-accent/5' },
          { label: 'Unique Searchers', value: uniqueSearchers, icon: Users, color: 'from-success/20 to-success/5' },
          { label: 'Zero Results', value: zeroResultSearches.length, icon: AlertCircle, color: 'from-destructive/20 to-destructive/5' },
        ].map(card => (
          <div key={card.label} className={`bg-gradient-to-br ${card.color} rounded-2xl p-4`}>
            <card.icon className="w-4 h-4 text-muted-foreground mb-1" />
            <p className="text-xl font-bold text-foreground">{card.value}</p>
            <p className="text-[10px] text-muted-foreground">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Search Volume Chart */}
      <div className="bg-card rounded-2xl p-4 shadow-card">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-sm">
          <TrendingUp className="w-4 h-4 text-primary" /> Search Volume (Last 14 Days)
        </h3>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={searchByDay}>
              <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 8 }} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} width={25} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
              <Bar dataKey="searches" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Top Searches */}
        <div className="bg-card rounded-2xl p-4 shadow-card">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-sm">
            <Search className="w-4 h-4 text-primary" /> Top Searches
          </h3>
          {topSearches.length > 0 ? (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {topSearches.map((item, index) => (
                <div key={item.term} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${index < 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{index + 1}</span>
                      <span className="text-xs font-medium text-foreground">"{item.term}"</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">{item.count}×</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${item.avg_results > 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                        {item.avg_results} results
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${(item.count / maxCount) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No search data yet</p>
            </div>
          )}
        </div>

        {/* Zero Result Searches */}
        <div className="bg-card rounded-2xl p-4 shadow-card">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4 text-destructive" /> Zero Result Searches
          </h3>
          {zeroResultSearches.length > 0 ? (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {zeroResultSearches.map(([term, count]) => (
                <div key={term} className="flex items-center justify-between bg-destructive/5 rounded-lg p-2">
                  <span className="text-xs text-foreground">"{term}"</span>
                  <span className="text-[10px] text-destructive font-medium">{count}× no results</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">All searches returned results!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchTab;
