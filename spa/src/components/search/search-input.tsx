
'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import React from 'react';

export function SearchInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const defaultQuery = searchParams.get('q') || '';

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const query = formData.get('search') as string;
    
    let searchUrl = '/search';
    if (query) {
      searchUrl += `?q=${encodeURIComponent(query)}`;
      if (pathname === '/anime') {
        searchUrl += `&is_anime_search=true`;
      }
    }
    router.push(searchUrl);
  };

  return (
    <form onSubmit={handleSearch} className="relative w-full max-w-xs">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        name="search"
        defaultValue={defaultQuery}
        placeholder="Search titles..."
        className="w-full bg-secondary pl-9"
        aria-label="Search for a video"
      />
    </form>
  );
}
