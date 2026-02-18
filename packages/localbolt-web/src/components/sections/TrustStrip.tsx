
import { Shield, Server, Globe, UserX } from "lucide-react";

const signals = [
  { icon: Shield, label: "End-to-End Encrypted" },
  { icon: Server, label: "No Cloud Storage" },
  { icon: Globe, label: "Cross-Platform" },
  { icon: UserX, label: "No Account Needed" },
];

export const TrustStrip = () => {
  return (
    <section aria-label="Trust signals" className="animate-fade-up">
      <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 max-w-3xl mx-auto">
        {signals.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2 text-gray-500">
            <Icon className="w-3.5 h-3.5 text-neon/60" aria-hidden="true" />
            <span className="text-xs tracking-wide uppercase">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
};
