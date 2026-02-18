import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Eye, EyeOff, Radio, Clock, MessageCircle } from "lucide-react";

export const PrivacyPolicy = () => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="text-gray-500 hover:text-neon transition-colors text-sm h-auto p-0 font-normal"
        >
          Privacy Policy
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] bg-dark/95 backdrop-blur-xl border border-neon/15 shadow-[0_0_40px_rgba(20,255,106,0.08)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-white">
            <div className="w-8 h-8 rounded-lg bg-neon/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-neon" />
            </div>
            Privacy Policy
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-4">
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-xs text-gray-600 uppercase tracking-wider">Last updated: February 2026</p>
              <p className="text-sm text-gray-300 leading-relaxed">
                LocalBolt is designed to transfer files directly between devices with minimal data collection.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-white/[0.03] border border-white/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5 text-neon/70" />
                  <h3 className="text-xs font-semibold text-white uppercase tracking-wider">What We Process</h3>
                </div>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-xs text-gray-400 leading-relaxed">
                    <span className="w-1 h-1 rounded-full bg-neon/40 mt-1.5 flex-shrink-0" />
                    Temporary signaling messages (peer code and WebRTC connection data)
                  </li>
                  <li className="flex items-start gap-2 text-xs text-gray-400 leading-relaxed">
                    <span className="w-1 h-1 rounded-full bg-neon/40 mt-1.5 flex-shrink-0" />
                    Basic service requests needed to load the site
                  </li>
                </ul>
              </div>
              <div className="rounded-lg bg-white/[0.03] border border-white/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <EyeOff className="w-3.5 h-3.5 text-neon/70" />
                  <h3 className="text-xs font-semibold text-white uppercase tracking-wider">What We Don't Store</h3>
                </div>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-xs text-gray-400 leading-relaxed">
                    <span className="w-1 h-1 rounded-full bg-gray-600 mt-1.5 flex-shrink-0" />
                    Your file contents
                  </li>
                  <li className="flex items-start gap-2 text-xs text-gray-400 leading-relaxed">
                    <span className="w-1 h-1 rounded-full bg-gray-600 mt-1.5 flex-shrink-0" />
                    Persistent file history on our servers
                  </li>
                  <li className="flex items-start gap-2 text-xs text-gray-400 leading-relaxed">
                    <span className="w-1 h-1 rounded-full bg-gray-600 mt-1.5 flex-shrink-0" />
                    Account profiles (no sign-up required)
                  </li>
                </ul>
              </div>
            </div>

            <div className="rounded-lg bg-white/[0.03] border border-white/5 p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-neon/70" />
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">How Transfers Work</h3>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Files are sent directly between connected devices using WebRTC data channels and end-to-end encryption. LocalBolt uses a signaling service to set up the connection, but file contents are not uploaded to cloud storage.
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Built for same-network use. On segmented networks (guest Wi-Fi, client isolation, restricted enterprise networks), connection setup may fail.
              </p>
            </div>

            <div className="rounded-lg bg-white/[0.03] border border-white/5 p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-neon/70" />
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Retention</h3>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Signaling data is transient and used only for session setup. We do not keep a permanent cloud archive of your transferred files.
              </p>
            </div>

            <div className="rounded-lg bg-white/[0.03] border border-white/5 p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-3.5 h-3.5 text-neon/70" />
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Contact & Updates</h3>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Questions about privacy can be raised through the project GitHub profile. We may update this policy when product behavior changes.
              </p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
