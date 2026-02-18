import { Smartphone, Share2, Zap } from "lucide-react";

const steps = [
  {
    icon: Smartphone,
    step: "1",
    title: "Open on Both Devices",
    description: "Visit localbolt.site on two devices on the same network."
  },
  {
    icon: Share2,
    step: "2",
    title: "Share Your Code",
    description: "One device shows a 6-character code. Enter it on the other device."
  },
  {
    icon: Zap,
    step: "3",
    title: "Transfer Instantly",
    description: "Drag and drop files. NaCl-encrypted, peer-to-peer, no size limits."
  }
];

export const HowItWorks = () => {
  return (
    <section aria-label="How It Works" className="space-y-6 max-w-4xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">How It Works</h2>
        <p className="text-sm text-gray-500">
          Start sharing files in seconds <Zap className="inline w-3 h-3 text-gray-500" aria-hidden="true" /> no apps, no accounts
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {steps.map((item) => (
          <div
            key={item.step}
            className="relative flex items-start gap-4 p-5 rounded-xl bg-white/[0.02] border border-white/5 transition-colors duration-300 hover:border-white/10"
          >
            <div className="flex-shrink-0 w-7 h-7 bg-neon/10 text-neon rounded-md flex items-center justify-center text-xs font-bold">
              {item.step}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <item.icon className="w-4 h-4 text-neon/70" aria-hidden="true" />
                <h3 className="text-sm font-semibold">{item.title}</h3>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
