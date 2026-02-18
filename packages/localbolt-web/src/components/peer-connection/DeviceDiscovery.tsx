import { Smartphone, Tablet, Laptop, Monitor } from "lucide-react";
import type { DiscoveredDevice } from "@/services/signaling/SignalingProvider";

interface DeviceDiscoveryProps {
  peers: DiscoveredDevice[];
  onSelectPeer: (peerCode: string) => void;
  connectingTo: string | null;
  isConnected: boolean;
  connectedDevice: DiscoveredDevice | null;
  onDisconnect: () => void;
}

const deviceIcons = {
  phone: Smartphone,
  tablet: Tablet,
  laptop: Laptop,
  desktop: Monitor,
} as const;

export const DeviceDiscovery = ({
  peers,
  onSelectPeer,
  connectingTo,
  isConnected,
  connectedDevice,
  onDisconnect,
}: DeviceDiscoveryProps) => {
  if (isConnected && connectedDevice) {
    const Icon = deviceIcons[connectedDevice.deviceType] || Laptop;

    return (
      <div className="flex items-center justify-between py-2.5 px-3.5 rounded-md border border-neon/20 bg-neon/[0.03] animate-fade-in">
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon className="w-4 h-4 text-neon flex-shrink-0" />
          <span className="text-sm text-white/80 truncate">
            {connectedDevice.deviceName}
          </span>
        </div>
        <button
          onClick={onDisconnect}
          className="shrink-0 ml-3 text-xs text-gray-500 hover:text-white/80 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium leading-none">Nearby Devices</p>

      {peers.length === 0 ? (
        <div className="flex items-center gap-2.5 py-3 px-3.5 rounded-md bg-dark-accent/60 border border-white/5">
          <div className="relative flex items-center justify-center w-4 h-4">
            <div className="absolute w-3 h-3 rounded-full bg-neon/10 animate-ping" />
            <div className="w-1.5 h-1.5 rounded-full bg-neon/40" />
          </div>
          <span className="text-xs text-muted-foreground">
            Searching for nearby devices...
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {peers.map((peer) => {
            const Icon = deviceIcons[peer.deviceType] || Laptop;
            const isConnecting = connectingTo === peer.peerCode;

            return (
              <button
                key={peer.peerCode}
                onClick={() => onSelectPeer(peer.peerCode)}
                disabled={!!connectingTo}
                className={`
                  group flex items-center gap-2 px-3 py-2 rounded-md
                  border transition-all duration-200 text-left animate-fade-in
                  ${
                    isConnecting
                      ? "border-neon/30 bg-neon/[0.03]"
                      : "border-white/5 bg-dark-accent/60 hover:border-neon/20 hover:bg-dark-accent active:scale-[0.98]"
                  }
                `}
              >
                <Icon
                  className={`w-3.5 h-3.5 flex-shrink-0 transition-colors duration-200 ${
                    isConnecting
                      ? "text-neon animate-pulse"
                      : "text-gray-500 group-hover:text-neon/70"
                  }`}
                />
                <span
                  className={`text-xs truncate max-w-[140px] ${
                    isConnecting
                      ? "text-neon/80"
                      : "text-gray-400 group-hover:text-white/80"
                  }`}
                >
                  {peer.deviceName}
                </span>
                {isConnecting && (
                  <div className="w-1.5 h-1.5 rounded-full bg-neon/60 animate-pulse ml-0.5" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
