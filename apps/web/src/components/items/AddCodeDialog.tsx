'use client';

import { useState } from 'react';
import { Code } from 'lucide-react';
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
import { Select } from '@/components/ui/Select';
import { useItemActions } from '@/hooks';
import { cn } from '@/lib/utils';

interface AddCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomCode: string;
}

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'csharp', label: 'C#' },
  { value: 'cpp', label: 'C++' },
  { value: 'c', label: 'C' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'plaintext', label: 'Plain Text' }
];

export function AddCodeDialog({ open, onOpenChange, roomCode }: AddCodeDialogProps) {
  const { createItem, isCreating, error, clearError } = useItemActions();
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [filename, setFilename] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    const item = await createItem(roomCode, 'code', {
      content,
      language,
      filename: filename || undefined,
      encrypted: false
    });

    if (item) {
      handleClose();
    }
  };

  const handleClose = () => {
    setContent('');
    setLanguage('javascript');
    setFilename('');
    clearError();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent onClose={handleClose} className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
              <Code className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Add Code Snippet</DialogTitle>
              <DialogDescription>Share code with syntax highlighting</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Language</label>
                <Select
                  value={language}
                  onChange={setLanguage}
                  options={LANGUAGES}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Filename
                  <span className="text-muted-foreground font-normal ml-1">(optional)</span>
                </label>
                <Input
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder="e.g., example.js"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Code</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste your code here..."
                className={cn(
                  'w-full h-64 px-4 py-3 rounded-xl border bg-muted/30 resize-none',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:bg-background',
                  'font-mono text-sm leading-relaxed transition-colors',
                  'placeholder:text-muted-foreground/60'
                )}
                autoFocus
              />
              <p className="mt-1.5 text-xs text-muted-foreground text-right">
                {content.split('\n').length} {content.split('\n').length === 1 ? 'line' : 'lines'}
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
              Add Code
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
