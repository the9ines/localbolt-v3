
import { useState, useRef } from "react";
import { Helmet } from "react-helmet";
import { Header } from "@/components/Header";
import { Hero } from "@/components/sections/Hero";
import { Transfer } from "@/components/sections/Transfer";
import { TrustStrip } from "@/components/sections/TrustStrip";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Features } from "@/components/sections/Features";
import { FAQ } from "@/components/sections/FAQ";
import { faqs } from "@/components/sections/FAQ";
import { Footer } from "@/components/sections/Footer";
import ConsentModal from "@/components/ConsentModal";
import WebRTCService from "@/services/webrtc/WebRTCService";

const Index = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [webrtc, setWebrtc] = useState<WebRTCService | null>(null);
  const transferSectionRef = useRef<HTMLDivElement>(null);

  const handleConnectionChange = (connected: boolean, service?: WebRTCService) => {
    console.log('[UI] Connection change:', connected, !!service);
    setIsConnected(connected);
    if (service) {
      setWebrtc(service);
    }
  };

  const scrollToTransfer = () => {
    transferSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  };

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "LocalBolt",
      "url": "https://localbolt.site",
      "applicationCategory": "File Transfer",
      "operatingSystem": "Cross-platform",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "description": "End-to-end encrypted peer-to-peer file transfer. Files transfer directly between devices using NaCl/Curve25519 encryption — never stored on any server.",
      "featureList": [
        "NaCl/Curve25519 end-to-end encryption",
        "Direct peer-to-peer transfer — files never touch a server",
        "Zero server storage — no cloud, no trace",
        "Cross-platform — any modern browser",
        "No file size limits",
        "No account required — zero data collection"
      ]
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "LocalBolt",
      "url": "https://localbolt.site",
      "logo": "https://localbolt.site/og-image.png",
      "description": "Encrypted peer-to-peer file transfer service — NaCl/Curve25519 encryption, zero server storage"
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "LocalBolt",
      "url": "https://localbolt.site"
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqs.map((faq) => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
        }
      }))
    }
  ];

  return (
    <>
      <Helmet>
        <title>LocalBolt ⚡ Encrypted P2P File Transfer ⚡ No Servers, No Cloud</title>
        <meta name="description" content="End-to-end encrypted file transfer directly between your devices. Files never touch a server. No sign-up, no cloud, no trace." />
        <meta name="keywords" content="encrypted file transfer, P2P file sharing, no cloud file transfer, end-to-end encrypted, private file sharing, secure file transfer, airdrop alternative, NaCl encryption" />

        {/* Open Graph / Social Media */}
        <meta property="og:title" content="LocalBolt ⚡ Encrypted P2P File Transfer ⚡ No Servers, No Cloud" />
        <meta property="og:description" content="End-to-end encrypted P2P file transfer. Files go directly between devices ⚡ never stored on any server. NaCl/Curve25519 encryption." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://localbolt.site" />
        <meta property="og:image" content="https://localbolt.site/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:site_name" content="LocalBolt" />
        <meta property="og:locale" content="en_US" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@localbolt" />
        <meta name="twitter:creator" content="@the9ines" />
        <meta name="twitter:title" content="LocalBolt ⚡ Encrypted P2P File Transfer ⚡ No Servers, No Cloud" />
        <meta name="twitter:description" content="End-to-end encrypted file transfer between your devices. No servers, no cloud, no trace." />
        <meta name="twitter:image" content="https://localbolt.site/og-image.png" />
        <meta name="twitter:image:alt" content="LocalBolt ⚡ Encrypted P2P File Transfer with NaCl/Curve25519 encryption" />

        {/* Additional Social Media Meta Tags */}
        <meta property="fb:app_id" content="" />
        <meta name="theme-color" content="#14ff6a" />
        <meta name="msapplication-TileColor" content="#0a0a0a" />
        <meta name="application-name" content="LocalBolt" />

        {/* Additional SEO Meta Tags */}
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://localbolt.site" />

        {/* Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <div className="min-h-screen bg-dark text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(20,255,106,0.07),rgba(0,0,0,0))] animate-pulse" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:radial-gradient(white,transparent_80%)] pointer-events-none" />

        <div className="relative z-10">
          <Header />

          <main className="container mx-auto px-4">
            {/* === ABOVE THE FOLD: Product === */}
            <div className="py-12 lg:py-16 space-y-8">
              <Hero onStartSharing={scrollToTransfer} />
              <HowItWorks />
              <Transfer
                ref={transferSectionRef}
                onConnectionChange={handleConnectionChange}
                isConnected={isConnected}
                webrtc={webrtc}
              />
              <TrustStrip />
            </div>

            {/* === BELOW THE FOLD: Supporting content === */}
            <div className="border-t border-white/5 py-16 lg:py-20 space-y-16">
              <Features />
              <FAQ />
            </div>
          </main>

          <Footer />
        </div>

        <ConsentModal />
      </div>
    </>
  );
};

export default Index;
