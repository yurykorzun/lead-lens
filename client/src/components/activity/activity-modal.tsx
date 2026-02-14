import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ApiResponse } from '@lead-lens/shared';

interface Activity {
  id: string;
  type: string;
  subject: string;
  date: string;
  description?: string;
}

interface ActivityModalProps {
  contactId: string;
  contactName: string;
  open: boolean;
  onClose: () => void;
}

export function ActivityModal({ contactId, contactName, open, onClose }: ActivityModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['activity', contactId],
    queryFn: () => api.get<ApiResponse<Activity[]>>(`/contacts/${contactId}/activity`),
    enabled: open,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg" onClick={e => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-semibold">Activity: {contactName}</h2>
        {isLoading ? (
          <p className="text-muted-foreground">Loading activities...</p>
        ) : (
          <div className="max-h-96 space-y-3 overflow-y-auto">
            {data?.data && Array.isArray(data.data) && data.data.length > 0 ? (
              data.data.map((activity: Activity) => (
                <div key={activity.id} className="rounded border p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{activity.subject}</span>
                    <span className="text-xs text-muted-foreground">{activity.date}</span>
                  </div>
                  {activity.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{activity.description}</p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No activities found.</p>
            )}
          </div>
        )}
        <button className="mt-4 text-sm text-muted-foreground hover:text-foreground" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
