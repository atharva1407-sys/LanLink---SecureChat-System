'use client';

import { useState, useEffect, useCallback } from 'react';
import { User } from '@/types/user';
import { useSocket } from '@/components/providers/socket-provider';
import { Edit2, Check, KeyRound, Eye, EyeOff, Copy, CheckCheck } from 'lucide-react';

interface UserProfileCardProps {
  user: User;
}

export function UserProfileCard({ user }: UserProfileCardProps) {
  const { updateName } = useSocket();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user.name);

  // Personal Chat Password state
  const [chatPassword, setChatPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditingPass, setIsEditingPass] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [passSaving, setPassSaving] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);

  const fetchChatPassword = useCallback(async () => {
    try {
      const res = await fetch('/api/users/my-chat-password');
      if (res.ok) {
        const data = await res.json();
        setChatPassword(data.chatPassword || '');
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchChatPassword();
  }, [fetchChatPassword]);

  const handleSaveName = () => {
    if (editName.trim() && editName !== user.name) {
      updateName(editName.trim());
    }
    setIsEditing(false);
  };

  const handleCopyPassword = () => {
    if (!chatPassword) return;
    navigator.clipboard.writeText(chatPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPass || newPass.trim().length < 4) {
      setPassError('Password must be at least 4 characters');
      return;
    }

    setPassSaving(true);
    setPassError(null);
    try {
      const res = await fetch('/api/users/my-chat-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPass.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setChatPassword(data.chatPassword || newPass.trim());
        setIsEditingPass(false);
        setNewPass('');
      } else {
        setPassError(data.error || 'Failed to update chat password');
      }
    } catch {
      setPassError('Network error updating chat password');
    } finally {
      setPassSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2.5 p-3 bg-secondary rounded-xl border border-border group shadow-sm">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold">
            {user.initials}
          </div>
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center justify-between">
            {isEditing ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                  className="w-full text-sm font-medium bg-background border border-border rounded px-1.5 py-0.5 text-foreground"
                />
                <button onClick={handleSaveName} className="text-success hover:text-success/80">
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate text-foreground">{user.name}</span>
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Edit display name"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
          <span className="text-xs text-muted-foreground truncate">{user.ip || 'Connected'}</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="w-2 h-2 rounded-full bg-success"></div>
            <span className="text-[10px] text-muted-foreground">You (LAN Host/Peer)</span>
          </div>
        </div>
      </div>

      {/* Cross-Verification: Personal Chat Password */}
      <div className="mt-1 pt-2.5 border-t border-border/60 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1 font-medium text-foreground">
            <KeyRound className="w-3 h-3 text-primary" />
            <span>My Chat Password</span>
          </div>
          <button
            onClick={() => {
              setIsEditingPass(!isEditingPass);
              setNewPass(chatPassword);
              setPassError(null);
            }}
            className="text-[10px] text-primary hover:underline"
          >
            {isEditingPass ? 'Cancel' : 'Change'}
          </button>
        </div>

        {isEditingPass ? (
          <form onSubmit={handleSavePassword} className="flex flex-col gap-1.5 mt-1">
            <div className="flex items-center gap-1">
              <input
                autoFocus
                type="text"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="New chat password"
                className="flex-1 text-xs bg-background border border-border rounded px-2 py-1 text-foreground"
              />
              <button
                type="submit"
                disabled={passSaving || !newPass}
                className="px-2 py-1 bg-primary text-primary-foreground text-xs rounded hover:bg-primary/90 disabled:opacity-50"
              >
                Save
              </button>
            </div>
            {passError && <span className="text-[10px] text-destructive">{passError}</span>}
          </form>
        ) : (
          <div className="flex items-center justify-between bg-background/80 rounded-lg px-2.5 py-1.5 border border-border/50">
            <span className="text-xs font-mono font-medium text-foreground tracking-wider">
              {showPassword ? (chatPassword || 'Loading...') : '••••••••'}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={handleCopyPassword}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                title="Copy password to share with peers"
              >
                {copied ? <CheckCheck className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        )}
        <span className="text-[10px] text-muted-foreground leading-tight">
          Peers must enter this password to message you.
        </span>
      </div>
    </div>
  );
}
