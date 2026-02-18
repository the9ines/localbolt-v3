import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}

const ConsentModal = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if user has already made a consent decision
    const consentDecision = localStorage.getItem('analytics-consent');
    if (consentDecision === null) {
      setIsOpen(true);
    } else if (consentDecision === 'true' && window.gtag) {
      // If user previously consented, initialize analytics
      window.gtag('consent', 'update', {
        analytics_storage: 'granted'
      });
    }
  }, []);

  const handleConsent = (consent: boolean) => {
    localStorage.setItem('analytics-consent', consent.toString());
    setIsOpen(false);

    // Configure Google Analytics based on consent
    if (window.gtag) {
      window.gtag('consent', 'update', {
        analytics_storage: consent ? 'granted' : 'denied'
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            Privacy Notice
          </DialogTitle>
          <DialogDescription className="text-left space-y-3">
            <p>
              We use Google Analytics to understand how our secure file sharing service is being used.
            </p>
            <div className="text-sm space-y-2">
              <p><strong>We collect:</strong> Anonymous usage statistics, page views</p>
              <p><strong>We DON'T collect:</strong> Your files, personal data, or transfer contents</p>
            </div>
            <p className="text-sm text-gray-600">
              Your file transfers remain completely private regardless of your choice.
            </p>
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleConsent(false)}
            className="flex-1"
          >
            Decline
          </Button>
          <Button
            onClick={() => handleConsent(true)}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            Accept
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConsentModal;