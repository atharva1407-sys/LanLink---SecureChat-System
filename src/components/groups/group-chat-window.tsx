'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Group, GroupMessage as IGroupMessage } from '@/types/group';
import { User } from '@/types/user';
import { useSocket } from '@/components/providers/socket-provider';
import { Users, Lock, KeyRound, Eye, EyeOff, ShieldCheck, AlertCircle, Loader2, Trash2, ArrowLeft } from 'lucide-react';
import { ChatInput } from '../chat/chat-input';
import { ChatFileCard } from '../chat/chat-file-card';
import { cn } from '@/lib/utils';

interface GroupChatWindowProps {
  group: Group;
  currentUser: User;
  onBack?: () => void;
  onGroupDeleted?: (groupId: string) => void;
}

export function GroupChatWindow({ group, currentUser, onBack, onGroupDeleted }: GroupChatWindowProps) {
  const {
    groupMessages,
    joinGroup,
    sendGroupMessage,
    fetchGroupMessages,
    refreshGroups,
  } = useSocket();

  const isHost = Boolean(
    (group.host_id && group.host_id === currentUser.userId) ||
    (group.hostId && group.hostId === currentUser.userId) ||
    (group.host_name && group.host_name === currentUser.name) ||
    (group.hostName && group.hostName === currentUser.name)
  );

  const [unlocked, setUnlocked] = useState<boolean>(isHost);

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages: IGroupMessage[] = groupMessages[group.id] || [];

  // Join group room and fetch messages on mount / unlocked
  useEffect(() => {
    if (unlocked) {
      joinGroup(group.id);
      fetchGroupMessages(group.id);
    }
  }, [unlocked, group.id, joinGroup, fetchGroupMessages]);

  useEffect(() => {
    if (unlocked && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, unlocked]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter the host group password');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/groups/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: group.id,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Incorrect group password');
        return;
      }

      setUnlocked(true);
      joinGroup(group.id);
      fetchGroupMessages(group.id);
    } catch {
      setError('Network error verifying group password');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm(`Are you sure you want to delete "${group.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch('/api/groups/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: group.id }),
      });

      if (res.ok) {
        await refreshGroups();
        if (onGroupDeleted) {
          onGroupDeleted(group.id);
        }
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete group');
      }
    } catch {
      alert('Network error deleting group');
    }
  };

  const handleSendMessage = (text: string) => {
    sendGroupMessage({
      groupId: group.id,
      text,
    });
  };

  const handleSendFile = (fileAttachment: {
    fileId: string;
    name: string;
    size: string;
    type: 'pdf' | 'image' | 'code' | 'zip' | 'other';
    downloadUrl: string;
  }) => {
    sendGroupMessage({
      groupId: group.id,
      text: '',
      fileAttachment,
    });
  };

  const hostDisplayName = group.host_name || group.hostName || 'Host';

  // Group messages by date
  const groupedMessages = messages.reduce((acc, msg) => {
    const d = msg.date || 'Today';
    if (!acc[d]) {
      acc[d] = [];
    }
    acc[d].push(msg);
    return acc;
  }, {} as Record<string, IGroupMessage[]>);

  if (!unlocked) {
    return (
      <div className="flex flex-col h-full bg-background flex-1 min-w-0">
        <div className="h-16 border-b bg-background flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            {onBack && (
              <button onClick={onBack} className="md:hidden text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-sm flex items-center gap-1.5">
                <span>{group.name}</span>
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                  Host-Secured
                </span>
              </div>
              <span className="text-xs text-muted-foreground">Host: {hostDisplayName}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-4 bg-background select-none">
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-xl p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3 shadow-inner">
                <Lock className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-bold text-foreground">
                Enter Group Password
              </h2>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Host-defined security: Enter the password set by host <strong className="text-foreground">{hostDisplayName}</strong> to join <strong className="text-foreground">{group.name}</strong>.
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleUnlock} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Host-Defined Group Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password set by host..."
                    autoFocus
                    required
                    className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all pl-10 pr-10"
                  />
                  <KeyRound className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !password}
                className="w-full py-2.5 px-4 bg-primary text-primary-foreground font-semibold rounded-xl text-sm shadow hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Group Password...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Unlock & Join Group</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background flex-1 min-w-0">
      {/* Group Header */}
      <div className="h-16 border-b bg-background flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="md:hidden text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-sm flex items-center gap-1.5">
              <span>{group.name}</span>
              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                Password Secured
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Host: {hostDisplayName}</span>
              <span className="text-[10px] text-success font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                LAN Broadcast
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setUnlocked(false)}
            className="p-2 text-muted-foreground hover:text-warning hover:bg-secondary rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium"
            title="Lock this group chat"
          >
            <Lock className="w-4 h-4" />
            <span className="hidden sm:inline">Lock Group</span>
          </button>

          {isHost && (
            <button
              onClick={handleDeleteGroup}
              className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium"
              title="Delete group (host only)"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Delete Group</span>
            </button>
          )}
        </div>
      </div>

      {/* Group Message Stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col">
        <div className="max-w-4xl mx-auto w-full flex flex-col">
          {messages.length === 0 ? (
            <div className="my-auto py-12 flex flex-col items-center justify-center text-center gap-3 text-muted-foreground">
              <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground text-sm">Group &quot;{group.name}&quot; is ready!</h3>
              <p className="text-xs max-w-sm">
                This group is protected by the host password. Any messages or FTPS files sent here are broadcast to all authorized members.
              </p>
            </div>
          ) : (
            Object.entries(groupedMessages).map(([date, msgs]) => (
              <div key={date} className="flex flex-col">
                <div className="flex justify-center my-4">
                  <span className="text-[11px] font-medium px-3 py-1 bg-secondary rounded-full text-muted-foreground border border-border">
                    {date}
                  </span>
                </div>

                {msgs.map((msg) => {
                  const isOwn = (msg.senderUserId && msg.senderUserId === currentUser.userId) ||
                                (msg.senderName === currentUser.name);

                  return (
                    <div
                      key={msg.id}
                      className={cn("flex gap-3 w-full my-3", isOwn ? "justify-end" : "justify-start")}
                    >
                      {!isOwn && (
                        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-1">
                          {msg.senderName ? msg.senderName.substring(0, 2).toUpperCase() : 'U'}
                        </div>
                      )}

                      <div className={cn("flex flex-col max-w-[70%]", isOwn ? "items-end" : "items-start")}>
                        {!isOwn && (
                          <div className="flex items-center gap-2 mb-1 ml-1">
                            <span className="text-xs font-semibold text-primary">{msg.senderName}</span>
                            <span className="text-[10px] text-muted-foreground">{msg.timestamp}</span>
                          </div>
                        )}

                        {msg.text && (
                          <div
                            className={cn(
                              "px-4 py-2.5 rounded-2xl relative",
                              isOwn
                                ? "bg-accent text-accent-foreground rounded-tr-sm"
                                : "bg-secondary text-secondary-foreground rounded-tl-sm border border-border"
                            )}
                          >
                            <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</div>
                            {isOwn && (
                              <div className="flex items-center justify-end gap-1 mt-1 opacity-70">
                                <span className="text-[10px]">{msg.timestamp}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {msg.fileAttachment && (
                          <div className="w-full">
                            <ChatFileCard
                              fileId={msg.fileAttachment.fileId}
                              name={msg.fileAttachment.name}
                              size={msg.fileAttachment.size}
                              type={msg.fileAttachment.type}
                              downloadUrl={msg.fileAttachment.downloadUrl}
                              isOwn={isOwn}
                            />
                            {isOwn && !msg.text && (
                              <div className="flex items-center justify-end gap-1 mt-1 opacity-70 text-muted-foreground pr-1">
                                <span className="text-[10px]">{msg.timestamp}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Group Chat Input */}
      <ChatInput onSendMessage={handleSendMessage} onSendFile={handleSendFile} />
    </div>
  );
}
