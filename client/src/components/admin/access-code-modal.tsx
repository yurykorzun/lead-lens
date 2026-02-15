import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface AccessCodeModalProps {
  open: boolean;
  onClose: () => void;
  name: string;
  accessCode: string;
}

export function AccessCodeModal({ open, onClose, name, accessCode }: AccessCodeModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(accessCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Access Code for {name}</DialogTitle>
          <DialogDescription>
            Share this code with the loan officer. It will only be shown once.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border bg-muted p-4">
            <code className="flex-1 text-center text-2xl font-mono font-bold tracking-wider">
              {accessCode}
            </code>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            The loan officer will use this code along with their email to sign in.
          </p>
          <Button className="w-full" onClick={onClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
