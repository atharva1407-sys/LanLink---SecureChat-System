export interface FileTransfer {
  id: string;
  name: string;
  senderName: string;
  size: string;
  timestamp: string;
  type: 'pdf' | 'image' | 'code' | 'zip' | 'other';
  direction: 'received' | 'sent';
  downloadUrl?: string;
}
