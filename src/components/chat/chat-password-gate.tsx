'use client';

import React, { useState } from 'react';
import { Lock, KeyRound, Eye, EyeOff, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { User } from '@/types/user';

interface ChatPasswordGateProps {
  activeUser: User;
  onUnlocked: () => void;
}

export function ChatPasswordGate({ activeUser, onUnlocked }: ChatPasswordGateProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError(`Please enter ${activeUser.name}'s chat password`);
      return;
    }

    setSubmitting(true);
    setError(null);

    const targetUserId = activeUser.userId || activeUser.id;

    try {
      const res = await fetch('/api/chats/verify-user-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId,
          password: password.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `Incorrect chat password for ${activeUser.name}`);
        return;
      }

      onUnlocked();
    } catch {
      setError('Connection error verifying chat password. Is LAN server reachable?');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-background select-none">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-xl p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3 shadow-inner">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-foreground">
            Enter {activeUser.name}&apos;s Chat Password
          </h2>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            Cross-verification security: To message <strong className="text-foreground">{activeUser.name}</strong>, enter the exact personal chat password they set and shared with you.
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
              {activeUser.name}&apos;s Chat Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={`Ask ${activeUser.name} for their chat password`}
                autoFocus
                required
                className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all pl-10 pr-10"
              />
              <KeyRound className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-muted-foreground hover:text-foreground transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
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
                <span>Verifying with {activeUser.name}...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Verify & Unlock Chat</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
