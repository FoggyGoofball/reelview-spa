'use client';

import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { PlusCircle } from 'lucide-react';

interface ViewMoreCardProps {
  href: string;
}

export function ViewMoreCard({ href }: ViewMoreCardProps) {
  const navigate = useNavigate();

  return (
    <div className="group block h-full cursor-pointer" onClick={() => navigate(href)}>
      <Card className="h-full overflow-hidden border-2 border-dashed border-secondary hover:border-primary hover:text-primary transition-all duration-300 flex items-center justify-center bg-secondary/50 hover:bg-secondary">
        <div className="flex flex-col items-center gap-2 text-muted-foreground group-hover:text-primary">
          <PlusCircle className="h-12 w-12" />
          <span className="text-sm font-medium">View More</span>
        </div>
      </Card>
    </div>
  );
}
