
import { Shield, Wifi, Laptop, Server, Lock, Zap, Globe, Clock, LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

const Bolt = () => <Zap className="inline w-2.5 h-2.5 text-gray-500" aria-hidden="true" />;

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
}

const FeatureCard = ({ icon: Icon, title, description }: FeatureCardProps) => (
  <div className="group flex items-start gap-3 p-4 rounded-lg bg-white/[0.02] border border-white/5 transition-all duration-300 hover:border-neon/20 hover:bg-white/[0.04]">
    <Icon className="w-5 h-5 text-neon/70 flex-shrink-0 mt-0.5 transition-colors duration-300 group-hover:text-neon" aria-hidden="true" />
    <div className="min-w-0">
      <h3 className="text-sm font-semibold mb-1">{title}</h3>
      <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
    </div>
  </div>
);

export const Features = () => {
  const features = [
    {
      icon: Shield,
      title: "End-to-End Encryption",
      description: "Every file is encrypted with NaCl/Curve25519 (same algorithms used by Signal and WireGuard) before transfer. Per-chunk random nonces prevent any pattern analysis."
    },
    {
      icon: Wifi,
      title: "WebRTC P2P Transfer",
      description: <>Files transfer directly between devices over encrypted WebRTC data channels <Bolt /> faster and more private than cloud uploads.</>
    },
    {
      icon: Server,
      title: "Zero Server Storage",
      description: "Your files never touch any server. Not during transfer, not after. Zero cloud storage means zero data exposure."
    },
    {
      icon: Laptop,
      title: "Universal Compatibility",
      description: "Works across Windows, macOS, Linux, iOS, and Android in any modern browser."
    },
    {
      icon: Lock,
      title: "Privacy Focused",
      description: "No account, no tracking, no analytics, no data collection. We can't see your files because they never reach us."
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Direct peer connections transfer at local network speed."
    },
    {
      icon: Globe,
      title: "Same-Network First",
      description: "Built for direct connections on the same network with no relay path for file content."
    },
    {
      icon: Clock,
      title: "Real-time Transfer",
      description: "Live progress tracking and transfer speed monitoring."
    }
  ];

  return (
    <section aria-label="Features" className="space-y-6 max-w-5xl mx-auto">
      <div className="text-center max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold mb-2">Military-Grade Encryption, Zero Trust Architecture</h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          LocalBolt uses NaCl/Curve25519 encryption <Zap className="inline w-3 h-3 text-gray-500" aria-hidden="true" /> the same cryptographic standard trusted by Signal and WireGuard <Zap className="inline w-3 h-3 text-gray-500" aria-hidden="true" /> to transfer files directly between devices with zero server storage.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-up">
        {features.map((feature) => (
          <FeatureCard key={feature.title} {...feature} />
        ))}
      </div>
    </section>
  );
};
