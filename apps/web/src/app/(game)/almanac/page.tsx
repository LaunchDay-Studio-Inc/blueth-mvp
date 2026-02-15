'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { GlassPanel } from '@/components/ui/glass-panel';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { ALMANAC_CATEGORIES } from '@/lib/almanac-data';
import { Search } from 'lucide-react';

export default function AlmanacPage() {
  const [query, setQuery] = useState('');

  const filteredCategories = useMemo(() => {
    if (!query.trim()) return ALMANAC_CATEGORIES;

    const lower = query.toLowerCase();
    return ALMANAC_CATEGORIES.map((cat) => ({
      ...cat,
      entries: cat.entries.filter((entry) => {
        const searchable = [
          entry.title,
          ...entry.keywords,
          entry.body,
        ]
          .join(' ')
          .toLowerCase();
        return searchable.includes(lower);
      }),
    })).filter((cat) => cat.entries.length > 0);
  }, [query]);

  const defaultOpen = query.trim()
    ? filteredCategories.map((c) => c.id)
    : [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">City Almanac</h1>
      <p className="text-sm text-muted-foreground">
        Your guide to surviving and thriving in Blueth City.
      </p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search the almanac..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {filteredCategories.length === 0 ? (
        <GlassPanel variant="inset" padding="md">
          <p className="text-sm text-muted-foreground text-center py-4">
            No entries found for &ldquo;{query}&rdquo;
          </p>
        </GlassPanel>
      ) : (
        <Accordion
          type="multiple"
          defaultValue={defaultOpen}
          key={query}
        >
          {filteredCategories.map((cat) => {
            const Icon = cat.icon;
            return (
              <AccordionItem key={cat.id} value={cat.id}>
                <AccordionTrigger className="text-sm">
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                    {cat.label}
                    <span className="text-xs text-muted-foreground">
                      ({cat.entries.length})
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    {cat.entries.map((entry) => (
                      <GlassPanel
                        key={entry.id}
                        variant="inset"
                        padding="md"
                      >
                        <h3 className="text-sm font-semibold mb-2">
                          {entry.title}
                        </h3>
                        <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
                          {entry.body}
                        </p>
                      </GlassPanel>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
