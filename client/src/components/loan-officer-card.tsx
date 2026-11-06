import { Mail, Phone } from 'lucide-react';
import { formatPhone, phoneHref, type ContactRow } from '@lead-lens/shared';

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join('');
}

/**
 * Who to call about the loan: the borrower's owner in Salesforce. Phone shows once the LO's
 * User record has one (none of the 42 active users had it on 2026-11-06), email always.
 */
export function LoanOfficerCard({ contact, role }: { contact: ContactRow; role: 'admin' | 'loan_officer' | 'agent' }) {
  // A loan officer only sees their own borrowers, so the card would show themselves. No email
  // means a queue owns the lead (every User has one), and a queue is nobody to call.
  if (role === 'loan_officer' || !contact.ownerName || !contact.ownerEmail) return null;
  const phone = formatPhone(contact.ownerPhone) && phoneHref(contact.ownerPhone) ? contact.ownerPhone : undefined;
  const link = 'flex min-h-11 items-center gap-2 rounded-md px-2 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-9';

  return (
    <section className="mt-5 rounded-lg border bg-card p-4" data-testid="loan-officer" aria-labelledby="lo-title">
      <h3 id="lo-title" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {role === 'agent' ? 'Your loan officer' : 'Loan officer'}
      </h3>
      <div className="mt-2 flex items-center gap-3">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
          {initials(contact.ownerName)}
        </span>
        <p className="min-w-0 truncate text-base font-semibold">{contact.ownerName}</p>
      </div>
      {(phone || contact.ownerEmail) && (
        <div className="mt-2 -mx-2">
          {phone && (
            <a href={phoneHref(phone)} className={link}>
              <Phone aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" /> {formatPhone(phone)}
            </a>
          )}
          {contact.ownerEmail && (
            <a href={`mailto:${contact.ownerEmail}`} className={link}>
              <Mail aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" /> <span className="truncate">{contact.ownerEmail}</span>
            </a>
          )}
        </div>
      )}
    </section>
  );
}
