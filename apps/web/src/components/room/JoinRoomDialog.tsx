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

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (normalizedCode.length !== 8) {
      return;
    }

    const success = await joinRoom(normalizedCode, needsPassword ? password : undefined);

    if (success) {
      onOpenChange(false);
      router.push(`/room/${normalizedCode}`);
    } else if (error?.includes('password')) {
      setNeedsPassword(true);
    }
  };

  const handleClose = () => {
    setCode('');
    setPassword('');
    setNeedsPassword(false);
    clearError();
    onOpenChange(false);
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Format code input: uppercase, alphanumeric only
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (value.length <= 8) {
      setCode(value);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent onClose={handleClose}>
        <DialogHeader>
          <DialogTitle>Join a Room</DialogTitle>
          <DialogDescription>
            Enter the 8-character room code to join
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            {/* Room Code */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Room Code
              </label>
              <Input
                placeholder="ABCD1234"
                value={code}
                onChange={handleCodeChange}
                className="text-center text-2xl tracking-[0.5em] font-mono uppercase"
                maxLength={8}
                autoComplete="off"
                autoFocus
              />
              <p className="mt-1 text-xs text-muted-foreground text-center">
                {code.length}/8 characters
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
              <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
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
              disabled={code.length !== 8 || (needsPassword && password.length < 4)}
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
