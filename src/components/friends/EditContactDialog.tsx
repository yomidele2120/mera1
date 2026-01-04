import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Contact {
  id: string;
  username: string;
  avatar_url: string | null;
  customName?: string | null;
  contactId?: string;
}

interface EditContactDialogProps {
  contact: Contact;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export const EditContactDialog = ({
  contact,
  open,
  onOpenChange,
  onSaved,
}: EditContactDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [customName, setCustomName] = useState(contact.customName || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      if (contact.contactId) {
        // Update existing contact
        await supabase
          .from("contacts")
          .update({ custom_name: customName || null })
          .eq("id", contact.contactId);
      } else {
        // Create new contact entry
        await supabase.from("contacts").insert({
          user_id: user.id,
          contact_user_id: contact.id,
          custom_name: customName || null,
        });
      }

      toast({ title: "Contact updated" });
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast({ title: "Error updating contact", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Contact Name</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Username</Label>
            <Input value={contact.username} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customName">Custom Name</Label>
            <Input
              id="customName"
              placeholder="Enter a custom name..."
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              This name will only be visible to you
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
