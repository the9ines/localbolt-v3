// ─── Device Detection Utility ──────────────────────────────────────────────
// Detects device type and generates a human-readable device name
// from the browser's user agent string. Used for peer discovery display.

import type { DiscoveredDevice } from './SignalingProvider';

/**
 * Detect whether the current device is a phone, tablet, laptop, or desktop.
 * Uses navigator.userAgent and screen dimensions for classification.
 */
export function detectDeviceType(): DiscoveredDevice['deviceType'] {
  const ua = navigator.userAgent;
  const screenWidth = window.screen?.width || 0;

  // Check for mobile/tablet user agents
  const isMobile = /Mobi|Android|iPhone|iPod/i.test(ua);
  const isTablet =
    /iPad/i.test(ua) ||
    (/Macintosh/i.test(ua) && 'ontouchend' in document) || // iPadOS
    (/Android/i.test(ua) && !isMobile);

  if (isTablet) return 'tablet';
  if (isMobile) return 'phone';

  // Desktop browsers: distinguish laptop vs desktop is unreliable,
  // so default to 'laptop' for web clients (most common form factor).
  // Tauri native apps can override this with actual hardware detection.
  if (screenWidth >= 2560) return 'desktop'; // Large monitor likely a desktop
  return 'laptop';
}

/**
 * Generate a human-readable device name like "Chrome on macOS" or "Safari on iPhone".
 * Parses navigator.userAgent for browser and OS.
 */
export function getDeviceName(): string {
  const ua = navigator.userAgent;

  // Detect browser
  let browser = 'Browser';
  if (/Edg\//i.test(ua)) {
    browser = 'Edge';
  } else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) {
    browser = 'Opera';
  } else if (/Brave/i.test(ua)) {
    browser = 'Brave';
  } else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua) && !/OPR\//i.test(ua)) {
    browser = 'Chrome';
  } else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) {
    browser = 'Safari';
  } else if (/Firefox\//i.test(ua)) {
    browser = 'Firefox';
  }

  // Detect OS / device
  let os = '';
  if (/iPhone/i.test(ua)) {
    os = 'iPhone';
  } else if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && 'ontouchend' in document)) {
    os = 'iPad';
  } else if (/Android/i.test(ua)) {
    os = 'Android';
  } else if (/Windows/i.test(ua)) {
    os = 'Windows';
  } else if (/Mac OS X|Macintosh/i.test(ua)) {
    os = 'macOS';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  } else if (/CrOS/i.test(ua)) {
    os = 'ChromeOS';
  }

  if (os) {
    return `${browser} on ${os}`;
  }
  return browser;
}
