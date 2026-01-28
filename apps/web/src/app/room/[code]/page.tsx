'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Upload,
  FileText,
  Code,
  Link as LinkIcon,
  Image as ImageIcon,
  FolderPlus,
  Plus,
  Grid3X3,
  List,
  Search,
  Loader2
} from 'lucide-react';
import { useRoomStore, useAuthStore } from '@/lib/stores';
import { useWebSocket } from '@/providers/WebSocketProvider';
import { RoomHeader } from '@/components/room/RoomHeader';
import { ItemGrid } from '@/components/items/ItemGrid';
import { FileUploader } from '@/components/items/FileUploader';
import { AddTextDialog } from '@/components/items/AddTextDialog';
import { AddCodeDialog } from '@/components/items/AddCodeDialog';
import { AddLinkDialog } from '@/components/items/AddLinkDialog';
import { AddNoteDialog } from '@/components/items/AddNoteDialog';
import { AddContentMenu } from '@/components/room/AddContentMenu';
import { PresenceSidebar } from '@/components/room/PresenceSidebar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

type ViewMode = 'grid' | 'list';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const {
    currentRoom,
    items,
    presence,
    isLoading,
    error,
    joinRoom,
    leaveRoom,
    clearError
  } = useRoomStore();
  const { user } = useAuthStore();
  const { joinRoom: wsJoinRoom, leaveRoom: wsLeaveRoom, isConnected } = useWebSocket();

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploader, setShowUploader] = useState(false);
  const [showTextDialog, setShowTextDialog] = useState(false);
  const [showCodeDialog, setShowCodeDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Join room on mount
  useEffect(() => {
    if (code && !currentRoom) {
      joinRoom(code).then((success) => {
        if (!success) {
          // Check if password is required
          if (error?.toLowerCase().includes('password')) {
            setNeedsPassword(true);
          }
        }
      });
    }

    return () => {
      leaveRoom();
      wsLeaveRoom();
    };
  }, [code]);

  // Join WebSocket room when connected
  useEffect(() => {
    if (isConnected && currentRoom) {
      wsJoinRoom(currentRoom.code, user?.displayName);
    }
  }, [isConnected, currentRoom, user?.displayName, wsJoinRoom]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    clearError();

    const success = await joinRoom(code, password);
    if (success) {
      setNeedsPassword(false);
      setPassword('');
    } else {
      setPasswordError('Invalid password');
    }
  };

  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();

    // Search in content based on type
    if (item.content.type === 'file') {
      return item.content.data.filename.toLowerCase().includes(query);
    }
    if (item.content.type === 'folder') {
      return item.content.data.name.toLowerCase().includes(query);
    }
    if (item.content.type === 'text') {
      return item.content.data.content.toLowerCase().includes(query);
    }
    if (item.content.type === 'link') {
      return (
        item.content.data.url.toLowerCase().includes(query) ||
        item.content.data.title?.toLowerCase().includes(query)
      );
    }
    if (item.content.type === 'code') {
      return (
        item.content.data.content.toLowerCase().includes(query) ||
        item.content.data.filename?.toLowerCase().includes(query)
      );
    }
    if (item.content.type === 'note') {
      return (
        item.content.data.title.toLowerCase().includes(query) ||
        item.content.data.content.toLowerCase().includes(query)
      );
    }
    return false;
  });

  // Loading state
  if (isLoading && !currentRoom) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Joining room...</p>
        </div>
      </div>
    );
  }

  // Password prompt
  if (needsPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full">
          <div className="bg-card border rounded-2xl p-8 text-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <svg className="h-8 w-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2">Password Required</h1>
            <p className="text-muted-foreground mb-6">
              This room is protected. Enter the password to continue.
            </p>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <Input
                type="password"
                placeholder="Enter room password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-center"
                autoFocus
              />
              {passwordError && (
                <p className="text-sm text-destructive">{passwordError}</p>
              )}
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.push('/')}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={password.length < 4}
                  isLoading={isLoading}
                >
                  Join Room
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !currentRoom) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center">
          <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <svg className="h-8 w-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">Room Not Found</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => router.push('/')}>
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  if (!currentRoom) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Room Header */}
      <RoomHeader
        room={currentRoom}
        presenceCount={presence.length}
        isConnected={isConnected}
      />

      {/* Main Layout with Sidebar */}
      <div className="flex-1 flex">
        {/* Main Content */}
        <main className="flex-1 container mx-auto px-4 py-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* View Toggle & Actions */}
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center border rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-2 rounded-md transition-colors',
                  viewMode === 'grid'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-2 rounded-md transition-colors',
                  viewMode === 'list'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            {/* Add Content */}
            <AddContentMenu
              roomCode={code}
              onUploadClick={() => setShowUploader(true)}
              onTextClick={() => setShowTextDialog(true)}
              onCodeClick={() => setShowCodeDialog(true)}
              onLinkClick={() => setShowLinkDialog(true)}
              onNoteClick={() => setShowNoteDialog(true)}
            />
          </div>
        </div>

        {/* File Uploader (when active) */}
        {showUploader && (
          <div className="mb-6">
            <FileUploader
              roomCode={code}
              onClose={() => setShowUploader(false)}
            />
          </div>
        )}

        {/* Items Display */}
        {filteredItems.length === 0 ? (
          <EmptyState
            hasSearch={!!searchQuery}
            onUploadClick={() => setShowUploader(true)}
            onTextClick={() => setShowTextDialog(true)}
            onCodeClick={() => setShowCodeDialog(true)}
            onLinkClick={() => setShowLinkDialog(true)}
          />
        ) : (
          <ItemGrid
            items={filteredItems}
            viewMode={viewMode}
          />
        )}
      </main>

        {/* Presence Sidebar - Hidden on mobile */}
        <PresenceSidebar className="hidden lg:block w-64 shrink-0" />
      </div>

      {/* Content Creation Dialogs */}
      <AddTextDialog
        open={showTextDialog}
        onOpenChange={setShowTextDialog}
        roomCode={code}
      />
      <AddCodeDialog
        open={showCodeDialog}
        onOpenChange={setShowCodeDialog}
        roomCode={code}
      />
      <AddLinkDialog
        open={showLinkDialog}
        onOpenChange={setShowLinkDialog}
        roomCode={code}
      />
      <AddNoteDialog
        open={showNoteDialog}
        onOpenChange={setShowNoteDialog}
        roomCode={code}
      />
    </div>
  );
}

