'use client';

import { useState, useEffect } from 'react';
import {
  X,
  File,
  FileText,
  Code,
  Link as LinkIcon,
  Image as ImageIcon,
  StickyNote,
  Download,
  Copy,
  Check,
  ExternalLink,
  Clock,
  Share2
} from 'lucide-react';
import type { Item } from '@airshare/shared';
import { useItemStore } from '@/lib/stores';
import { itemApi } from '@/lib/api/endpoints';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export function ItemPreviewModal() {
  const { selectedItem, selectItem } = useItemStore();
  const [copied, setCopied] = useState(false);
  const [contentCopied, setContentCopied] = useState(false);

  const close = () => selectItem(null);

  // Close on Escape key
  useEffect(() => {
    if (!selectedItem) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedItem]);

  // Lock body scroll
  useEffect(() => {
    if (!selectedItem) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, [selectedItem]);

  if (!selectedItem) return null;

  const item = selectedItem;

  const getItemInfo = () => {
    switch (item.content.type) {
      case 'file':
        return { icon: File, name: item.content.data.filename, color: 'text-blue-500 bg-blue-500/10', badgeColor: 'bg-blue-500' };
      case 'text':
        return { icon: FileText, name: 'Text Snippet', color: 'text-green-500 bg-green-500/10', badgeColor: 'bg-green-500' };
      case 'link':
        return { icon: LinkIcon, name: item.content.data.title || 'Web Link', color: 'text-orange-500 bg-orange-500/10', badgeColor: 'bg-orange-500' };
      case 'image':
        return { icon: ImageIcon, name: item.content.data.filename, color: 'text-pink-500 bg-pink-500/10', badgeColor: 'bg-pink-500' };
      case 'code':
        return { icon: Code, name: item.content.data.filename || `${item.content.data.language} code`, color: 'text-purple-500 bg-purple-500/10', badgeColor: 'bg-purple-500' };
      case 'note':
        return { icon: StickyNote, name: item.content.data.title, color: 'text-yellow-500 bg-yellow-500/10', badgeColor: 'bg-yellow-500' };
      default:
        return { icon: File, name: 'Unknown', color: 'text-gray-500 bg-gray-500/10', badgeColor: 'bg-gray-500' };
    }
  };

  const info = getItemInfo();
  const Icon = info.icon;

  const copyShareUrl = async () => {
    const shareUrl = `${window.location.origin}/s/${item.shareUrl}`;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    window.open(itemApi.download(item.id), '_blank');
  };

  const copyContent = async (content: string) => {
    await navigator.clipboard.writeText(content);
    setContentCopied(true);
    setTimeout(() => setContentCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={close}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
        <div
          className="animate-scale-in relative w-full max-w-3xl bg-background border rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 sm:px-6 sm:py-5 border-b bg-muted/30 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn('p-2.5 rounded-xl shrink-0', info.color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold truncate">{info.name}</h2>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(item.createdAt)}
                    </span>
                    <span className={cn('text-xs text-white px-1.5 py-0.5 rounded-md capitalize', info.badgeColor)}>
                      {item.content.type}
                    </span>
                  </div>
                </div>
              </div>

              {/* Close button */}
              <button
                onClick={close}
                className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6">
            <PreviewContent item={item} copied={contentCopied} onCopy={copyContent} />
          </div>

          {/* Footer actions */}
          <div className="px-5 py-4 sm:px-6 border-t bg-muted/20 flex items-center justify-between gap-3 shrink-0">
            <p className="text-xs text-muted-foreground hidden sm:block">
              Press <kbd className="px-1.5 py-0.5 bg-muted border rounded text-xs font-mono">Esc</kbd> to close
            </p>
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={copyShareUrl}>
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4" />
                    Copy Link
                  </>
                )}
              </Button>
              {(item.content.type === 'file' || item.content.type === 'image') && (
                <Button size="sm" onClick={handleDownload}>
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewContent({
  item,
  copied,
  onCopy
}: {
  item: Item;
  copied: boolean;
  onCopy: (content: string) => void;
}) {
  switch (item.content.type) {
    case 'text': {
      const textContent = item.content.data.content;
      return (
        <div className="relative group">
          <pre className="p-4 bg-muted/50 border rounded-xl overflow-x-auto whitespace-pre-wrap font-mono text-sm leading-relaxed">
            {textContent}
          </pre>
          <button
            onClick={() => onCopy(textContent)}
            className="absolute top-3 right-3 p-2 bg-background border rounded-lg hover:bg-muted transition-all opacity-0 group-hover:opacity-100 shadow-sm"
            title="Copy to clipboard"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      );
    }

    case 'code': {
      const codeData = item.content.data;
      return (
        <div className="relative group border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/70 border-b">
            <span className="text-sm font-medium">
              {codeData.filename || codeData.language}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide px-2 py-0.5 bg-background rounded-md border">
                {codeData.language}
              </span>
              <button
                onClick={() => onCopy(codeData.content)}
                className="p-1.5 bg-background border rounded-lg hover:bg-muted transition-all shadow-sm"
                title="Copy to clipboard"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <pre className="p-4 bg-muted/30 overflow-x-auto font-mono text-sm leading-relaxed">
            <code>{codeData.content}</code>
          </pre>
        </div>
      );
    }

    case 'link':
      return (
        <div className="border rounded-xl overflow-hidden">
          {item.content.data.image && (
            <div className="aspect-video bg-muted relative">
              <img
                src={item.content.data.image}
                alt={item.content.data.title || ''}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
          )}
          <div className="p-5">
            <h3 className="font-semibold text-lg mb-1">
              {item.content.data.title || item.content.data.url}
            </h3>
            {item.content.data.description && (
              <p className="text-sm text-muted-foreground mb-4">
                {item.content.data.description}
              </p>
            )}
            <a
              href={item.content.data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium px-3 py-1.5 bg-primary/5 rounded-lg transition-colors hover:bg-primary/10"
            >
              <ExternalLink className="h-4 w-4" />
              {(() => { try { return new URL(item.content.data.url).hostname; } catch { return item.content.data.url; } })()}
            </a>
          </div>
        </div>
      );

    case 'note':
      return (
        <div>
          <h2 className="text-xl font-semibold mb-4">{item.content.data.title}</h2>
          <div className="p-5 bg-muted/30 border rounded-xl">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {item.content.data.content}
            </pre>
          </div>
        </div>
      );

    case 'file':
      return (
        <div className="text-center py-10">
          <div className="inline-flex p-5 rounded-2xl bg-blue-500/10 mb-5">
            <File className="h-14 w-14 text-blue-500" />
          </div>
          <h3 className="font-semibold text-lg mb-1">{item.content.data.filename}</h3>
          <p className="text-sm text-muted-foreground mb-6">
            {formatFileSize(item.content.data.size)} &middot; {item.content.data.mimeType}
          </p>
          <Button onClick={() => window.open(itemApi.download(item.id), '_blank')}>
            <Download className="h-4 w-4" />
            Download File
          </Button>
        </div>
      );

    case 'image':
      return (
        <div className="text-center">
          <div className="bg-muted/30 border rounded-xl p-2 inline-block">
            <img
              src={itemApi.download(item.id)}
              alt={item.content.data.filename}
              className="max-w-full max-h-[60vh] mx-auto rounded-lg"
            />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {item.content.data.filename} &middot; {formatFileSize(item.content.data.size)}
          </p>
        </div>
      );

    default:
      return (
        <div className="text-center py-10 text-muted-foreground">
          Content preview not available
        </div>
      );
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}
