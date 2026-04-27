import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { COUNTRIES } from '../constants';

interface Props {
  onSelect: (name: string, flag: string) => void;
}

export const CountryStep: React.FC<Props> = ({ onSelect }) => {
  const [search, setSearch] = useState('');
  const filtered = useMemo(
    () => (search.trim() ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())) : COUNTRIES),
    [search]
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 mt-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search country..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-10 rounded-xl bg-muted border-0"
        />
      </div>
      <div className="space-y-1 mt-2 overflow-y-auto max-h-[45vh] pr-1">
        {filtered.map((country) => (
          <button
            key={country.name}
            onClick={() => onSelect(country.name, country.flag)}
            className="w-full p-3 bg-muted rounded-xl text-left text-sm font-medium text-foreground hover:bg-primary/10 transition-colors"
          >
            {country.flag} {country.name}
          </button>
        ))}
      </div>
    </div>
  );
};