function EmptyState({
  hasSearch,
  onUploadClick,
  onTextClick,
  onCodeClick,
  onLinkClick
}: {
  hasSearch: boolean;
  onUploadClick: () => void;
  onTextClick: () => void;
  onCodeClick: () => void;
  onLinkClick: () => void;
}) {
  if (hasSearch) {
    return (
      <div className="text-center py-16">
        <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">No results found</h3>
        <p className="text-muted-foreground">
          Try a different search term
        </p>
      </div>
    );
  }

  return (
    <div className="text-center py-16">
      <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
        <Upload className="h-10 w-10 text-primary" />
      </div>
      <h3 className="text-xl font-semibold mb-2">This room is empty</h3>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
        Drag and drop files here, or use the buttons below to add content
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={onUploadClick}>
          <Upload className="h-4 w-4" />
          Upload Files
        </Button>
        <Button variant="outline" onClick={onTextClick}>
          <FileText className="h-4 w-4" />
          Add Text
        </Button>
        <Button variant="outline" onClick={onCodeClick}>
          <Code className="h-4 w-4" />
          Add Code
        </Button>
        <Button variant="outline" onClick={onLinkClick}>
          <LinkIcon className="h-4 w-4" />
          Add Link
        </Button>
      </div>
    </div>
  );
}
