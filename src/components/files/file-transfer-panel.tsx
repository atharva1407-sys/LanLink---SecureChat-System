import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { Upload, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { FileTransfer } from '@/types/file';
import { FileItem } from './file-item';
import { cn } from '@/lib/utils';
import { useSocket } from '@/components/providers/socket-provider';

interface SharedApiFile {
  id: string;
  name: string;
  size: string;
  type: 'pdf' | 'image' | 'code' | 'zip' | 'other';
  uploaderName: string;
  uploadedAt: number;
  downloadUrl: string;
}

export function FileTransferPanel() {
  const { messages, currentUser, onlineUsers, sendMessage } = useSocket();
  const [activeTab, setActiveTab] = useState<'received' | 'sent' | 'all'>('received');
  const [sharedFiles, setSharedFiles] = useState<FileTransfer[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch all shared files on the FTP storage periodically
  const fetchSharedFiles = async () => {
    try {
      const res = await fetch('/api/files/list');
      if (res.ok) {
        const data = await res.json();
        if (data.files) {
          const mapped: FileTransfer[] = data.files.map((f: SharedApiFile) => ({
            id: f.id,
            name: f.name,
            senderName: f.uploaderName === currentUser?.name ? 'You' : f.uploaderName,
            size: f.size,
            timestamp: new Date(f.uploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: f.type,
            direction: f.uploaderName === currentUser?.name ? 'sent' : 'received',
            downloadUrl: f.downloadUrl,
          }));
          setSharedFiles(mapped);
        }
      }
    } catch {
      // Non-blocking
    }
  };

  useEffect(() => {
    fetchSharedFiles();
    const interval = setInterval(fetchSharedFiles, 10000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Derive files from live chat messages
  const chatFiles: FileTransfer[] = messages
    .filter((msg) => msg.fileAttachment)
    .map((msg) => {
      const isSent = msg.senderId === currentUser?.id;
      const otherUserId = isSent ? msg.receiverId : msg.senderId;
      const otherUser = onlineUsers.find(u => u.id === otherUserId);
      return {
        id: msg.fileAttachment!.fileId || msg.id,
        name: msg.fileAttachment!.name,
        senderName: isSent ? 'You' : (otherUser?.name || 'Unknown'),
        size: msg.fileAttachment!.size,
        timestamp: msg.timestamp,
        type: msg.fileAttachment!.type,
        direction: isSent ? 'sent' : 'received',
        downloadUrl: msg.fileAttachment!.downloadUrl || `/api/files/download?id=${msg.fileAttachment!.fileId || msg.id}`,
      };
    });

  // Merge unique files
  const allFilesMap = new Map<string, FileTransfer>();
  sharedFiles.forEach(f => allFilesMap.set(f.id, f));
  chatFiles.forEach(f => allFilesMap.set(f.id, f));
  const files = Array.from(allFilesMap.values());

  const handleDownload = (id: string) => {
    const file = files.find(f => f.id === id);
    const url = file?.downloadUrl || `/api/files/download?id=${encodeURIComponent(id)}`;
    const link = document.createElement('a');
    link.href = url;
    if (file?.name) link.setAttribute('download', file.name);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearAll = async () => {
    if (files.length === 0) return;
    if (window.confirm('Are you sure you want to clear all files from the FTP file sharing page?')) {
      try {
        const res = await fetch('/api/files/clear', { method: 'POST' });
        if (res.ok) {
          setSharedFiles([]);
        }
      } catch (err) {
        console.error('Failed to clear files:', err);
      }
    }
  };

  const handleSendFileClick = () => {
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.error || 'File upload failed');
        return;
      }

      // If other users are online, broadcast to active chat partner
      const targetUser = onlineUsers.find(u => u.id !== currentUser?.id);
      if (targetUser && data.file) {
        sendMessage({
          receiverId: targetUser.id,
          text: '',
          fileAttachment: {
            fileId: data.file.id,
            name: data.file.name,
            size: data.file.size,
            type: data.file.type,
            downloadUrl: data.file.downloadUrl,
          },
        });
      }

      // Refresh list
      fetchSharedFiles();
    } catch {
      setUploadError('Network error uploading file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const filteredFiles = activeTab === 'all'
    ? files
    : files.filter(f => f.direction === activeTab);

  return (
    <div className="w-80 border-l bg-background flex flex-col shrink-0">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground text-sm">FTP File Transfers</h2>
          <div className="flex items-center gap-1.5">
            {files.length > 0 && (
              <button 
                onClick={handleClearAll}
                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                title="Clear all files"
                aria-label="Clear all files"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button 
              onClick={handleSendFileClick}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>Send File</span>
            </button>
          </div>
        </div>

        {uploadError && (
          <div className="p-2 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-xs flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">{uploadError}</span>
          </div>
        )}

        <div className="flex bg-secondary p-1 rounded-lg border border-border">
          <button
            onClick={() => setActiveTab('received')}
            className={cn(
              "flex-1 text-xs font-medium py-1.5 rounded-md transition-colors",
              activeTab === 'received' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Received
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={cn(
              "flex-1 text-xs font-medium py-1.5 rounded-md transition-colors",
              activeTab === 'sent' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Sent
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={cn(
              "flex-1 text-xs font-medium py-1.5 rounded-md transition-colors",
              activeTab === 'all' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            All ({files.length})
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        <div className="flex flex-col gap-1">
          {filteredFiles.map(file => (
            <FileItem key={file.id} file={file} onDownload={handleDownload} />
          ))}
          {filteredFiles.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              {uploading ? 'Uploading file...' : `No files ${activeTab === 'all' ? 'found' : activeTab}`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
