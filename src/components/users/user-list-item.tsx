import { User } from '@/types/user';
import { cn } from '@/lib/utils';

interface UserListItemProps {
  user: User;
  isActive?: boolean;
  onClick?: () => void;
}

const colors = [
  'bg-emerald-600',
  'bg-purple-600',
  'bg-orange-600',
  'bg-blue-600',
  'bg-teal-600',
];

export function UserListItem({ user, isActive, onClick }: UserListItemProps) {
  // Simple hash for deterministic color
  const colorIndex = user.name.length % colors.length;
  const avatarBg = colors[colorIndex];

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left",
        isActive ? "bg-accent/50" : "hover:bg-secondary"
      )}
    >
      <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-white font-medium text-sm", avatarBg)}>
        {user.initials}
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <span className="font-medium text-sm truncate">{user.name}</span>
        <span className="text-xs text-muted-foreground truncate">{user.ip}</span>
      </div>
      {user.isOnline && (
        <div className="w-2 h-2 rounded-full bg-success shrink-0"></div>
      )}
    </button>
  );
}
