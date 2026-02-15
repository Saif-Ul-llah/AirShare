'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wifi, Globe, Lock, Eye, EyeOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { useRoomStore } from '@/lib/stores';
import { cn } from '@/lib/utils';

interface CreateRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type RoomMode = 'local' | 'internet';
type RoomAccess = 'public' | 'password';

export function CreateRoomDialog({ open, onOpenChange }: CreateRoomDialogProps) {
  const router = useRouter();
  const { createRoom, isLoading, error, clearError } = useRoomStore();

  const [name, setName] = useState('');
  const [mode, setMode] = useState<RoomMode>('local');
  const [access, setAccess] = useState<RoomAccess>('public');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [persistent, setPersistent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    const room = await createRoom({
      name: name || 'Untitled Room',
      mode,
      access,
      password: access === 'password' ? password : undefined,
      lifespan: persistent ? 'persistent' : 'temporary',
    });

    if (room) {
      onOpenChange(false);
      router.push(`/room/${room.code}`);
    }
  };

  const handleClose = () => {
    setName('');
    setMode('local');
    setAccess('public');
    setPassword('');
    setPersistent(false);
    clearError();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent onClose={handleClose}>
        <DialogHeader>
          <DialogTitle>Create a Room</DialogTitle>
          <DialogDescription>
            Choose how you want to share content
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-6">
            {/* Room Name */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Room Name
              </label>
              <Input
                placeholder="My Share Room"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Mode Selection */}
            <div>
              <label className="block text-sm font-medium mb-3">
                Sharing Mode
              </label>
              <div className="grid grid-cols-2 gap-3">
                <ModeCard
                  icon={<Wifi className="h-5 w-5" />}
                  title="Local Network"
                  description="P2P on same Wi-Fi"
                  selected={mode === 'local'}
                  onClick={() => setMode('local')}
                />
                <ModeCard
                  icon={<Globe className="h-5 w-5" />}
                  title="Internet"
                  description="Share anywhere"
                  selected={mode === 'internet'}
                  onClick={() => setMode('internet')}
                />
              </div>
            </div>

            {/* Access Control */}
            <div>
              <label className="block text-sm font-medium mb-3">
                Access Control
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAccess('public')}
                  className={cn(
                    'p-3 rounded-xl border text-left transition-all',
                    access === 'public'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <div className="font-medium text-sm">Public</div>
                  <div className="text-xs text-muted-foreground">
                    Anyone with code can join
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setAccess('password')}
                  className={cn(
                    'p-3 rounded-xl border text-left transition-all',
                    access === 'password'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <div className="flex items-center gap-1.5 font-medium text-sm">
                    <Lock className="h-3.5 w-3.5" />
                    Password
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Requires password to join
                  </div>
                </button>
              </div>
            </div>

            {/* Password Input */}
            {access === 'password' && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Room Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  This password also encrypts shared content
                </p>
              </div>
            )}

            {/* Persistent Toggle (Internet mode only) */}
            {mode === 'internet' && (
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Persistent Room</div>
                  <div className="text-xs text-muted-foreground">
                    Room stays active until deleted
                  </div>
                </div>
                <Switch checked={persistent} onChange={setPersistent} />
              </div>
            )}

            {/* Mode Info */}
            <div className="p-3 rounded-xl bg-muted/50 text-sm text-muted-foreground">
              {mode === 'local' ? (
                <>
                  <strong className="text-foreground">Local mode:</strong> Direct
                  P2P transfers between devices on the same network. Room expires
                  in 24 hours. No account required.
                </>
              ) : (
                <>
                  <strong className="text-foreground">Internet mode:</strong>{' '}
                  Share with anyone via the room code. Supports folder hierarchy
                  and file versioning.{' '}
                  {persistent
                    ? 'Room persists until deleted.'
                    : 'Room expires in 7 days.'}
                </>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm animate-slide-up">
                {error}
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isLoading}
              disabled={access === 'password' && password.length < 4}
            >
              Create Room
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ModeCard({
  icon,
  title,
  description,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'p-4 rounded-xl border text-left transition-all',
        selected
          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
          : 'border-border hover:border-primary/50'
      )}
    >
      <div
        className={cn(
          'h-10 w-10 rounded-lg flex items-center justify-center mb-3',
          selected ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        {icon}
      </div>
      <div className="font-medium">{title}</div>
      <div className="text-xs text-muted-foreground">{description}</div>
    </button>
  );
}
