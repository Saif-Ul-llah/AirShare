'use client';

import { useState } from 'react';
import {
  Plus,
  Upload,
  FileText,
  Code,
  Link as LinkIcon,
  FolderPlus,
  StickyNote,
  Image as ImageIcon
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface AddContentMenuProps {
  roomCode: string;
  onUploadClick: () => void;
  onTextClick?: () => void;
  onCodeClick?: () => void;
  onLinkClick?: () => void;
  onNoteClick?: () => void;
  onFolderClick?: () => void;
}

export function AddContentMenu({
  roomCode,
  onUploadClick,
  onTextClick,
  onCodeClick,
  onLinkClick,
  onNoteClick,
  onFolderClick
}: AddContentMenuProps) {
  const [showMenu, setShowMenu] = useState(false);

  const menuItems = [
    {
      icon: Upload,
      label: 'Upload Files',
      description: 'Add files from your device',
      onClick: onUploadClick,
      color: 'text-blue-500 bg-blue-500/10'
    },
    {
      icon: FileText,
      label: 'Text Snippet',
      description: 'Share plain text content',
      onClick: onTextClick,
      color: 'text-green-500 bg-green-500/10'
    },
    {
      icon: Code,
      label: 'Code Snippet',
      description: 'Share code with syntax highlighting',
      onClick: onCodeClick,
      color: 'text-purple-500 bg-purple-500/10'
    },
    {
      icon: LinkIcon,
      label: 'Web Link',
      description: 'Share a URL with preview',
      onClick: onLinkClick,
      color: 'text-orange-500 bg-orange-500/10'
    },
    {
      icon: StickyNote,
      label: 'Markdown Note',
      description: 'Rich text with formatting',
      onClick: onNoteClick,
      color: 'text-yellow-500 bg-yellow-500/10'
    },
    {
      icon: FolderPlus,
      label: 'New Folder',
      description: 'Organize your content',
      onClick: onFolderClick,
      color: 'text-slate-500 bg-slate-500/10'
    }
  ];

  return (
    <div className="relative">
      <Button
        onClick={() => setShowMenu(!showMenu)}
        className="gap-2"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">Add Content</span>
      </Button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-72 bg-popover border rounded-xl shadow-lg z-50 py-2 animate-slide-up">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  item.onClick?.();
                  setShowMenu(false);
                }}
                disabled={!item.onClick}
                className={cn(
                  'w-full flex items-start gap-3 px-4 py-3 hover:bg-muted transition-colors text-left',
                  !item.onClick && 'opacity-50 cursor-not-allowed'
                )}
              >
                <div className={cn('p-2 rounded-lg shrink-0', item.color)}>
                  <item.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm">{item.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
