'use client';

import { useState } from 'react';
import { StickyNote, Code } from 'lucide-react';
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

interface AddNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomCode: string;
}

export function AddNoteDialog({ open, onOpenChange, roomCode }: AddNoteDialogProps) {
  const { createItem, isCreating, error, clearError } = useItemActions();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    const item = await createItem(roomCode, 'note', {
      title: title || 'Untitled Note',
      content,
      encrypted: false
    });

    if (item) {
      handleClose();
    }
  };

  const handleClose = () => {
    setTitle('');
    setContent('');
    clearError();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent onClose={handleClose} className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-yellow-500/10 text-yellow-500">
              <StickyNote className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Add Note</DialogTitle>
              <DialogDescription>Create a markdown note</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Note title"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Content
                <span className="text-muted-foreground font-normal ml-1">
                  (Markdown supported)
                </span>
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your note here...

# Heading
## Subheading

- Bullet point
- Another point

**Bold** and *italic* text

```code block```"
                className={cn(
                  'w-full h-64 px-4 py-3 rounded-xl border bg-muted/30 resize-none',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:bg-background',
                  'font-mono text-sm leading-relaxed transition-colors',
                  'placeholder:text-muted-foreground/60'
                )}
              />
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Code className="h-3 w-3" />
                  Markdown supported
                </p>
                <p className="text-xs text-muted-foreground">
                  {content.length.toLocaleString()} characters
                </p>
              </div>
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
              Add Note
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
