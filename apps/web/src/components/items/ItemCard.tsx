'use client';

import { useState } from 'react';
import {
  File,
  Folder,
  FileText,
  Link as LinkIcon,
  Image as ImageIcon,
  Code,
  StickyNote,
  MoreVertical,
  Download,
  Share2,
  Copy,
  Trash2,
  ExternalLink,
  Lock,
  Eye
} from 'lucide-react';
import type { Item } from '@airshare/shared';
import { useItemStore } from '@/lib/stores';
import { useItemActions } from '@/hooks';
import { itemApi } from '@/lib/api/endpoints';
import { cn } from '@/lib/utils';

interface ItemCardProps {
  item: Item;
  viewMode: 'grid' | 'list';
}

export function ItemCard({ item, viewMode }: ItemCardProps) {
  const { selectItem } = useItemStore();
  const { deleteItem } = useItemActions();
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const getItemInfo = () => {
    switch (item.content.type) {
      case 'file':
        return {
          icon: File,
          name: item.content.data.filename,
          subtitle: formatFileSize(item.content.data.size),
          color: 'text-blue-500 bg-blue-500/10'
        };
      case 'folder':
        return {
          icon: Folder,
          name: item.content.data.name,
          subtitle: `${item.content.data.itemCount} items`,
          color: 'text-yellow-500 bg-yellow-500/10'
        };
      case 'text':
        return {
          icon: FileText,
          name: 'Text Snippet',
          subtitle: truncate(item.content.data.content, 50),
          color: 'text-green-500 bg-green-500/10'
        };
      case 'link':
        return {
          icon: LinkIcon,
          name: item.content.data.title || 'Web Link',
          subtitle: item.content.data.url,
          color: 'text-orange-500 bg-orange-500/10'
        };
      case 'image':
        return {
          icon: ImageIcon,
          name: item.content.data.filename,
          subtitle: formatFileSize(item.content.data.size),
          color: 'text-pink-500 bg-pink-500/10',
          preview: true
        };
      case 'code':
        return {
          icon: Code,
          name: item.content.data.filename || `${item.content.data.language} snippet`,
          subtitle: item.content.data.language,
          color: 'text-purple-500 bg-purple-500/10'
        };
      case 'note':
        return {
          icon: StickyNote,
          name: item.content.data.title,
          subtitle: 'Markdown note',
          color: 'text-yellow-500 bg-yellow-500/10'
        };
      default:
        return {
          icon: File,
          name: 'Unknown',
          subtitle: '',
          color: 'text-gray-500 bg-gray-500/10'
        };
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

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      await deleteItem(item.id);
    }
  };

  if (viewMode === 'list') {
    return (
      <div className="flex items-center gap-4 p-4 border rounded-xl hover:bg-muted/50 transition-colors group">
        {/* Icon */}
        <div className={cn('p-3 rounded-xl shrink-0', info.color)}>
          <Icon className="h-5 w-5" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium truncate">{info.name}</h3>
            {item.access.type === 'password' && (
              <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {info.subtitle}
          </p>
        </div>

        {/* Date */}
        <div className="hidden sm:block text-sm text-muted-foreground shrink-0">
          {formatDate(item.createdAt)}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => selectItem(item)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            title="Preview"
          >
            <Eye className="h-4 w-4" />
          </button>
          {(item.content.type === 'file' || item.content.type === 'image') && (
            <button
              onClick={handleDownload}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              title="Download"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={copyShareUrl}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            title="Copy share link"
          >
            {copied ? (
              <span className="text-green-500 text-xs font-medium">Copied!</span>
            ) : (
              <Share2 className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={handleDelete}
            className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div
      className="group relative border rounded-xl overflow-hidden hover:shadow-lg transition-all cursor-pointer"
      onClick={() => selectItem(item)}
    >
      {/* Preview Area */}
      <div className="aspect-square bg-muted/50 flex items-center justify-center relative">
        {item.content.type === 'image' ? (
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        ) : (
          <div className={cn('p-6 rounded-2xl', info.color)}>
            <Icon className="h-12 w-12" />
          </div>
        )}

        {/* Quick Actions Overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              selectItem(item);
            }}
            className="p-2 bg-white rounded-lg hover:bg-gray-100 transition-colors"
            title="Preview"
          >
            <Eye className="h-5 w-5 text-gray-900" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              copyShareUrl();
            }}
            className="p-2 bg-white rounded-lg hover:bg-gray-100 transition-colors"
            title="Share"
          >
            <Share2 className="h-5 w-5 text-gray-900" />
          </button>
        </div>

        {/* Access Badge */}
        {item.access.type !== 'public' && (
          <div className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-lg">
            <Lock className="h-3.5 w-3.5 text-white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-medium truncate mb-1">{info.name}</h3>
        <p className="text-sm text-muted-foreground truncate">{info.subtitle}</p>
      </div>

      {/* Menu Button */}
      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="p-1.5 bg-black/50 rounded-lg hover:bg-black/70 transition-colors"
        >
          <MoreVertical className="h-4 w-4 text-white" />
        </button>

        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
              }}
            />
            <div className="absolute left-0 top-full mt-1 w-48 bg-popover border rounded-xl shadow-lg z-50 py-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  selectItem(item);
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted transition-colors"
              >
                <Eye className="h-4 w-4" />
                <span>Preview</span>
              </button>
              {(item.content.type === 'file' || item.content.type === 'image') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload();
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span>Download</span>
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  copyShareUrl();
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted transition-colors"
              >
                <Share2 className="h-4 w-4" />
                <span>Copy Share Link</span>
              </button>
              <div className="my-2 border-t" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-destructive/10 text-destructive transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60));
      return minutes <= 1 ? 'Just now' : `${minutes}m ago`;
    }
    return `${hours}h ago`;
  }
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}
