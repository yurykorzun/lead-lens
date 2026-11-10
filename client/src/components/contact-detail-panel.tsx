import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Phone, Mail, MessageSquare, Calendar, ExternalLink } from 'lucide-react';
import type { ContactRow } from '@lead-lens/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RealtorStageCard } from '@/components/realtor-stage';
import { LoanOfficerCard } from '@/components/loan-officer-card';
import { formatPhone, phoneHref } from '@lead-lens/shared';
import { formatDay } from '@/components/grid/format';
import { Empty } from '@/components/grid/cells';
import { ContactNotes } from '@/components/contact-notes';

export interface ContactDetailPanelProps {
  contact: ContactRow;
  onClose: () => void;
  role: 'admin' | 'loan_officer' | 'agent';
  /** Below 1024px: the panel covers the screen as a modal dialog */
  covers?: boolean;
}

// lgc-ci production. Admins only - a loan officer or agent has no Salesforce login.
const SF_BASE_URL = 'https://flow-enterprise-8486.lightning.force.com/lightning/r';

// Read-only toward Salesforce, except that the realtor marks her own realtor steps done,
// sets the buying stage and adds realtor notes (both new Realtor_Note__c rows). No team
// notes, Activity or History: in lgc-ci those carry the team's internal notes.
//
// Laid out for a realtor on a phone: reach the buyer, where things stand, who the LO is,
// what to do next, the conversation - and the reference fields last.
//
// A side column on wide screens; below 1024px it covers the screen, because next to the
// grid it left neither readable (a 400px panel on a 375px phone).
export function ContactDetailPanel({ contact, onClose, role, covers = false }: ContactDetailPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  // Read during render, before the commit that makes the list behind a phone panel inert
  // (which blurs the card that was clicked)
  const [opener] = useState(() => document.activeElement as HTMLElement | null);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  // Covering the screen, the panel is modal: the whole app behind it is inert, header too.
  // Declared before the focus effect so that on close the app is live again before focus
  // is handed back to the row (cleanups run in declaration order).
  useEffect(() => {
    if (!covers) return;
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    return () => root?.removeAttribute('inert');
  }, [covers]);

  // As a modal, Tab and Shift+Tab cycle inside the panel instead of leaving the page
  useEffect(() => {
    const panel = panelRef.current;
    if (!covers || !panel) return;
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    panel.addEventListener('keydown', onTab);
    return () => panel.removeEventListener('keydown', onTab);
  }, [covers]);

  // Focus moves into the panel when it opens and back to what opened it when it closes,
  // and Escape closes it. Runs once per open, not on every parent render.
  useEffect(() => {
    const panel = panelRef.current;
    panel?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      // Not when a dialog on top already handled it, and not from a text field, where
      // Escape means "cancel what I'm typing" and closing would throw away a note
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable)) return;
      closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      // Give focus back only if it was in the panel; if the user has moved on (typing a
      // search that closed the panel), leave it where it is
      const active = document.activeElement;
      const focusWasHere = !active || active === document.body || (panel?.contains(active) ?? false);
      if (focusWasHere && opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [opener]);


  const fields: Array<{ label: string; value?: string }> = [
    { label: 'Status', value: contact.status },
    ...(contact.kind === 'client' ? [{ label: 'Loan Stage', value: contact.stage }] : []),
    { label: 'Temperature', value: contact.temperature },
    { label: 'Lead Source', value: contact.leadSource },
    { label: 'Referred By', value: contact.referredBy },
    { label: 'Phone', value: formatPhone(contact.phone) || undefined },
    { label: 'Email', value: contact.email },
    // The LO card covers this for realtors and admins; a loan officer sees only their own rows
    ...(role === 'loan_officer' ? [] : [{ label: 'Loan Officer', value: contact.ownerName }]),
  ];
  const meta = 'inline-flex min-w-0 items-center gap-1.5';
  const tel = formatPhone(contact.phone) && phoneHref(contact.phone) ? phoneHref(contact.phone) : '';
  // A loan stage for clients, else the lead status, then where the lead came from
  const chips = [contact.kind === 'client' ? contact.stage || 'Client' : contact.status, contact.leadSource]
    .filter((c): c is string => Boolean(c));
  const action = 'inline-flex h-11 items-center justify-center gap-1.5 rounded-md border bg-card text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-9';

  const panel = (
    <aside
      ref={panelRef}
      tabIndex={-1}
      role={covers ? 'dialog' : undefined}
      aria-modal={covers ? true : undefined}
      aria-label={`${contact.name || 'Contact'} details`}
      data-testid="contact-panel"
      className="fixed inset-0 z-50 flex flex-col bg-background focus:outline-none lg:static lg:z-auto lg:h-full lg:w-[400px] lg:shrink-0 lg:border-l xl:w-[480px]"
    >
      <div className="flex items-start justify-between gap-2 px-5 pb-3 pt-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="break-words text-lg font-semibold">{contact.name}</h2>
            {role === 'admin' && (
              <a
                href={`${SF_BASE_URL}/${contact.kind === 'lead' ? 'Lead' : 'Contact'}/${contact.id}/view`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Open in Salesforce (new tab)"
                title="Open in Salesforce"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {chips.map(c => <Badge key={c} variant="secondary">{c}</Badge>)}
            {contact.createdDate && (
              <span className={`${meta} ml-1 text-xs text-muted-foreground`} title="Created">
                <Calendar aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> <span className="sr-only">Created: </span>{formatDay(contact.createdDate)}
              </span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" title="Close (Esc)" className="-mr-2 h-10 w-10 shrink-0">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6 pt-1">
        {/* Reach the buyer in one tap - the realtor's most common move, first on a phone */}
        {(tel || contact.email) && (
          <div className="grid grid-cols-3 gap-2" data-testid="contact-actions">
            {tel ? (
              <a href={tel} className={action} aria-label={`Call ${contact.name}, ${formatPhone(contact.phone)}`}>
                <Phone aria-hidden="true" className="h-4 w-4" /> Call
              </a>
            ) : <span />}
            {tel ? (
              <a href={tel.replace(/^tel:/, 'sms:')} className={action} aria-label={`Text ${contact.name}`}>
                <MessageSquare aria-hidden="true" className="h-4 w-4" /> Text
              </a>
            ) : <span />}
            {contact.email ? (
              <a href={`mailto:${contact.email}`} className={action} aria-label={`Email ${contact.name}, ${contact.email}`}>
                <Mail aria-hidden="true" className="h-4 w-4" /> Email
              </a>
            ) : <span />}
          </div>
        )}

        <RealtorStageCard key={`stage-${contact.id}`} recordId={contact.id} role={role} />
        <LoanOfficerCard contact={contact} role={role} />
        <ContactNotes key={contact.id} recordId={contact.id} />

        <section aria-labelledby="panel-kind" className="mt-6">
          <h3 id="panel-kind" className="mb-2 text-sm font-medium text-muted-foreground">
            {contact.kind === 'client' ? 'Client details' : 'Lead details'}
          </h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 rounded-lg border bg-card p-4">
            {fields.map(f => (
              <div key={f.label} className="contents">
                <dt className="text-xs font-medium leading-5 text-muted-foreground">{f.label}</dt>
                <dd className="min-w-0 break-words text-sm leading-5">{f.value || <Empty />}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </aside>
  );

  // Outside #root when covering, so making #root inert leaves the panel usable
  return covers ? createPortal(panel, document.body) : panel;
}
