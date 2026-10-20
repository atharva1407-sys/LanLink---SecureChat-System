export interface ChatMessage {
  id: string;
  senderId: string;
  senderName?: string;
  receiverId?: string;
  text?: string;
  timestamp: string;
  date: string;
  isRead?: boolean;
  isDelivered?: boolean;
  fileAttachment?: {
    fileId?: string;
    name: string;
    size: string;
    type: 'pdf' | 'image' | 'code' | 'zip' | 'other';
    downloadUrl?: string;
  };
}
