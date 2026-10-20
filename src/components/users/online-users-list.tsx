import { User } from '@/types/user';
import { UserListItem } from './user-list-item';
import { Wifi, Radio } from 'lucide-react';

interface OnlineUsersListProps {
  users: User[];
  currentUser?: User | null;
  activeUserId?: string;
  onSelectUser: (user: User) => void;
}

export function OnlineUsersList({ users, currentUser, activeUserId, onSelectUser }: OnlineUsersListProps) {
  // Filter out the logged-in user: only show other peers on the LAN
  const peers = users.filter((user) => {
    if (!currentUser) return true;
    if (user.id === currentUser.id) return false;
    if (user.userId && currentUser.userId && user.userId === currentUser.userId) return false;
    if (user.name === currentUser.name) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-2 py-1 text-xs text-muted-foreground font-medium uppercase tracking-wider">
        <div className="flex items-center gap-1.5">
          <Wifi className="w-3.5 h-3.5 text-primary" />
          <span>LAN Peers ({peers.length})</span>
        </div>
        {peers.length > 0 && (
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
        )}
      </div>

      <div className="flex flex-col gap-1">
        {peers.length === 0 ? (
          <div className="p-3 text-center rounded-xl bg-secondary/50 border border-border/50 flex flex-col items-center gap-1.5 my-1">
            <Radio className="w-5 h-5 text-muted-foreground/60 animate-pulse" />
            <p className="text-xs font-medium text-foreground">No other peers online</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Open LanLink on another device on this LAN to chat.
            </p>
          </div>
        ) : (
          peers.map((user) => (
            <UserListItem
              key={user.id}
              user={user}
              isActive={user.id === activeUserId}
              onClick={() => onSelectUser(user)}
            />
          ))
        )}
      </div>
    </div>
  );
}
