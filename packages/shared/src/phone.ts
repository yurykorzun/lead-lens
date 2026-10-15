// Phones arrive as typed: "(215) 884-2295", "+1 347-527-6853", "4159009908", "13312852745".

/** The 10 US digits when the value is plainly a US number, otherwise null */
function usDigits(val: string): string | null {
  // Letters mean an extension or a note; a "+" with another country code is foreign
  if (/[a-z]/i.test(val) || (val.startsWith('+') && !val.startsWith('+1'))) return null;
  const digits = val.replace(/\D/g, '');
  const us = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  // A US area code never starts with 0 or 1, so those are typos and stay visible as typed
  return us.length === 10 && /^[2-9]/.test(us) ? us : null;
}

/**
 * One way to show a US number, (415) 900-9908. Anything else (foreign, an extension, a
 * typo) is shown as entered, since a guess would hide the mistake. Blank in, '' out.
 */
export function formatPhone(val?: string | null): string {
  const s = (val ?? '').trim();
  if (!s) return '';
  const us = usDigits(s);
  return us ? `(${us.slice(0, 3)}) ${us.slice(3, 6)}-${us.slice(6)}` : s;
}

/** A tel: link that dials: +1 and 10 digits for a US number, else the digits as typed
 * (keeping a leading +, dropping an extension). '' when there is nothing to dial. */
export function phoneHref(val?: string | null): string {
  const s = (val ?? '').trim();
  const us = usDigits(s);
  if (us) return `tel:+1${us}`;
  const main = s.replace(/\s*(ext\.?|x|#).*$/i, '');
  const digits = main.replace(/\D/g, '');
  return digits ? `tel:${main.startsWith('+') ? '+' : ''}${digits}` : '';
}
