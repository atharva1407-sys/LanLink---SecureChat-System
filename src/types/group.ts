export interface Group {
  id: string;
  name: string;
  host_id?: string;
  hostId?: string;
  host_name?: string;
  hostName?: string;
  created_at?: number;
  createdAt?: number;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  senderUserId?: string;
  senderName: string;
  text?: string;
  timestamp: string;
  date: string;
  fileAttachment?: {
    fileId?: string;
    name: string;
    size: string;
    type: 'pdf' | 'image' | 'code' | 'zip' | 'other';
    downloadUrl?: string;
  };
}
