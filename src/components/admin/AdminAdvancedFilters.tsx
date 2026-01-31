import React, { useState } from 'react';
import { Search, Filter, X, Calendar, ArrowUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';

export interface FilterConfig {
  searchPlaceholder?: string;
  showDateFilter?: boolean;
  showPriceFilter?: boolean;
  showSortOptions?: boolean;
  sortOptions?: { value: string; label: string }[];
  customFilters?: React.ReactNode;
}

interface AdminAdvancedFiltersProps {
  config: FilterConfig;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  dateRange?: { from: Date | undefined; to: Date | undefined };
  onDateRangeChange?: (range: { from: Date | undefined; to: Date | undefined }) => void;
  priceRange?: { min: string; max: string };
  onPriceRangeChange?: (range: { min: string; max: string }) => void;
  sortBy?: string;
  onSortChange?: (sort: string) => void;
}

const AdminAdvancedFilters: React.FC<AdminAdvancedFiltersProps> = ({
  config,
  searchQuery,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  priceRange,
  onPriceRangeChange,
  sortBy,
  onSortChange
}) => {
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters = 
    searchQuery || 
    dateRange?.from || 
    dateRange?.to || 
    priceRange?.min || 
    priceRange?.max ||
    (sortBy && sortBy !== 'newest');

  const clearAllFilters = () => {
    onSearchChange('');
    onDateRangeChange?.({ from: undefined, to: undefined });
    onPriceRangeChange?.({ min: '', max: '' });
    onSortChange?.('newest');
  };

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={config.searchPlaceholder || 'Search...'}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 h-10 rounded-xl"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        
        <Button
          variant={showFilters ? 'default' : 'outline'}
          size="icon"
          onClick={() => setShowFilters(!showFilters)}
          className="rounded-xl relative"
        >
          <Filter className="w-4 h-4" />
          {hasActiveFilters && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
          )}
        </Button>
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <div className="bg-muted/50 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Filters</span>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-xs text-primary hover:underline"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Date Range Filter */}
            {config.showDateFilter && onDateRangeChange && (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Date Range</label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="flex-1 justify-start text-xs">
                        <Calendar className="w-3 h-3 mr-2" />
                        {dateRange?.from ? format(dateRange.from, 'dd/MM/yy') : 'From'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={dateRange?.from}
                        onSelect={(date) => onDateRangeChange({ ...dateRange!, from: date })}
                      />
                    </PopoverContent>
                  </Popover>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="flex-1 justify-start text-xs">
                        <Calendar className="w-3 h-3 mr-2" />
                        {dateRange?.to ? format(dateRange.to, 'dd/MM/yy') : 'To'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={dateRange?.to}
                        onSelect={(date) => onDateRangeChange({ ...dateRange!, to: date })}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            {/* Price Range Filter */}
            {config.showPriceFilter && onPriceRangeChange && (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Price Range (₹)</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={priceRange?.min || ''}
                    onChange={(e) => onPriceRangeChange({ ...priceRange!, min: e.target.value })}
                    className="h-8 text-xs"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={priceRange?.max || ''}
                    onChange={(e) => onPriceRangeChange({ ...priceRange!, max: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Sort Options */}
          {config.showSortOptions && config.sortOptions && onSortChange && (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3" />
                Sort by
              </label>
              <div className="flex gap-2 flex-wrap">
                {config.sortOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => onSortChange(option.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      sortBy === option.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card text-foreground hover:bg-muted'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom Filters */}
          {config.customFilters}
        </div>
      )}
    </div>
  );
};

export default AdminAdvancedFilters;
