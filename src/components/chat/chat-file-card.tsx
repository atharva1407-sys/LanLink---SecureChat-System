import { useState } from 'react';
import { FileText, Image as ImageIcon, FileCode2, Archive, Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatFileCardProps {
  fileId?: string;
  name: string;
  size: string;
  type: 'pdf' | 'image' | 'code' | 'zip' | 'other';
  downloadUrl?: string;
  isOwn?: boolean;
}

export function ChatFileCard({ fileId, name, size, type, downloadUrl, isOwn }: ChatFileCardProps) {
  const [downloading, setDownloading] = useState(false);

  const getIcon = () => {
    switch (type) {
      case 'pdf': return <FileText className="w-6 h-6 text-red-400" />;
      case 'image': return <ImageIcon className="w-6 h-6 text-blue-400" />;
      case 'code': return <FileCode2 className="w-6 h-6 text-green-400" />;
      case 'zip': return <Archive className="w-6 h-6 text-purple-400" />;
      default: return <FileText className="w-6 h-6 text-gray-400" />;
    }
  };

  const handleDownload = async () => {
    const targetUrl = downloadUrl || (fileId ? `/api/files/download?id=${encodeURIComponent(fileId)}` : null);
    if (!targetUrl) return;

    setDownloading(true);
    try {
      const link = document.createElement('a');
      link.href = targetUrl;
      link.setAttribute('download', name);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Download failed:', e);
    } finally {
      setTimeout(() => setDownloading(false), 800);
    }
  };

  return (
    <div className={cn(
      "flex items-center justify-between gap-3 p-3 rounded-lg border max-w-sm mt-1 transition-all",
      isOwn ? "bg-accent/50 border-accent/20" : "bg-card border-border"
    )}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-12 h-12 rounded bg-secondary/80 flex items-center justify-center shrink-0">
          {getIcon()}
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-medium text-sm truncate" title={name}>{name}</span>
          <span className="text-xs text-muted-foreground">{size}</span>
        </div>
      </div>

      {(downloadUrl || fileId) && (
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="p-2 rounded-lg hover:bg-secondary text-primary transition-colors shrink-0 disabled:opacity-50"
          title={`Download ${name}`}
          aria-label="Download file"
        >
          {downloading ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          ) : (
            <Download className="w-4 h-4" />
          )}
        </button>
      )}
    </div>
  );
}
