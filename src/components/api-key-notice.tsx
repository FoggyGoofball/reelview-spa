'use client';

import { useState } from 'react';
import { AlertTriangle, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

export function ApiKeyNotice() {
  const [apiKey, setApiKey] = useState('');
  const { toast } = useToast();

  const handleSave = () => {
    if (!apiKey.trim()) {
      toast({
        variant: "destructive",
        title: 'API Key is required',
        description: 'Please enter a valid TMDB API key.',
      });
      return;
    }
    localStorage.setItem('TMDB_API_KEY', apiKey);
    toast({
      title: 'API Key Saved!',
      description: 'The page will now reload.',
    });
    
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  return (
    <div className="container max-w-screen-md my-12">
      <div className="p-6 rounded-lg bg-secondary border border-primary/20 flex flex-col items-center text-center">
        <AlertTriangle className="w-12 h-12 text-primary mb-4" />
        <h2 className="text-2xl font-bold mb-2">TMDB API Key Required</h2>
        <p className="text-muted-foreground mb-6">
          This app requires a The Movie Database (TMDB) API key to fetch movie data. Please get a free key, paste it below, and click save.
        </p>
        
        <div className="w-full max-w-sm space-y-4">
            <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your TMDB API Key..."
                    className="pl-9"
                    aria-label="TMDB API Key"
                />
            </div>

            <div className="flex gap-4 justify-center">
                <Button onClick={handleSave}>Save Key & Reload</Button>
                <Button asChild variant="outline">
                <a href="https://www.themoviedb.org/signup" target="_blank" rel="noopener noreferrer">
                    Get a TMDB API Key
                </a>
                </Button>
            </div>
        </div>

        <p className="text-xs text-muted-foreground/50 mt-6">
            Your API key will be stored in your browser's local storage.
        </p>
      </div>
    </div>
  );
}
