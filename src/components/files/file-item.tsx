import { FileTransfer } from '@/types/file';
import { Download, FileText, Image as ImageIcon, FileCode2, Archive } from 'lucide-react';

interface FileItemProps {
  file: FileTransfer;
  onDownload: (id: string) => void;
}

export function FileItem({ file, onDownload }: FileItemProps) {
  const getIcon = () => {
    switch (file.type) {
      case 'pdf': return <FileText className="w-5 h-5 text-red-400" />;
      case 'image': return <ImageIcon className="w-5 h-5 text-blue-400" />;
      case 'code': return <FileCode2 className="w-5 h-5 text-green-400" />;
      case 'zip': return <Archive className="w-5 h-5 text-purple-400" />;
      default: return <FileText className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 hover:bg-secondary/50 rounded-lg transition-colors group">
      <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center shrink-0 border border-border">
        {getIcon()}
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <span className="font-medium text-sm truncate text-foreground">{file.name}</span>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
          <span>{file.direction === 'received' ? 'From' : 'To'}: {file.senderName}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
          <span>{file.size}</span>
          <span>•</span>
          <span>{file.timestamp}</span>
        </div>
      </div>
      <button 
        onClick={() => onDownload(file.id)}
        className="w-8 h-8 rounded-full flex items-center justify-center text-primary opacity-0 group-hover:opacity-100 hover:bg-primary/10 transition-all"
        aria-label="Download file"
      >
        <Download className="w-4 h-4" />
      </button>
    </div>
  );
}
