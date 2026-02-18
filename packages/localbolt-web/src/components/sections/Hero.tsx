
import { ArrowDown } from "lucide-react";

interface HeroProps {
  onStartSharing: () => void;
}

export const Hero = ({ onStartSharing }: HeroProps) => {
  return (
    <section id="secure-p2p-sharing" className="text-center space-y-4 animate-fade-up max-w-3xl mx-auto">
      <h1 className="text-5xl sm:text-6xl font-bold tracking-tight bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent" aria-label="Secure P2P File Sharing">
        Secure P2P File Sharing
      </h1>
      <p className="text-lg text-gray-400 max-w-xl mx-auto leading-relaxed">
        Like AirDrop, but for everyone on your network. End-to-end encrypted, no cloud storage.
      </p>
      <button
        onClick={onStartSharing}
        className="inline-flex items-center gap-1 text-sm text-neon/70 hover:text-neon transition-colors pt-2"
        aria-label="Scroll to file transfer"
      >
        <ArrowDown className="w-4 h-4 animate-bounce" />
      </button>
    </section>
  );
};
