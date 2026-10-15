export function toTitleCase(name: string): string {
  return name.replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// Phones arrive as typed: "(215) 884-2295", "+1 347-527-6853", "4159009908", "13312852745".
// A US number (10 digits, or 11 starting with 1) is shown one way, (415) 900-9908; anything
// else (a foreign number, an extension, a typo) is shown as entered, since a guess would
// hide the mistake. The tel: link keeps the stored value.
export function formatPhone(val?: string): string {
  if (!val) return '';
  const digits = val.replace(/\D/g, '');
  const us = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (us.length !== 10 || /[a-z]/i.test(val)) return val.trim();
  return `(${us.slice(0, 3)}) ${us.slice(3, 6)}-${us.slice(6)}`;
}

// createdDate is a plain YYYY-MM-DD. new Date() would read it as UTC midnight and show
// the day before for every US user.
export function formatDay(val?: string): string {
  if (!val) return '';
  const [y, m, d] = val.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString();
}
