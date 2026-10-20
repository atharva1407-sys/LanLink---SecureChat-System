import { Users, Settings, Smartphone, X, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useSocket } from '@/components/providers/socket-provider';

export function AppHeader() {
  const [showConnectModal, setShowConnectModal] = useState(false);
  const { serverIps, currentUser, logout } = useSocket();

  return (
    <>
      <header className="h-14 border-b bg-background flex items-center justify-between px-4 select-none shrink-0" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        {/* Left: Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="text-primary flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="LanLink Logo" className="w-8 h-8 object-contain" />
          </div>
          <span className="font-bold text-lg tracking-tight">LanLink</span>
        </div>

        {/* Center: Connection Status */}
        <div className="flex items-center gap-2 px-3 py-1 bg-secondary rounded-full border border-border">
          <div className="w-2 h-2 rounded-full bg-success"></div>
          <span className="text-xs text-muted-foreground">Connected to LAN</span>
          {currentUser && (
            <span className="text-xs font-semibold text-primary ml-1">
              ({currentUser.name})
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3 text-muted-foreground" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button 
            onClick={() => setShowConnectModal(true)}
            className="flex items-center gap-2 hover:bg-secondary px-3 py-1.5 rounded-full transition-colors hover:text-foreground text-sm font-medium border border-transparent hover:border-border"
          >
            <Smartphone className="w-4 h-4" />
            Connect Devices
          </button>
          <button className="hover:text-foreground transition-colors p-1" aria-label="Users">
            <Users className="w-4 h-4" />
          </button>
          <button className="hover:text-foreground transition-colors p-1" aria-label="Settings">
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={() => logout()}
            className="flex items-center gap-1.5 hover:text-destructive hover:bg-destructive/10 px-2.5 py-1.5 rounded-lg transition-colors text-xs font-medium border border-transparent hover:border-destructive/20 ml-1"
            title="Log Out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Connect Devices Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-lg max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-primary" />
                Connect Devices
              </h2>
              <button 
                onClick={() => setShowConnectModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                To connect another device (like your phone or a second laptop) to this chat room, ensure it is connected to the <strong className="text-foreground">same Wi-Fi network</strong> and visit one of the following addresses in its web browser:
              </p>
              
              <div className="bg-secondary rounded-lg p-4 border border-border space-y-2">
                {serverIps && serverIps.length > 0 ? (
                  serverIps.map((ip, index) => (
                    <div key={index} className="flex items-center justify-between bg-background px-3 py-2 rounded-md border border-border">
                      <code className="text-sm font-medium text-primary">http://{ip}:3000</code>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center">Detecting network IP...</p>
                )}
              </div>
              
              <div className="bg-primary/10 text-primary px-4 py-3 rounded-lg text-sm">
                <strong>Note:</strong> Log in with your LanLink username and password from each device.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
