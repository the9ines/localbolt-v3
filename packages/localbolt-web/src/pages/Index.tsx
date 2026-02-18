
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
      "description": "Secure peer-to-peer file transfer on the same network with end-to-end encryption and no cloud file storage.",
      "featureList": [
        "End-to-end encryption",
        "Direct peer-to-peer transfer on same network",
        "No server storage",
        "Cross-platform compatibility",
        "No file size limits",
        "Privacy focused"
      ]
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "LocalBolt",
      "url": "https://localbolt.site",
      "logo": "https://localbolt.site/og-image.png",
      "description": "Secure peer-to-peer file transfer service with end-to-end encryption"
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
        <title>LocalBolt | Secure Same-Network File Transfer</title>
        <meta name="description" content="Secure, encrypted file transfer between devices on the same network. No sign-up and no cloud file storage." />
        <meta name="keywords" content="local file transfer, same network file sharing, p2p file transfer, secure file sharing, airdrop alternative" />

        {/* Open Graph / Social Media */}
        <meta property="og:title" content="LocalBolt | Secure Same-Network File Transfer" />
        <meta property="og:description" content="Transfer files directly between devices on the same network with end-to-end encryption and no cloud storage." />
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
        <meta name="twitter:title" content="LocalBolt | Secure Same-Network File Transfer" />
        <meta name="twitter:description" content="Transfer files directly between devices on the same network with end-to-end encryption." />
        <meta name="twitter:image" content="https://localbolt.site/og-image.png" />
        <meta name="twitter:image:alt" content="LocalBolt - Secure P2P File Sharing platform with end-to-end encryption" />

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
