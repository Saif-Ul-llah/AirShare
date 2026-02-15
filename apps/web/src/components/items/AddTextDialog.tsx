'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useItemActions } from '@/hooks';
import { cn } from '@/lib/utils';

interface AddTextDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomCode: string;
}

export function AddTextDialog({ open, onOpenChange, roomCode }: AddTextDialogProps) {
  const { createItem, isCreating, error, clearError } = useItemActions();
  const [content, setContent] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    const item = await createItem(roomCode, 'text', {
      content,
      encrypted: false
    });

    if (item) {
      handleClose();
    }
  };

  const handleClose = () => {
    setContent('');
    clearError();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent onClose={handleClose} className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-green-500/10 text-green-500">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Add Text Snippet</DialogTitle>
              <DialogDescription>Share plain text content</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Content</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste or type your text here..."
                className={cn(
                  'w-full h-48 px-4 py-3 rounded-xl border bg-muted/30 resize-none',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:bg-background',
                  'font-mono text-sm leading-relaxed transition-colors',
                  'placeholder:text-muted-foreground/60'
                )}
                autoFocus
              />
              <p className="mt-1.5 text-xs text-muted-foreground text-right">
                {content.length.toLocaleString()} characters
              </p>
            </div>

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
              disabled={!content.trim()}
              isLoading={isCreating}
            >
              Add Text
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
