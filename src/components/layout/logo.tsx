import Link from 'next/link';
import { Film } from 'lucide-react';

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="ReelView Home">
      <Film className="h-7 w-7 text-primary" />
      <span className="hidden text-xl font-bold tracking-tighter text-foreground sm:inline-block">
        ReelView
      </span>
    </Link>
  );
}
