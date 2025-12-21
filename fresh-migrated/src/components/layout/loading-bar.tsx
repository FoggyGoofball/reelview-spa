
'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export function LoadingBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Show loading bar on route change start
    setIsLoading(true);

    // Hide loading bar on route change complete
    const handleComplete = () => setIsLoading(false);
    
    // We use a short timeout to allow the new page to render before hiding the bar.
    // In a real app, you might use more sophisticated logic or a library like nprogress.
    const timer = setTimeout(handleComplete, 200); // Adjust delay as needed

    return () => {
      clearTimeout(timer);
      handleComplete(); // Ensure it's hidden on cleanup
    };
  }, [pathname, searchParams]);

  if (!isLoading) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 w-full h-1 z-50">
      <div className="h-full bg-primary animate-pulse" />
    </div>
  );
}
