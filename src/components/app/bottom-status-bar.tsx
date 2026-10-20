import { Wifi, Zap, Shield, Activity } from 'lucide-react';

export function BottomStatusBar() {
  return (
    <footer className="h-8 border-t bg-background flex items-center justify-between px-4 text-xs text-muted-foreground shrink-0 select-none">
      <div className="flex items-center gap-2">
        <Wifi className="w-3.5 h-3.5 text-success" />
        <span>LAN: 192.168.1.0/24</span>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-success" />
          <span>Real-Time</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-success" />
          <span>Secure</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-success" />
          <span>Fast</span>
        </div>
      </div>

      <div>
        v1.0.0
      </div>
    </footer>
  );
}
