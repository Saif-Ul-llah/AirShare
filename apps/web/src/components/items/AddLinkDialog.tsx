'use client';

import { useState } from 'react';
import { Link as LinkIcon, ExternalLink, Loader2 } from 'lucide-react';
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

interface AddLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomCode: string;
}

export function AddLinkDialog({ open, onOpenChange, roomCode }: AddLinkDialogProps) {
  const { createItem, isCreating, error, clearError } = useItemActions();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    // Ensure URL has protocol
    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }

    const item = await createItem(roomCode, 'link', {
      url: finalUrl,
      title: title || undefined,
      description: description || undefined
    });

    if (item) {
      handleClose();
    }
  };

  const handleClose = () => {
    setUrl('');
    setTitle('');
    setDescription('');
    clearError();
    onOpenChange(false);
  };

  const isValidUrl = (str: string) => {
    try {
      const urlToTest = str.startsWith('http') ? str : 'https://' + str;
      new URL(urlToTest);
      return str.length > 0;
    } catch {
      return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent onClose={handleClose}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-500">
              <LinkIcon className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Add Web Link</DialogTitle>
              <DialogDescription>Share a URL with preview</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">URL</label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="pl-10"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Title
                <span className="text-muted-foreground font-normal ml-1">(optional)</span>
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Custom title for the link"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Description
                <span className="text-muted-foreground font-normal ml-1">(optional)</span>
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description"
              />
            </div>

            {/* Preview */}
            {isValidUrl(url) && (
              <div className="p-4 border rounded-xl bg-muted/20 animate-slide-up">
                <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2.5">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Preview
                </div>
                <div className="font-medium">{title || url}</div>
                {description && (
                  <div className="text-sm text-muted-foreground mt-1">
                    {description}
                  </div>
                )}
                <div className="text-xs text-primary mt-2.5 truncate">{url}</div>
              </div>
            )}

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
              disabled={!isValidUrl(url)}
              isLoading={isCreating}
            >
              Add Link
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
