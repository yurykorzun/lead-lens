import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, X, Phone, Mail, User, Calendar, ExternalLink } from 'lucide-react';
import type { ContactRow } from '@lead-lens/shared';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

export interface ContactDetailPanelProps {
  contact: ContactRow;
  onClose: () => void;
  dropdowns: Record<string, Array<{ value: string; label: string }>>;
  role: 'admin' | 'loan_officer' | 'agent';
}

type FormState = Record<string, unknown>;

const RESTRICTED_EDITABLE_FIELDS = new Set(['stage', 'status', 'temperature', 'lastTouch']);

const SF_BASE_URL = 'https://leonbelov.my.salesforce.com';

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
      { key: 'lastTouch', label: 'Last Touch', type: 'textarea' },
    ],
  },
  {
    section: 'Details',
    fields: [
      { key: 'message', label: 'Message', type: 'textarea' },
    ],
  },
];

interface ActivityItem {
  type: 'sf_task' | 'audit';
  date: string;
  subject?: string;
  description?: string;
  status?: string;
  action?: string;
  changes?: Record<string, unknown>;
}

interface HistoryItem {
  field: string;
  oldValue: string | null;
  newValue: string | null;
  date: string;
  changedBy?: string;
}

function useActivity(contactId: string) {
  return useQuery({
    queryKey: ['activity', contactId],
    queryFn: () => api.get<{ success: boolean; data: ActivityItem[] }>(`/contacts/${contactId}/activity`),
  });
}

function useHistory(contactId: string) {
  return useQuery({
    queryKey: ['history', contactId],
    queryFn: () => api.get<{ success: boolean; data: HistoryItem[] }>(`/contacts/${contactId}/history`),
  });
}

export function ContactDetailPanel({
  contact,
  onClose,
  dropdowns,
  role,
}: ContactDetailPanelProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('details');

  useEffect(() => {
    const initial: FormState = {};
    for (const section of EDITABLE_FIELDS) {
      for (const f of section.fields) {
        initial[f.key] = contact[f.key as keyof ContactRow] ?? (f.type === 'checkbox' ? false : '');
      }
    }
    setForm(initial);
    setError('');
  }, [contact]);

  const isEditable = (fieldKey: string) => {
    if (role === 'admin') return true;
    return RESTRICTED_EDITABLE_FIELDS.has(fieldKey);
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
    if (Object.keys(changed).length === 0) return;

    setSaving(true);
    setError('');
    try {
      await api.patch('/contacts', { updates: [{ id: contact.id, fields: changed }] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact saved');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = Object.keys(getChangedFields()).length > 0;
  const formatDate = (val?: string) => (val ? new Date(val).toLocaleDateString() : '');

  return (
    <div className="flex h-full w-[400px] shrink-0 flex-col border-l bg-background xl:w-[480px]">
      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-lg font-semibold">{contact.name}</h2>
            <a
              href={`${SF_BASE_URL}/${contact.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-muted-foreground hover:text-foreground"
              title="Open in Salesforce"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
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
            {contact.mobilePhone && contact.mobilePhone !== contact.phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 shrink-0" /> {contact.mobilePhone}
              </span>
            )}
            {contact.ownerName && (
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 shrink-0" /> {contact.ownerName}
              </span>
            )}
            {contact.createdDate && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 shrink-0" /> {formatDate(contact.createdDate)}
              </span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="-mr-2 -mt-1 shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-5 mb-0 shrink-0">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-0 flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="space-y-5">
              {/* Description (read-only) */}
              {contact.description && (
                <section>
                  <h3 className="mb-3 text-sm font-medium text-muted-foreground">Description</h3>
                  <p className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 text-sm">
                    {contact.description}
                  </p>
                </section>
              )}

              {EDITABLE_FIELDS.map(section => {
                const visibleFields = section.fields.filter(f => {
                  if (role === 'admin') return true;
                  return RESTRICTED_EDITABLE_FIELDS.has(f.key);
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
                                id={`panel-${f.key}`}
                                checked={Boolean(form[f.key])}
                                onCheckedChange={checked => setField(f.key, Boolean(checked))}
                                disabled={!editable}
                              />
                              <Label htmlFor={`panel-${f.key}`} className="text-sm font-normal">
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
          </div>

          {/* Save/Cancel footer — only on Details tab */}
          {error && (
            <p className="px-5 text-sm text-destructive">{error}</p>
          )}
          <div className="flex gap-2 border-t px-5 py-3">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving || !hasChanges}>
              <Save className="mr-1.5 h-4 w-4" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-0 min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <ActivityTab contactId={contact.id} />
        </TabsContent>

        <TabsContent value="history" className="mt-0 min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <HistoryTab contactId={contact.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ActivityTab({ contactId }: { contactId: string }) {
  const { data, isLoading } = useActivity(contactId);
  const activities = data?.data ?? [];

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading activity...</p>;
  }

  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity found.</p>;
  }

  return (
    <div className="space-y-3">
      {activities.map((item, i) => (
        <div key={i} className="rounded-lg border bg-muted/30 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {item.type === 'sf_task' ? (
                <>
                  <p className="text-sm font-medium">{item.subject || 'Task'}</p>
                  {item.status && (
                    <p className="text-xs text-muted-foreground">Status: {item.status}</p>
                  )}
                  {item.description && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-3">{item.description}</p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">Edit: {item.action}</p>
                  {item.changes && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {Object.entries(item.changes).map(([k, v]) => `${k}: ${v}`).join(', ')}
                    </p>
                  )}
                </>
              )}
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {item.date ? new Date(item.date).toLocaleDateString() : ''}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoryTab({ contactId }: { contactId: string }) {
  const { data, isLoading } = useHistory(contactId);
  const history = data?.data ?? [];

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading history...</p>;
  }

  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground">No field changes recorded.</p>;
  }

  return (
    <div className="space-y-3">
      {history.map((item, i) => (
        <div key={i} className="rounded-lg border bg-muted/30 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{item.field}</p>
              <p className="text-xs text-muted-foreground">
                {item.oldValue ?? '(empty)'} → {item.newValue ?? '(empty)'}
              </p>
              {item.changedBy && (
                <p className="mt-0.5 text-xs text-muted-foreground">by {item.changedBy}</p>
              )}
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {item.date ? new Date(item.date).toLocaleDateString() : ''}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
