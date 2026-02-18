import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const faqs = [
  {
    question: "How do I send large files without email?",
    answer: "Open LocalBolt on both devices, share the 6-character code, and connect. Once connected, drag and drop files to transfer directly between devices with no account required."
  },
  {
    question: "Is LocalBolt safer than WeTransfer or Google Drive?",
    answer: "Significantly. WeTransfer and Google Drive store your files on their servers. LocalBolt transfers files directly between your devices using NaCl/Curve25519 encryption (the same standard used by Signal and WireGuard). Your files never touch any server ⚡not during transfer, not after."
  },
  {
    question: "Does LocalBolt work like AirDrop on Windows and Android?",
    answer: "Yes. LocalBolt works in modern browsers on Windows, macOS, Linux, Android, and iOS, so you can share across mixed device types."
  },
  {
    question: "How do I transfer files between iPhone and Android?",
    answer: "Open localbolt.site on both devices on the same network, enter the shown 6-character code, and connect. Then send files directly between iPhone and Android from the browser."
  },
  {
    question: "Do I need to create an account?",
    answer: "No account is needed. LocalBolt works instantly in your browser with zero signup. Just open the website and start sharing - no email, no password, no personal information required."
  },
  {
    question: "What's the maximum file size I can send?",
    answer: "LocalBolt does not enforce a file size cap. Practical limits are your device storage, memory, and network quality."
  },
  {
    question: "Does LocalBolt work across different networks?",
    answer: "LocalBolt is designed for peers on the same network. Connections can fail on segmented or isolated networks (for example guest Wi-Fi, client isolation, or restricted corporate networks)."
  }
];

export const FAQ = () => {
  return (
    <section aria-label="Frequently Asked Questions" className="space-y-6 max-w-3xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">FAQ</h2>
        <p className="text-sm text-gray-500">
          Common questions about encrypted peer-to-peer file transfer
        </p>
      </div>

      <Accordion type="single" collapsible className="space-y-1.5">
        {faqs.map((faq, index) => (
          <AccordionItem
            key={index}
            value={`item-${index}`}
            className="border border-white/5 rounded-lg px-5 bg-white/[0.02] data-[state=open]:border-neon/15 transition-colors"
          >
            <AccordionTrigger className="text-left text-sm hover:no-underline hover:text-neon transition-colors py-4">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="text-xs text-gray-500 pb-4">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
};
