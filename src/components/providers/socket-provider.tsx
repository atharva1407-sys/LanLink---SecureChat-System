'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { User } from '@/types/user';
import { ChatMessage } from '@/types/chat';
import { Group, GroupMessage } from '@/types/group';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  currentUser: User | null;
  onlineUsers: User[];
  messages: ChatMessage[];
  groups: Group[];
  groupMessages: Record<string, GroupMessage[]>;
  connectionError: string | null;
  serverIps: string[];
  isAuthenticated: boolean;
  authLoading: boolean;
  roomRequired: boolean;
  onLoginSuccess: (user: { id: string; username: string }) => void;
  logout: () => Promise<void>;
  sendMessage: (msg: { receiverId: string; text?: string; fileAttachment?: unknown }) => void;
  updateName: (newName: string) => void;
  clearChat: (otherUserId: string) => void;
  joinGroup: (groupId: string) => void;
  leaveGroup: (groupId: string) => void;
  sendGroupMessage: (msg: { groupId: string; text?: string; fileAttachment?: unknown }) => void;
  fetchGroupMessages: (groupId: string) => Promise<void>;
  refreshGroups: () => Promise<void>;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  currentUser: null,
  onlineUsers: [],
  messages: [],
  groups: [],
  groupMessages: {},
  connectionError: null,
  serverIps: [],
  isAuthenticated: false,
  authLoading: true,
  roomRequired: false,
  onLoginSuccess: () => {},
  logout: async () => {},
  sendMessage: () => {},
  updateName: () => {},
  clearChat: () => {},
  joinGroup: () => {},
  leaveGroup: () => {},
  sendGroupMessage: () => {},
  fetchGroupMessages: async () => {},
  refreshGroups: async () => {},
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupMessages, setGroupMessages] = useState<Record<string, GroupMessage[]>>({});
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [serverIps, setServerIps] = useState<string[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [roomRequired, setRoomRequired] = useState(false);

  // Check existing session on load
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.roomRequired !== undefined) {
        setRoomRequired(data.roomRequired);
      }
      if (data.authenticated && data.user) {
        setIsAuthenticated(true);
        setCurrentUser({
          id: data.user.id,
          userId: data.user.id,
          name: data.user.username,
          initials: data.user.username.substring(0, 2).toUpperCase(),
          ip: '',
          isOnline: true,
        });
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
    } catch (err) {
      console.warn('Failed to verify session:', err);
      setIsAuthenticated(false);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const refreshGroups = useCallback(async () => {
    try {
      const res = await fetch('/api/groups/list');
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups || []);
      }
    } catch (e) {
      console.warn('Failed to refresh groups:', e);
    }
  }, []);

  const fetchGroupMessages = useCallback(async (groupId: string) => {
    try {
      const res = await fetch(`/api/groups/messages?groupId=${encodeURIComponent(groupId)}`);
      if (res.ok) {
        const data = await res.json();
        setGroupMessages((prev) => ({
          ...prev,
          [groupId]: data.messages || [],
        }));
      }
    } catch (e) {
      console.warn('Failed to fetch group messages:', e);
    }
  }, []);

  // Connect Socket.IO when authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setIsConnected(false);
      return;
    }

    const socketInstance = io({
      autoConnect: true,
      withCredentials: true,
      transports: ['polling', 'websocket'],
    });

    setSocket(socketInstance);

    socketInstance.on('connect_error', (err) => {
      console.warn('Socket connect error:', err.message);
      setConnectionError(err.message || 'Connection failed');
      if (err.message.includes('Authentication required') || err.message.includes('expired')) {
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
    });

    socketInstance.on('connect', () => {
      setConnectionError(null);
      setIsConnected(true);
      refreshGroups();
    });

    socketInstance.on('disconnect', (reason) => {
      setIsConnected(false);
      if (reason === 'io server disconnect') {
        socketInstance.connect();
      }
    });

    socketInstance.on('current_user', (user: User) => {
      setCurrentUser(user);
    });

    socketInstance.on('server_ips', (ips: string[]) => {
      setServerIps(ips);
    });

    socketInstance.on('users_update', (users: User[]) => {
      setOnlineUsers(users);
    });

    socketInstance.on('groups_update', (allGroups: Group[]) => {
      setGroups(allGroups || []);
    });

    socketInstance.on('receive_message', (msg: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    socketInstance.on('group_message', (msg: GroupMessage) => {
      setGroupMessages((prev) => {
        const currentGroupMsgs = prev[msg.groupId] || [];
        if (currentGroupMsgs.some((m) => m.id === msg.id)) return prev;
        return {
          ...prev,
          [msg.groupId]: [...currentGroupMsgs, msg],
        };
      });
    });

    return () => {
      socketInstance.disconnect();
    };
  }, [isAuthenticated, refreshGroups]);

  const onLoginSuccess = (user: { id: string; username: string }) => {
    setIsAuthenticated(true);
    setCurrentUser({
      id: user.id,
      userId: user.id,
      name: user.username,
      initials: user.username.substring(0, 2).toUpperCase(),
      ip: '',
      isOnline: true,
    });
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.warn('Logout network error:', e);
    }
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
    setIsAuthenticated(false);
    setCurrentUser(null);
    setOnlineUsers([]);
    setMessages([]);
    setGroups([]);
    setGroupMessages({});
    setIsConnected(false);
  };

  const sendMessage = (msg: { receiverId: string; text?: string; fileAttachment?: unknown }) => {
    if (socket && isConnected) {
      socket.emit('send_message', msg);
    }
  };

  const joinGroup = (groupId: string) => {
    if (socket && isConnected) {
      socket.emit('join_group', groupId);
    }
  };

  const leaveGroup = (groupId: string) => {
    if (socket && isConnected) {
      socket.emit('leave_group', groupId);
    }
  };

  const sendGroupMessage = (msg: { groupId: string; text?: string; fileAttachment?: unknown }) => {
    if (socket && isConnected) {
      socket.emit('send_group_message', msg);
    }
  };

  const updateName = (newName: string) => {
    if (socket && isConnected) {
      socket.emit('update_name', newName);
    }
  };

  const clearChat = (otherUserId: string) => {
    setMessages((prev) =>
      prev.filter(
        (msg) =>
          !(
            (msg.senderId === currentUser?.id && msg.receiverId === otherUserId) ||
            (msg.senderId === otherUserId && msg.receiverId === currentUser?.id)
          )
      )
    );
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        currentUser,
        onlineUsers,
        messages,
        groups,
        groupMessages,
        connectionError,
        serverIps,
        isAuthenticated,
        authLoading,
        roomRequired,
        onLoginSuccess,
        logout,
        sendMessage,
        updateName,
        clearChat,
        joinGroup,
        leaveGroup,
        sendGroupMessage,
        fetchGroupMessages,
        refreshGroups,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
