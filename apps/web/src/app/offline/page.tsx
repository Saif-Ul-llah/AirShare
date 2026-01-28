'use client';

import { WifiOff, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        {/* Icon */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-6">
          <WifiOff className="h-10 w-10 text-muted-foreground" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold mb-2">You're Offline</h1>
        <p className="text-muted-foreground mb-8">
          It looks like you've lost your internet connection. Some features may be unavailable until you're back online.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleRetry}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-muted text-foreground rounded-xl font-medium hover:bg-muted/80 transition-colors"
          >
            <Home className="h-4 w-4" />
            Go Home
          </Link>
        </div>

        {/* Info */}
        <div className="mt-12 p-4 bg-muted/50 rounded-xl">
          <h2 className="font-medium mb-2">What you can still do:</h2>
          <ul className="text-sm text-muted-foreground space-y-1 text-left">
            <li>- View previously cached rooms and items</li>
            <li>- Use P2P mode on local network</li>
            <li>- Queue items for upload when back online</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
