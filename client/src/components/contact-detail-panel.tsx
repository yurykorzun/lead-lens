import { X, Phone, Mail, User, Calendar, ExternalLink } from 'lucide-react';
import type { ContactRow } from '@lead-lens/shared';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { formatDay } from '@/components/grid/columns';

export interface ContactDetailPanelProps {
  contact: ContactRow;
  onClose: () => void;
  role: 'admin' | 'loan_officer' | 'agent';
}

// lgc-ci production. Admins only - a loan officer or agent has no Salesforce login.
const SF_BASE_URL = 'https://flow-enterprise-8486.lightning.force.com/lightning/r';

// Read-only for every role. No notes, no Activity or History: in lgc-ci those carry the
// team's internal notes, and a Status change from here would text the realtor.
export function ContactDetailPanel({ contact, onClose, role }: ContactDetailPanelProps) {
  const fields: Array<{ label: string; value?: string }> = [
    { label: 'Status', value: contact.status },
    ...(contact.kind === 'client' ? [{ label: 'Loan Stage', value: contact.stage }] : []),
    { label: 'Temperature', value: contact.temperature },
    { label: 'Lead Source', value: contact.leadSource },
    { label: 'Referred By', value: contact.referredBy },
  ];

  return (
    <div className="flex h-full w-[400px] shrink-0 flex-col border-l bg-background xl:w-[480px]">
      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-lg font-semibold">{contact.name}</h2>
            {role === 'admin' && (
              <a
                href={`${SF_BASE_URL}/${contact.kind === 'lead' ? 'Lead' : 'Contact'}/${contact.id}/view`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                title="Open in Salesforce"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {contact.email && (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 shrink-0" /> {contact.email}
              </span>
            )}
            {contact.phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 shrink-0" /> {contact.phone}
              </span>
            )}
            {contact.ownerName && (
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 shrink-0" /> {contact.ownerName}
              </span>
            )}
            {contact.createdDate && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 shrink-0" /> {formatDay(contact.createdDate)}
              </span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="-mr-2 -mt-1 shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <section>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">
            {contact.kind === 'client' ? 'Client' : 'Lead'}
          </h3>
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            {fields.map(f => (
              <div key={f.label} className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">{f.label}</Label>
                <p className="text-sm">{f.value || '—'}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="flex gap-2 border-t px-5 py-3">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
