'use client';

import { User } from '@/types/user';
import { Group } from '@/types/group';
import { UserProfileCard } from '../users/user-profile-card';
import { OnlineUsersList } from '../users/online-users-list';
import { MessageSquare, FolderGit2, Settings, Users, Plus, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppSidebarProps {
  currentUser: User;
  onlineUsers: User[];
  activeUserId?: string;
  onSelectUser: (user: User) => void;
  groups: Group[];
  activeGroupId?: string;
  onSelectGroup: (group: Group) => void;
  onCreateGroupClick: () => void;
  activeTab: 'chat' | 'files' | 'settings';
  onTabChange: (tab: 'chat' | 'files' | 'settings') => void;
}

export function AppSidebar({
  currentUser,
  onlineUsers,
  activeUserId,
  onSelectUser,
  groups,
  activeGroupId,
  onSelectGroup,
  onCreateGroupClick,
  activeTab,
  onTabChange,
}: AppSidebarProps) {
  return (
    <aside className="w-64 border-r bg-background flex flex-col shrink-0 select-none">
      <div className="p-4 flex flex-col gap-6 flex-1 overflow-y-auto">
        <UserProfileCard user={currentUser} />

        {/* 1-on-1 LAN Peers List (Never contains self) */}
        <OnlineUsersList
          users={onlineUsers}
          currentUser={currentUser}
          activeUserId={activeUserId}
          onSelectUser={(user) => {
            onSelectUser(user);
            onTabChange('chat');
          }}
        />

        {/* LAN Group Chats Section */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-2 py-1 text-xs text-muted-foreground font-medium uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-primary" />
              <span>Groups ({groups.length})</span>
            </div>
            <button
              onClick={onCreateGroupClick}
              className="text-primary hover:text-primary/80 text-[11px] font-semibold flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-all"
              title="Create a password-protected group chat"
            >
              <Plus className="w-3 h-3" />
              <span>Host</span>
            </button>
          </div>

          <div className="flex flex-col gap-1">
            {groups.length === 0 ? (
              <div className="p-3 text-center rounded-xl bg-secondary/40 border border-border/50 text-[11px] text-muted-foreground flex flex-col items-center gap-1">
                <span>No active groups.</span>
                <button
                  onClick={onCreateGroupClick}
                  className="text-primary font-medium hover:underline text-[11px]"
                >
                  + Host a Group Chat
                </button>
              </div>
            ) : (
              groups.map((group) => {
                const isActive = activeGroupId === group.id;
                const hostName = group.host_name || group.hostName || 'Host';
                return (
                  <button
                    key={group.id}
                    onClick={() => {
                      onSelectGroup(group);
                      onTabChange('chat');
                    }}
                    className={cn(
                      "flex items-center gap-2.5 p-2 rounded-xl text-left transition-all border w-full",
                      isActive
                        ? "bg-accent text-accent-foreground border-primary/30 shadow-sm"
                        : "hover:bg-secondary border-transparent text-foreground"
                    )}
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold truncate">{group.name}</span>
                        <Shield className="w-3 h-3 text-primary shrink-0 opacity-70" />
                      </div>
                      <span className="text-[10px] text-muted-foreground truncate">
                        Host: {hostName}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="p-3 border-t bg-background flex flex-col gap-1">
        <button
          onClick={() => onTabChange('chat')}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium",
            activeTab === 'chat' ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Chat</span>
        </button>
        <button
          onClick={() => onTabChange('files')}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium",
            activeTab === 'files' ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          <FolderGit2 className="w-4 h-4" />
          <span>File Transfers</span>
        </button>
        <button
          onClick={() => onTabChange('settings')}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium",
            activeTab === 'settings' ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}
