'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  File,
  FileText,
  Code,
  Link as LinkIcon,
  Image as ImageIcon,
  StickyNote,
  Download,
  Copy,
  Check,
  Lock,
  Eye,
  EyeOff,
  Clock,
  AlertCircle,
  Share2,
  ExternalLink
} from 'lucide-react';
import type { Item } from '@airshare/shared';
import { useItemStore } from '@/lib/stores';
import { itemApi } from '@/lib/api/endpoints';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

export default function SharePage() {
  const params = useParams();
  const router = useRouter();
  const shareUrl = params.shareUrl as string;

  const [item, setItem] = useState<Item | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchItem = async (pwd?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await itemApi.getByShareUrl(shareUrl, pwd);
      if (response.success && response.data) {
        setItem(response.data.item);
        setNeedsPassword(false);
      } else {
        const errorMsg = response.error?.message || 'Item not found';
        if (errorMsg.toLowerCase().includes('password')) {
          setNeedsPassword(true);
        } else {
          setError(errorMsg);
        }
      }
    } catch (err) {
      setError('Failed to load shared content');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItem();
  }, [shareUrl]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetchItem(password);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading shared content...</p>
        </div>
      </div>
    );
  }

  // Password required
  if (needsPassword) {
    return (
      <ShareLayout>
        <div className="max-w-md w-full mx-auto">
          <div className="bg-card border rounded-2xl p-8 text-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Password Protected</h1>
            <p className="text-muted-foreground mb-6">
              This content is protected. Enter the password to view it.
            </p>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="text-center pr-10"
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
              <Button type="submit" className="w-full" disabled={password.length < 4}>
                View Content
              </Button>
            </form>
          </div>
        </div>
      </ShareLayout>
    );
  }

  // Error state
  if (error || !item) {
    return (
      <ShareLayout>
        <div className="max-w-md w-full mx-auto text-center">
          <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Content Not Found</h1>
          <p className="text-muted-foreground mb-6">
            {error || 'This shared content may have expired or been removed.'}
          </p>
          <Button onClick={() => router.push('/')}>Go Home</Button>
        </div>
      </ShareLayout>
    );
  }

  // Render item based on type
  return (
    <ShareLayout>
      <div className="max-w-4xl w-full mx-auto">
        <ShareItemView item={item} onCopyLink={copyLink} copied={copied} />
      </div>
    </ShareLayout>
  );
}

function ShareLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col">
      {/* Header */}
      <header className="p-6 border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <Share2 className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">AirShare</span>
          </button>
          <Button variant="outline" size="sm" onClick={() => router.push('/')}>
            Create Your Own Room
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-6">{children}</main>

      {/* Footer */}
      <footer className="p-6 text-center text-sm text-muted-foreground border-t">
        <p>Shared via AirShare - Secure file and content sharing</p>
      </footer>
    </div>
  );
}

