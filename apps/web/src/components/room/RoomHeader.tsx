'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Share2,
  Copy,
  Check,
  Settings,
  Users,
  LogOut,
  MoreVertical,
  Wifi,
  Globe,
  Lock,
  Trash2,
  ExternalLink,
  QrCode
} from 'lucide-react';
import type { Room } from '@airshare/shared';
import { useRoomStore, useAuthStore } from '@/lib/stores';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface RoomHeaderProps {
  room: Room & { encryptionSalt?: string };
  presenceCount: number;
  isConnected: boolean;
}

export function RoomHeader({ room, presenceCount, isConnected }: RoomHeaderProps) {
  const router = useRouter();
  const { leaveRoom, deleteRoom } = useRoomStore();
  const { user } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  const isOwner = user?.id === room.ownerId;
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/room/${room.code}`
    : '';

  const copyCode = async () => {
    await navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeave = () => {
    leaveRoom();
    router.push('/');
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this room? This action cannot be undone.')) {
      await deleteRoom(room.code);
      router.push('/');
    }
  };

  return (
    <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-40">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Left: Logo & Room Info */}
        <div className="flex items-center gap-4 min-w-0">
          {/* Logo */}
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0"
          >
            <Share2 className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl hidden sm:inline">AirShare</span>
          </button>

          {/* Divider */}
          <div className="h-6 w-px bg-border shrink-0" />

          {/* Room Name & Mode */}
          <div className="flex items-center gap-2 min-w-0">
            {room.mode === 'local' ? (
              <Wifi className="h-4 w-4 text-green-500 shrink-0" />
            ) : (
              <Globe className="h-4 w-4 text-blue-500 shrink-0" />
            )}
            <h1 className="font-medium truncate">{room.name}</h1>
            {room.access === 'password' && (
              <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            )}
          </div>
        </div>

        {/* Center: Room Code */}
        <button
          onClick={copyCode}
          className="hidden md:flex items-center gap-2 px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
        >
          <span className="font-mono font-medium tracking-wider">
            {room.code}
          </span>
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Connection & Presence */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
            <div
              className={cn(
                'h-2 w-2 rounded-full',
                isConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
              )}
            />
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{presenceCount}</span>
          </div>

          {/* Share Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowShareDialog(true)}
            className="hidden sm:inline-flex"
          >
            <Share2 className="h-4 w-4" />
            Share
          </Button>

          {/* Menu */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowMenu(!showMenu)}
            >
              <MoreVertical className="h-5 w-5" />
            </Button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-56 bg-popover border rounded-xl shadow-lg z-50 py-2">
                  {/* Mobile: Copy Code */}
                  <button
                    onClick={() => {
                      copyCode();
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted transition-colors md:hidden"
                  >
                    <Copy className="h-4 w-4" />
                    <span className="flex-1 text-left">Copy Code</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {room.code}
                    </span>
                  </button>

                  {/* Copy Link */}
                  <button
                    onClick={() => {
                      copyLink();
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>Copy Link</span>
                  </button>

                  {/* QR Code */}
                  <button
                    onClick={() => {
                      setShowShareDialog(true);
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted transition-colors"
                  >
                    <QrCode className="h-4 w-4" />
                    <span>Show QR Code</span>
                  </button>

                  <div className="my-2 border-t" />

                  {/* Settings (Owner only) */}
                  {isOwner && (
                    <button
                      onClick={() => {
                        // TODO: Open settings dialog
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted transition-colors"
                    >
                      <Settings className="h-4 w-4" />
                      <span>Room Settings</span>
                    </button>
                  )}

                  {/* Leave Room */}
                  <button
                    onClick={() => {
                      handleLeave();
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Leave Room</span>
                  </button>

                  {/* Delete Room (Owner only) */}
                  {isOwner && (
                    <>
                      <div className="my-2 border-t" />
                      <button
                        onClick={() => {
                          handleDelete();
                          setShowMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 hover:bg-destructive/10 text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Delete Room</span>
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Share Dialog */}
      {showShareDialog && (
        <ShareDialog
          room={room}
          shareUrl={shareUrl}
          onClose={() => setShowShareDialog(false)}
        />
      )}
    </header>
  );
}

function ShareDialog({
  room,
  shareUrl,
  onClose
}: {
  room: Room;
  shareUrl: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  const copyToClipboard = async (text: string, type: 'code' | 'link') => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div
          className="bg-background rounded-2xl shadow-lg border max-w-md w-full p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-xl font-semibold mb-2">Share Room</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Share this room with others using the code or link below
          </p>

          {/* Room Code */}
          <div className="mb-4">
            <label className="text-sm font-medium mb-2 block">Room Code</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-muted rounded-lg px-4 py-3 font-mono text-2xl tracking-[0.3em] text-center font-bold">
                {room.code}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(room.code, 'code')}
              >
                {copied === 'code' ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Share Link */}
          <div className="mb-6">
            <label className="text-sm font-medium mb-2 block">Share Link</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-muted rounded-lg px-4 py-2 text-sm truncate">
                {shareUrl}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(shareUrl, 'link')}
              >
                {copied === 'link' ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* QR Code Placeholder */}
          <div className="bg-muted rounded-xl p-8 flex items-center justify-center mb-6">
            <div className="text-center">
              <QrCode className="h-24 w-24 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                QR Code coming soon
              </p>
            </div>
          </div>

          {room.access === 'password' && (
            <p className="text-sm text-muted-foreground text-center mb-4">
              <Lock className="h-3.5 w-3.5 inline mr-1" />
              This room requires a password to join
            </p>
          )}

          <Button onClick={onClose} className="w-full">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
