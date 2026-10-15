export function toTitleCase(name: string): string {
  return name.replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// createdDate is a plain YYYY-MM-DD. new Date() would read it as UTC midnight and show
// the day before for every US user.
export function formatDay(val?: string): string {
  if (!val) return '';
  const [y, m, d] = val.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString();
}