function ShareItemView({
  item,
  onCopyLink,
  copied
}: {
  item: Item;
  onCopyLink: () => void;
  copied: boolean;
}) {
  const getItemInfo = () => {
    switch (item.content.type) {
      case 'file':
        return {
          icon: File,
          name: item.content.data.filename,
          color: 'text-blue-500 bg-blue-500/10'
        };
      case 'text':
        return {
          icon: FileText,
          name: 'Text Snippet',
          color: 'text-green-500 bg-green-500/10'
        };
      case 'link':
        return {
          icon: LinkIcon,
          name: item.content.data.title || 'Web Link',
          color: 'text-orange-500 bg-orange-500/10'
        };
      case 'image':
        return {
          icon: ImageIcon,
          name: item.content.data.filename,
          color: 'text-pink-500 bg-pink-500/10'
        };
      case 'code':
        return {
          icon: Code,
          name: item.content.data.filename || `${item.content.data.language} code`,
          color: 'text-purple-500 bg-purple-500/10'
        };
      case 'note':
        return {
          icon: StickyNote,
          name: item.content.data.title,
          color: 'text-yellow-500 bg-yellow-500/10'
        };
      default:
        return {
          icon: File,
          name: 'Shared Content',
          color: 'text-gray-500 bg-gray-500/10'
        };
    }
  };

  const info = getItemInfo();
  const Icon = info.icon;

  return (
    <div className="bg-card border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={cn('p-3 rounded-xl', info.color)}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">{info.name}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Shared {formatDate(item.createdAt)}
              </span>
              {item.access.expiresAt && (
                <span>Expires {formatDate(item.access.expiresAt)}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCopyLink}>
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy Link
              </>
            )}
          </Button>
          {(item.content.type === 'file' || item.content.type === 'image') && (
            <Button size="sm" asChild>
              <a href={itemApi.download(item.id)} download>
                <Download className="h-4 w-4" />
                Download
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <ItemContentView item={item} />
      </div>
    </div>
  );
}

function ItemContentView({ item }: { item: Item }) {
  const [copied, setCopied] = useState(false);

  const copyContent = async (content: string) => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  switch (item.content.type) {
    case 'text':
      return (
        <div className="relative">
          <pre className="p-4 bg-muted rounded-xl overflow-x-auto whitespace-pre-wrap font-mono text-sm">
            {item.content.data.content}
          </pre>
          <button
            onClick={() => copyContent(item.content.data.content)}
            className="absolute top-2 right-2 p-2 bg-background border rounded-lg hover:bg-muted transition-colors"
            title="Copy"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>
      );

    case 'code':
      return (
        <div className="relative">
          <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b rounded-t-xl">
            <span className="text-sm font-medium">
              {item.content.data.filename || item.content.data.language}
            </span>
            <span className="text-xs text-muted-foreground uppercase">
              {item.content.data.language}
            </span>
          </div>
          <pre className="p-4 bg-muted rounded-b-xl overflow-x-auto font-mono text-sm">
            <code>{item.content.data.content}</code>
          </pre>
          <button
            onClick={() => copyContent(item.content.data.content)}
            className="absolute top-2 right-2 p-2 bg-background border rounded-lg hover:bg-muted transition-colors"
            title="Copy"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>
      );

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
          <div className="p-4">
            <h3 className="font-medium mb-1">
              {item.content.data.title || item.content.data.url}
            </h3>
            {item.content.data.description && (
              <p className="text-sm text-muted-foreground mb-3">
                {item.content.data.description}
              </p>
            )}
            <a
              href={item.content.data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              {new URL(item.content.data.url).hostname}
            </a>
          </div>
        </div>
      );

    case 'note':
      return (
        <div className="prose prose-sm max-w-none">
          <h2 className="text-xl font-semibold mb-4">{item.content.data.title}</h2>
          <div className="p-4 bg-muted/50 rounded-xl">
            {/* In a real app, you'd render markdown here */}
            <pre className="whitespace-pre-wrap font-sans">
              {item.content.data.content}
            </pre>
          </div>
        </div>
      );

    case 'file':
      return (
        <div className="text-center py-8">
          <File className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-medium mb-2">{item.content.data.filename}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {formatFileSize(item.content.data.size)} - {item.content.data.mimeType}
          </p>
          <Button asChild>
            <a href={itemApi.download(item.id)} download>
              <Download className="h-4 w-4" />
              Download File
            </a>
          </Button>
        </div>
      );

    case 'image':
      return (
        <div className="text-center">
          <img
            src={itemApi.download(item.id)}
            alt={item.content.data.filename}
            className="max-w-full mx-auto rounded-xl"
          />
          <p className="mt-4 text-sm text-muted-foreground">
            {item.content.data.filename} - {formatFileSize(item.content.data.size)}
          </p>
        </div>
      );

    default:
      return (
        <div className="text-center py-8 text-muted-foreground">
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
