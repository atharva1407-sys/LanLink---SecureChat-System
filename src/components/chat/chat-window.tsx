import { useState, useEffect, useRef } from 'react';
import { User } from '@/types/user';
import { ChatMessage as IChatMessage } from '@/types/chat';
import { ChatHeader } from './chat-header';
import { ChatMessage } from './chat-message';
import { ChatInput } from './chat-input';
import { ChatPasswordGate } from './chat-password-gate';
import { useSocket } from '@/components/providers/socket-provider';

interface ChatWindowProps {
  currentUser: User;
  activeUser: User;
  onBack?: () => void;
}

export function ChatWindow({ currentUser, activeUser, onBack }: ChatWindowProps) {
  const { messages: allMessages, sendMessage } = useSocket();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [unlockedChats, setUnlockedChats] = useState<Record<string, boolean>>({});

  const isUnlocked = !!unlockedChats[activeUser.id];

  // Filter messages to only show those between current user and active user
  const messages = allMessages.filter(
    (msg) => 
      (msg.senderId === currentUser.id && msg.receiverId === activeUser.id) || 
      (msg.senderId === activeUser.id && msg.receiverId === currentUser.id)
  );

  useEffect(() => {
    // Scroll to bottom when messages change
    if (isUnlocked && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isUnlocked]);

  const handleSendMessage = async (text: string) => {
    sendMessage({
      receiverId: activeUser.id,
      text,
    });
  };

  const handleSendFile = async (fileAttachment: {
    fileId: string;
    name: string;
    size: string;
    type: 'pdf' | 'image' | 'code' | 'zip' | 'other';
    downloadUrl: string;
  }) => {
    sendMessage({
      receiverId: activeUser.id,
      text: '',
      fileAttachment,
    });
  };

  // Group messages by date
  const groupedMessages = messages.reduce((acc, msg) => {
    const date = msg.date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(msg);
    return acc;
  }, {} as Record<string, IChatMessage[]>);

  if (!isUnlocked) {
    return (
      <div className="flex flex-col h-full bg-background flex-1 min-w-0">
        <ChatHeader user={activeUser} onBack={onBack} isLocked={true} />
        <ChatPasswordGate
          activeUser={activeUser}
          onUnlocked={() => setUnlockedChats(prev => ({ ...prev, [activeUser.id]: true }))}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background flex-1 min-w-0">
      <ChatHeader
        user={activeUser}
        onBack={onBack}
        isLocked={false}
        onLockChat={() => setUnlockedChats(prev => ({ ...prev, [activeUser.id]: false }))}
      />
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 flex flex-col"
      >
        <div className="max-w-4xl mx-auto w-full flex flex-col">
          {Object.entries(groupedMessages).map(([date, msgs]) => (
            <div key={date} className="flex flex-col">
              <div className="flex justify-center my-6">
                <span className="text-[11px] font-medium px-3 py-1 bg-secondary rounded-full text-muted-foreground border border-border">
                  {date}
                </span>
              </div>
              
              {msgs.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  sender={msg.senderId === currentUser.id ? currentUser : activeUser}
                  isOwn={msg.senderId === currentUser.id}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <ChatInput onSendMessage={handleSendMessage} onSendFile={handleSendFile} />
    </div>
  );
}
