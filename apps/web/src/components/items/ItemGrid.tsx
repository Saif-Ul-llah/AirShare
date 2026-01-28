'use client';

import type { Item } from '@airshare/shared';
import { ItemCard } from './ItemCard';
import { cn } from '@/lib/utils';

interface ItemGridProps {
  items: Item[];
  viewMode: 'grid' | 'list';
}

export function ItemGrid({ items, viewMode }: ItemGridProps) {
  if (viewMode === 'list') {
    return (
      <div className="space-y-2">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} viewMode="list" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} viewMode="grid" />
      ))}
    </div>
  );
}
