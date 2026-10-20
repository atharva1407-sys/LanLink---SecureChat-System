import { useState, useRef, useEffect } from 'react';
import { User } from '@/types/user';
import { ArrowLeft, Search, MoreVertical, Trash2, Lock, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSocket } from '@/components/providers/socket-provider';

interface ChatHeaderProps {
  user: User;
  onBack?: () => void;
  isLocked?: boolean;
  onLockChat?: () => void;
}

const colors = [
  'bg-emerald-600',
  'bg-purple-600',
  'bg-orange-600',
  'bg-blue-600',
  'bg-teal-600',
];

export function ChatHeader({ user, onBack, isLocked, onLockChat }: ChatHeaderProps) {
  const { clearChat } = useSocket();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const colorIndex = user.name.length % colors.length;
  const avatarBg = colors[colorIndex];

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClearChat = () => {
    if (window.confirm(`Are you sure you want to clear your chat with ${user.name}?`)) {
      clearChat(user.id);
      setShowMenu(false);
    }
  };

  return (
    <div className="h-16 border-b bg-background flex items-center justify-between px-4 shrink-0 relative">
      <div className="flex items-center gap-4">
        {onBack && (
          <button onClick={onBack} className="md:hidden text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white font-medium", avatarBg)}>
          {user.initials}
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{user.name}</span>
            <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              <ShieldCheck className="w-3 h-3" />
              <span>Password Protected</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{user.ip}</span>
            {user.isOnline && (
              <span className="text-xs text-success font-medium">Online</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 text-muted-foreground">
        <button className="p-2 hover:bg-secondary rounded-full transition-colors" aria-label="Search">
          <Search className="w-5 h-5" />
        </button>
        
        <div className="relative" ref={menuRef}>
          <button 
            className="p-2 hover:bg-secondary rounded-full transition-colors" 
            aria-label="More options"
            onClick={() => setShowMenu(!showMenu)}
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 divide-y divide-border">
              {!isLocked && onLockChat && (
                <button
                  onClick={() => {
                    onLockChat();
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-foreground hover:bg-secondary transition-colors"
                >
                  <Lock className="w-4 h-4 text-warning" />
                  <span>Lock This Chat</span>
                </button>
              )}
              <button
                onClick={handleClearChat}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-destructive hover:bg-secondary transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear Chat History</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
