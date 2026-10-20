import { useState, useRef, KeyboardEvent, ChangeEvent } from 'react';
import { Paperclip, Send, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  onSendFile?: (fileData: {
    fileId: string;
    name: string;
    size: string;
    type: 'pdf' | 'image' | 'code' | 'zip' | 'other';
    downloadUrl: string;
  }) => void;
}

export function ChatInput({ onSendMessage, onSendFile }: ChatInputProps) {
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (text.trim()) {
      onSendMessage(text.trim());
      setText('');
      setUploadError(null);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
        setUploadError(data.error || 'Failed to upload file to FTP storage');
        return;
      }

      if (onSendFile && data.file) {
        onSendFile({
          fileId: data.file.id,
          name: data.file.name,
          size: data.file.size,
          type: data.file.type,
          downloadUrl: data.file.downloadUrl,
        });
      }
    } catch {
      setUploadError('Network error uploading file over LAN');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="p-4 bg-background border-t shrink-0">
      {uploadError && (
        <div className="max-w-4xl mx-auto mb-2 p-2 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
          <button
            onClick={() => setUploadError(null)}
            className="hover:underline text-[11px] font-medium ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 max-w-4xl mx-auto bg-secondary border border-border rounded-lg p-1.5 focus-within:ring-1 focus-within:ring-primary/50 transition-shadow">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />

        <button 
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-background rounded-md transition-colors disabled:opacity-50"
          aria-label="Attach file"
          title="Attach and send file via FTP"
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          ) : (
            <Paperclip className="w-5 h-5" />
          )}
        </button>

        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={uploading ? "Uploading file to FTP server..." : "Type a message..."}
          disabled={uploading}
          className="flex-1 bg-transparent border-none outline-none text-sm px-2 text-foreground placeholder:text-muted-foreground disabled:opacity-50"
        />

        <button
          onClick={handleSend}
          disabled={!text.trim() || uploading}
          className={cn(
            "p-2 rounded-md transition-colors flex items-center justify-center",
            text.trim() && !uploading
              ? "bg-primary text-primary-foreground hover:bg-primary/90" 
              : "text-muted-foreground bg-background"
          )}
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
