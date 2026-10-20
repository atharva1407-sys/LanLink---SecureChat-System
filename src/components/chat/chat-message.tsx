import { ChatMessage as IChatMessage } from '@/types/chat';
import { User } from '@/types/user';
import { cn } from '@/lib/utils';
import { Check, CheckCheck } from 'lucide-react';
import { ChatFileCard } from './chat-file-card';

interface ChatMessageProps {
  message: IChatMessage;
  sender?: User;
  isOwn: boolean;
}

const colors = [
  'bg-emerald-600',
  'bg-purple-600',
  'bg-orange-600',
  'bg-blue-600',
  'bg-teal-600',
];

export function ChatMessage({ message, sender, isOwn }: ChatMessageProps) {
  const showAvatar = !isOwn && sender;
  let avatarBg = 'bg-gray-600';
  if (sender) {
    const colorIndex = sender.name.length % colors.length;
    avatarBg = colors[colorIndex];
  }

  return (
    <div className={cn("flex gap-3 w-full my-4", isOwn ? "justify-end" : "justify-start")}>
      {showAvatar && (
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0 mt-1", avatarBg)}>
          {sender.initials}
        </div>
      )}
      
      <div className={cn("flex flex-col max-w-[70%]", isOwn ? "items-end" : "items-start")}>
        {!isOwn && sender && (
          <div className="flex items-center gap-2 mb-1 ml-1">
            <span className="text-sm font-medium text-foreground">{sender.name}</span>
            <span className="text-xs text-muted-foreground">{message.timestamp}</span>
          </div>
        )}
        
        {message.text && (
          <div className={cn(
            "px-4 py-2.5 rounded-2xl relative",
            isOwn 
              ? "bg-accent text-accent-foreground rounded-tr-sm" 
              : "bg-secondary text-secondary-foreground rounded-tl-sm border border-border"
          )}>
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.text}</div>
            
            {isOwn && (
              <div className="flex items-center justify-end gap-1 mt-1 opacity-70">
                <span className="text-[10px]">{message.timestamp}</span>
                {message.isRead ? (
                  <CheckCheck className="w-3 h-3 text-blue-300" />
                ) : message.isDelivered ? (
                  <CheckCheck className="w-3 h-3" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
              </div>
            )}
          </div>
        )}

        {message.fileAttachment && (
          <div className="w-full">
            <ChatFileCard 
              fileId={message.fileAttachment.fileId}
              name={message.fileAttachment.name}
              size={message.fileAttachment.size}
              type={message.fileAttachment.type}
              downloadUrl={message.fileAttachment.downloadUrl}
              isOwn={isOwn}
            />
            {isOwn && !message.text && (
              <div className="flex items-center justify-end gap-1 mt-1 opacity-70 text-muted-foreground pr-1">
                <span className="text-[10px]">{message.timestamp}</span>
                {message.isRead ? (
                  <CheckCheck className="w-3 h-3 text-blue-400" />
                ) : message.isDelivered ? (
                  <CheckCheck className="w-3 h-3" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
