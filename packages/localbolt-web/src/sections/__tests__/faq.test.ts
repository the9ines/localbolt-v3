import { describe, it, expect } from 'vitest';
import { createFAQ } from '../faq';

describe('createFAQ', () => {
  it('returns a section element with FAQ aria-label', () => {
    const el = createFAQ();
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.tagName).toBe('SECTION');
    expect(el.getAttribute('aria-label')).toBe('Frequently Asked Questions');
  });

  it('renders FAQ items as details elements with summary and answer', () => {
    const el = createFAQ();
    const details = el.querySelectorAll('details');
    expect(details.length).toBeGreaterThan(0);
    details.forEach((detail) => {
      expect(detail.querySelector('summary')).not.toBeNull();
      expect(detail.querySelector('p')).not.toBeNull();
    });
  });
});
