import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Phone, Mail, User, Calendar, ExternalLink } from 'lucide-react';
import type { ContactRow } from '@lead-lens/shared';
import { Button } from '@/components/ui/button';
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

// Read-only toward Salesforce for every role. No Salesforce notes, Activity or History: in
// lgc-ci those carry the team's internal notes. The Notes section below is Lead Lens's own,
// stored in its database and never written to Salesforce.
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
  ];
  const meta = 'inline-flex min-w-0 items-center gap-1.5';
  const metaLink = `${meta} min-h-7 rounded-sm hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`;

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
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {contact.email && (
              <a href={`mailto:${contact.email}`} className={metaLink}>
                <Mail aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{contact.email}</span>
              </a>
            )}
            {formatPhone(contact.phone) && phoneHref(contact.phone) && (
              <a href={phoneHref(contact.phone)} className={metaLink}>
                <Phone aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> {formatPhone(contact.phone)}
              </a>
            )}
            {contact.ownerName && (
              <span className={meta} title="Owner">
                <User aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> <span className="sr-only">Owner: </span>{contact.ownerName}
              </span>
            )}
            {contact.createdDate && (
              <span className={meta} title="Created">
                <Calendar aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> <span className="sr-only">Created: </span>{formatDay(contact.createdDate)}
              </span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" title="Close (Esc)" className="-mr-2 h-10 w-10 shrink-0">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6 pt-2">
        <section aria-labelledby="panel-kind">
          <h3 id="panel-kind" className="mb-2 text-sm font-medium text-muted-foreground">
            {contact.kind === 'client' ? 'Client details' : 'Lead details'}
          </h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 rounded-lg border bg-card p-4">
            {fields.map(f => (
              <div key={f.label} className="contents">
                <dt className="text-xs font-medium leading-5 text-muted-foreground">{f.label}</dt>
                <dd className="text-sm leading-5">{f.value || <Empty />}</dd>
              </div>
            ))}
          </dl>
        </section>

        <ContactNotes key={contact.id} recordId={contact.id} />
      </div>
    </aside>
  );

  // Outside #root when covering, so making #root inert leaves the panel usable
  return covers ? createPortal(panel, document.body) : panel;
}
