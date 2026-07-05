
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import { MainNav } from './main-nav';
import { Logo } from './logo';

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-foreground"
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="pr-0">
        <SheetHeader className="p-6 border-b">
            <SheetTitle className='sr-only'>Navigation</SheetTitle>
            <Logo />
        </SheetHeader>
        <div className="p-6 space-y-6">
          <MainNav className="flex-col items-start space-x-0 space-y-4" isInSheet />
        </div>
      </SheetContent>
    </Sheet>
  );
}
