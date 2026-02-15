'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Lock, Eye, EyeOff } from 'lucide-react';
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
import { useRoomStore } from '@/lib/stores';

interface JoinRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JoinRoomDialog({ open, onOpenChange }: JoinRoomDialogProps) {
  const router = useRouter();
  const { joinRoom, isLoading, error, clearError } = useRoomStore();

  const [input, setInput] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);

  // Detect if input looks like a room code (8 alphanumeric chars)
  const isCodeInput = /^[A-Z0-9]{1,8}$/i.test(input.replace(/[^A-Z0-9]/gi, ''));
  const normalizedCode = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const isValidCode = normalizedCode.length === 8;
  const isValidName = input.trim().length >= 1;
  const canSubmit = isValidCode || isValidName;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    // Use room code if it's exactly 8 alphanumeric chars, otherwise treat as room name
    const query = isValidCode ? normalizedCode : input.trim();

    if (!query) return;

    const success = await joinRoom(query, needsPassword ? password : undefined);

    if (success) {
      onOpenChange(false);
      // Navigate using the actual room code from the store
      const { currentRoom } = useRoomStore.getState();
      router.push(`/room/${currentRoom?.code || query}`);
    } else if (error?.includes('password')) {
      setNeedsPassword(true);
    }
  };

  const handleClose = () => {
    setInput('');
    setPassword('');
    setNeedsPassword(false);
    clearError();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent onClose={handleClose}>
        <DialogHeader>
          <DialogTitle>Join a Room</DialogTitle>
          <DialogDescription>
            Enter a room code or room name to join
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            {/* Room Code or Name */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Room Code or Name
              </label>
              <Input
                placeholder="ABCD1234 or My Room"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className={isCodeInput && input.length > 0
                  ? "text-center text-2xl tracking-[0.3em] font-mono uppercase"
                  : ""
                }
                maxLength={100}
                autoComplete="off"
                autoFocus
              />
              <p className="mt-1 text-xs text-muted-foreground text-center">
                {isCodeInput && input.length > 0
                  ? `${normalizedCode.length}/8 code characters`
                  : 'Enter room name or 8-character code'
                }
              </p>
            </div>

            {/* Password Input (shown when needed) */}
            {needsPassword && (
              <div className="animate-slide-up">
                <label className="block text-sm font-medium mb-2">
                  <div className="flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" />
                    Room Password
                  </div>
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter the room password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                    autoFocus
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
              </div>
            )}

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
              disabled={!canSubmit || (needsPassword && password.length < 4)}
            >
              Join Room
              <ArrowRight className="h-4 w-4" />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
