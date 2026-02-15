import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Save, Phone, Mail, User, Calendar } from 'lucide-react';
import type { ContactRow } from '@lead-lens/shared';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';

interface ContactDetailSheetProps {
  contact: ContactRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dropdowns: Record<string, Array<{ value: string; label: string }>>;
  role: 'admin' | 'loan_officer';
}

type FormState = Record<string, unknown>;

const LO_EDITABLE_FIELDS = new Set(['stage', 'status', 'temperature']);

const EDITABLE_FIELDS: Array<{
  section: string;
  fields: Array<{
    key: string;
    label: string;
    type: 'select' | 'checkbox' | 'textarea';
    sfField?: string;
  }>;
}> = [
  {
    section: 'Status & Tracking',
    fields: [
      { key: 'status', label: 'Status', type: 'select', sfField: 'Status__c' },
      { key: 'temperature', label: 'Temperature', type: 'select', sfField: 'Temparture__c' },
      { key: 'stage', label: 'Stage', type: 'select', sfField: 'MtgPlanner_CRM__Stage__c' },
      { key: 'noOfCalls', label: '# Calls', type: 'select', sfField: 'No_of_Calls__c' },
    ],
  },
  {
    section: 'Flags',
    fields: [
      { key: 'hotLead', label: 'Hot Lead', type: 'checkbox' },
      { key: 'paal', label: 'PAAL', type: 'checkbox' },
      { key: 'inProcess', label: 'In Process', type: 'checkbox' },
      { key: 'thankYouToReferralSource', label: 'Thank You to Referral Source', type: 'checkbox' },
    ],
  },
  {
    section: 'Details',
    fields: [
      { key: 'message', label: 'Message', type: 'textarea' },
      { key: 'leadSource', label: 'Lead Source', type: 'select', sfField: 'LeadSource' },
      { key: 'bdr', label: 'BDR', type: 'select', sfField: 'BDR__c' },
      { key: 'loanPartner', label: 'Loan Partner', type: 'select', sfField: 'Loan_Partners__c' },
    ],
  },
];

export function ContactDetailSheet({
  contact,
  open,
  onOpenChange,
  dropdowns,
  role,
}: ContactDetailSheetProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (contact) {
      const initial: FormState = {};
      for (const section of EDITABLE_FIELDS) {
        for (const f of section.fields) {
          initial[f.key] = contact[f.key as keyof ContactRow] ?? (f.type === 'checkbox' ? false : '');
        }
      }
      setForm(initial);
      setError('');
    }
  }, [contact]);

  if (!contact) return null;

  const isEditable = (fieldKey: string) => {
    if (role === 'admin') return true;
    return LO_EDITABLE_FIELDS.has(fieldKey);
  };

  const setField = (key: string, value: unknown) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const getChangedFields = (): Record<string, unknown> => {
    const changed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(form)) {
      const original = contact[key as keyof ContactRow];
      const orig = original ?? (typeof value === 'boolean' ? false : '');
      if (value !== orig) {
        changed[key] = value;
      }
    }
    return changed;
  };

  const handleSave = async () => {
    const changed = getChangedFields();
    if (Object.keys(changed).length === 0) {
      onOpenChange(false);
      return;
    }

    setSaving(true);
    setError('');
    try {
      await api.patch('/contacts', { updates: [{ id: contact.id, fields: changed }] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = Object.keys(getChangedFields()).length > 0;

  const formatDate = (val?: string) => (val ? new Date(val).toLocaleDateString() : '');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col sm:max-w-lg">
        <SheetHeader className="pb-0">
          <SheetTitle className="text-xl">{contact.name}</SheetTitle>
          <SheetDescription className="sr-only">Contact details</SheetDescription>
        </SheetHeader>

        {/* Contact info strip */}
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
          {contact.email && (
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> {contact.email}
            </span>
          )}
          {contact.phone && (
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" /> {contact.phone}
            </span>
          )}
          {contact.mobilePhone && !contact.phone && (
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" /> {contact.mobilePhone}
            </span>
          )}
          {contact.ownerName && (
            <span className="inline-flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> {contact.ownerName}
            </span>
          )}
          {contact.createdDate && (
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> {formatDate(contact.createdDate)}
            </span>
          )}
        </div>

        <Separator />

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 pb-4">
            {EDITABLE_FIELDS.map(section => {
              const visibleFields = section.fields.filter(f => {
                if (role === 'admin') return true;
                return LO_EDITABLE_FIELDS.has(f.key);
              });
              if (visibleFields.length === 0) return null;

              return (
                <section key={section.section}>
                  <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                    {section.section}
                  </h3>
                  <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                    {visibleFields.map(f => {
                      const editable = isEditable(f.key);

                      if (f.type === 'select') {
                        const options = f.sfField ? dropdowns[f.sfField] || [] : [];
                        return (
                          <div key={f.key} className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">{f.label}</Label>
                            {editable ? (
                              <select
                                value={(form[f.key] as string) ?? ''}
                                onChange={e => setField(f.key, e.target.value || undefined)}
                                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                              >
                                <option value="">Select...</option>
                                {options.map(o => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                            ) : (
                              <p className="text-sm">{(form[f.key] as string) || '—'}</p>
                            )}
                          </div>
                        );
                      }

                      if (f.type === 'checkbox') {
                        return (
                          <div key={f.key} className="flex items-center gap-2.5">
                            <Checkbox
                              id={`sheet-${f.key}`}
                              checked={Boolean(form[f.key])}
                              onCheckedChange={checked => setField(f.key, Boolean(checked))}
                              disabled={!editable}
                            />
                            <Label htmlFor={`sheet-${f.key}`} className="text-sm font-normal">
                              {f.label}
                            </Label>
                          </div>
                        );
                      }

                      if (f.type === 'textarea') {
                        return (
                          <div key={f.key} className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">{f.label}</Label>
                            {editable ? (
                              <Input
                                value={(form[f.key] as string) ?? ''}
                                onChange={e => setField(f.key, e.target.value || undefined)}
                                placeholder="Add a message..."
                              />
                            ) : (
                              <p className="text-sm">{(form[f.key] as string) || '—'}</p>
                            )}
                          </div>
                        );
                      }

                      return null;
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </ScrollArea>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <SheetFooter className="flex-row gap-2 border-t pt-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={saving || !hasChanges}
          >
            <Save className="mr-1.5 h-4 w-4" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
