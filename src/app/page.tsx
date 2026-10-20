'use client';

import { useState, useEffect } from 'react';
import { useSocket } from '@/components/providers/socket-provider';
import { AppHeader } from '@/components/app/app-header';
import { AppSidebar } from '@/components/app/app-sidebar';
import { BottomStatusBar } from '@/components/app/bottom-status-bar';
import { ChatWindow } from '@/components/chat/chat-window';
import { GroupChatWindow } from '@/components/groups/group-chat-window';
import { CreateGroupModal } from '@/components/groups/create-group-modal';
import { FileTransferPanel } from '@/components/files/file-transfer-panel';
import { AuthModal } from '@/components/auth/auth-modal';
import { Settings, ShieldCheck, Users, FolderGit2, Plus, MessageSquare, Radio } from 'lucide-react';
import { Group } from '@/types/group';

export default function Home() {
  const {
    currentUser,
    onlineUsers,
    groups,
    serverIps,
    isConnected,
    isAuthenticated,
    authLoading,
    roomRequired,
    onLoginSuccess,
    connectionError,
  } = useSocket();

  const [activeUserId, setActiveUserId] = useState<string | undefined>(undefined);
  const [activeGroupId, setActiveGroupId] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'chat' | 'files' | 'settings'>('chat');
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);

  // Peers on the LAN strictly excluding self
  const peers = onlineUsers.filter((u) => {
    if (!currentUser) return false;
    if (u.id === currentUser.id) return false;
    if (u.userId && currentUser.userId && u.userId === currentUser.userId) return false;
    if (u.name === currentUser.name) return false;
    return true;
  });

  // Keep active selection in sync: reset if target peer disconnected
  useEffect(() => {
    if (activeUserId && !peers.some((p) => p.id === activeUserId)) {
      setActiveUserId(undefined);
    }
  }, [peers, activeUserId]);

  // Keep group selection in sync: reset if group was deleted
  useEffect(() => {
    if (activeGroupId && !groups.some((g) => g.id === activeGroupId)) {
      setActiveGroupId(undefined);
    }
  }, [groups, activeGroupId]);

  if (authLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background text-foreground gap-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-muted-foreground">Checking authentication...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthModal roomRequired={roomRequired} onSuccess={onLoginSuccess} />;
  }

  if (!currentUser) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background text-foreground gap-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-muted-foreground">{isConnected ? "Joining LAN..." : "Connecting to LAN Server..."}</p>
        {connectionError && (
          <p className="text-destructive text-sm bg-destructive/10 p-3 rounded max-w-md text-center">
            Error: {connectionError}
          </p>
        )}
      </div>
    );
  }

  const activePeer = peers.find((u) => u.id === activeUserId);
  const activeGroup = groups.find((g) => g.id === activeGroupId);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden font-sans">
      <AppHeader />

      <div className="flex-1 flex overflow-hidden">
        <AppSidebar
          currentUser={currentUser}
          onlineUsers={onlineUsers}
          activeUserId={activeUserId}
          onSelectUser={(user) => {
            setActiveUserId(user.id);
            setActiveGroupId(undefined);
          }}
          groups={groups}
          activeGroupId={activeGroupId}
          onSelectGroup={(group: Group) => {
            setActiveGroupId(group.id);
            setActiveUserId(undefined);
          }}
          onCreateGroupClick={() => setIsCreateGroupOpen(true)}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <main className="flex-1 flex min-w-0 bg-background relative">
          {activeTab === 'chat' && (
            <>
              {activeGroup ? (
                /* Group Chat Window */
                <GroupChatWindow
                  group={activeGroup}
                  currentUser={currentUser}
                  onGroupDeleted={() => setActiveGroupId(undefined)}
                />
              ) : activePeer ? (
                /* 1-on-1 Peer Chat Window with Cross-Verification */
                <ChatWindow
                  currentUser={currentUser}
                  activeUser={activePeer}
                />
              ) : (
                /* Empty / Waiting state when no chat is selected (NO self-chat) */
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none overflow-y-auto">
                  <div className="max-w-lg w-full flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-200">
                    <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
                      <ShieldCheck className="w-8 h-8" />
                    </div>

                    <div className="space-y-2">
                      <h2 className="text-2xl font-bold text-foreground">
                        Welcome, {currentUser.name}!
                      </h2>
                      <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
                        Connected to secure LAN chat. Select a peer from the sidebar or host a password-protected group chat.
                      </p>
                      {serverIps.length > 0 && (
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary border border-border text-xs text-muted-foreground mt-2">
                          <Radio className="w-3.5 h-3.5 text-success" />
                          <span>Server IP: {serverIps[0]}:3000</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full text-left">
                      <div className="p-4 rounded-2xl bg-secondary/60 border border-border flex flex-col justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                            <Users className="w-4 h-4 text-primary" />
                            <span>Group Chats</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Host a group with a shared password. Any LAN member who knows the password can join.
                          </p>
                        </div>
                        <button
                          onClick={() => setIsCreateGroupOpen(true)}
                          className="w-full py-2 px-3 bg-primary text-primary-foreground text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow hover:bg-primary/90 transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Host Group Chat</span>
                        </button>
                      </div>

                      <div className="p-4 rounded-2xl bg-secondary/60 border border-border flex flex-col justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                            <MessageSquare className="w-4 h-4 text-primary" />
                            <span>1-on-1 Direct Chat</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {peers.length === 0
                              ? "Waiting for other devices to log in on this LAN. They will appear on the left."
                              : `${peers.length} other peer(s) online. Click on a peer to chat using their chat password.`}
                          </p>
                        </div>
                        {peers.length > 0 && (
                          <button
                            onClick={() => setActiveUserId(peers[0].id)}
                            className="w-full py-2 px-3 bg-secondary text-foreground border border-border text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 hover:bg-secondary/80 transition-all"
                          >
                            <span>Chat with {peers[0].name}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'files' && (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-card">
              <FileTransferPanel />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="flex-1 flex flex-col p-8 bg-background overflow-y-auto">
              <div className="max-w-2xl w-full mx-auto">
                <div className="flex items-center gap-3 mb-8">
                  <Settings className="w-8 h-8 text-primary" />
                  <h1 className="text-2xl font-semibold">Settings & Security</h1>
                </div>

                <div className="space-y-6">
                  <div className="p-6 bg-secondary rounded-xl border border-border">
                    <h2 className="text-lg font-medium mb-2">Cross-Verification Chat Security</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Every user sets their personal chat password in the left sidebar. Peers must enter your exact password to open a conversation with you.
                    </p>
                  </div>

                  <div className="p-6 bg-secondary rounded-xl border border-border">
                    <h2 className="text-lg font-medium mb-2">Host-Secured Group Chats</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Any user can host a group chat with a host-defined group password. Multiple users on LAN can participate in real-time messages and file transfers.
                    </p>
                  </div>

                  <div className="p-6 bg-secondary rounded-xl border border-border">
                    <h2 className="text-lg font-medium mb-2">FTP / FTPS Storage</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Embedded FTPS server on port 2121 with chroot isolation and authenticated LAN transfers.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Right Panel - Quick File Transfers */}
        {activeTab === 'chat' && (
          <div className="hidden lg:flex">
            <FileTransferPanel />
          </div>
        )}
      </div>

      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        onCreated={(g) => {
          setActiveGroupId(g.id);
          setActiveUserId(undefined);
        }}
      />

      <BottomStatusBar />
    </div>
  );
}
