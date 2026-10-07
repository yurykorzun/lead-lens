import { describe, it, expect, vi, afterEach } from 'vitest';
import { sendMail } from '../services/mailer.js';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.EMAIL_DISABLED;
});

describe('sendMail kill switch', () => {
  it('makes no network call at all when EMAIL_DISABLED is true', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    process.env.EMAIL_DISABLED = 'true';

    await sendMail('someone@test.com', 'Your Lead Lens Account', '<p>hi</p>');

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
