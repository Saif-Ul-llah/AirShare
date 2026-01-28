'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Share2,
  Wifi,
  Globe,
  Lock,
  Zap,
  Shield,
  ArrowRight,
} from 'lucide-react';
import { useAuthStore } from '@/lib/stores';
import { CreateRoomDialog } from '@/components/room/CreateRoomDialog';
import { JoinRoomDialog } from '@/components/room/JoinRoomDialog';
import { cn } from '@/lib/utils';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">AirShare</span>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Dashboard
                </button>
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">
                    {user?.displayName?.[0] || user?.email[0].toUpperCase()}
                  </span>
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={() => router.push('/login')}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => router.push('/register')}
                  className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Get Started
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Share anything,{' '}
            <span className="text-primary">instantly</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Create a room to share files, text, code, and links. Works on local
            networks with P2P transfers or across the internet with end-to-end
            encryption.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => setShowCreateDialog(true)}
              className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-xl text-lg font-medium hover:bg-primary/90 transition-all hover:scale-105"
            >
              Create Room
              <ArrowRight className="h-5 w-5" />
            </button>
            <button
              onClick={() => setShowJoinDialog(true)}
              className="inline-flex items-center justify-center gap-2 bg-secondary text-secondary-foreground px-8 py-4 rounded-xl text-lg font-medium hover:bg-secondary/80 transition-all"
            >
              Join Room
            </button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <FeatureCard
            icon={<Wifi className="h-6 w-6" />}
            title="Local Network Mode"
            description="Auto-discover devices on the same Wi-Fi. Direct P2P transfers without internet."
          />
          <FeatureCard
            icon={<Globe className="h-6 w-6" />}
            title="Internet Mode"
            description="Share across networks with persistent rooms, folder hierarchy, and version history."
          />
          <FeatureCard
            icon={<Lock className="h-6 w-6" />}
            title="End-to-End Encryption"
            description="Password-derived keys encrypt your data before it leaves your device."
          />
          <FeatureCard
            icon={<Zap className="h-6 w-6" />}
            title="Instant Sharing"
            description="Drop files or paste text. Get a shareable link in seconds."
          />
          <FeatureCard
            icon={<Shield className="h-6 w-6" />}
            title="Granular Access Control"
            description="Set passwords, expiry times, download limits, and one-time access."
          />
          <FeatureCard
            icon={<Share2 className="h-6 w-6" />}
            title="Multiple Content Types"
            description="Files, folders, text, code snippets, links with previews, and markdown notes."
          />
        </div>
      </section>

      {/* Dialogs */}
      <CreateRoomDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
      <JoinRoomDialog open={showJoinDialog} onOpenChange={setShowJoinDialog} />
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-2xl border bg-card hover:shadow-lg transition-shadow">
      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}
