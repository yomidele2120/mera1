import { useState, useRef } from "react";
import { Upload, FileText, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";

interface ContactImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export const ContactImportDialog = ({
  open,
  onOpenChange,
  onImported,
}: ContactImportDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [importMode, setImportMode] = useState<"file" | "manual">("manual");

  const parseContacts = (text: string): { userId: string; name?: string }[] => {
    const contacts: { userId: string; name?: string }[] = [];
    const lines = text.split(/[\n,;]+/).map((l) => l.trim()).filter(Boolean);

    for (const line of lines) {
      // Format: "90XXXXXXXX:Name" or just "90XXXXXXXX"
      const match = line.match(/^(\d{10})(?::(.+))?$/);
      if (match) {
        contacts.push({ userId: match[1], name: match[2]?.trim() });
      }
    }

    return contacts;
  };

  const importContacts = async (contacts: { userId: string; name?: string }[]) => {
    if (!user || contacts.length === 0) return;

    setLoading(true);
    let imported = 0;
    let failed = 0;

    try {
      for (const contact of contacts) {
        // Find user by user_number
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_number", parseInt(contact.userId))
          .single();

        if (!profile || profile.id === user.id) {
          failed++;
          continue;
        }

        // Check if contact already exists
        const { data: existing } = await supabase
          .from("contacts")
          .select("id")
          .eq("user_id", user.id)
          .eq("contact_user_id", profile.id)
          .single();

        if (existing) {
          // Update custom name if provided
          if (contact.name) {
            await supabase
              .from("contacts")
              .update({ custom_name: contact.name })
              .eq("id", existing.id);
          }
          imported++;
        } else {
          // Insert new contact
          const { error } = await supabase.from("contacts").insert({
            user_id: user.id,
            contact_user_id: profile.id,
            custom_name: contact.name || null,
          });

          if (!error) imported++;
          else failed++;
        }
      }

      toast({
        title: "Import complete",
        description: `Imported ${imported} contacts${failed > 0 ? `, ${failed} failed` : ""}`,
      });

      if (imported > 0) {
        onImported();
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Import failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const contacts = parseContacts(text);
      if (contacts.length > 0) {
        importContacts(contacts);
      } else {
        toast({
          title: "No valid contacts found",
          description: "Please check the file format",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
  };

  const handleManualImport = () => {
    const contacts = parseContacts(manualInput);
    if (contacts.length > 0) {
      importContacts(contacts);
    } else {
      toast({
        title: "No valid contacts found",
        description: "Enter user IDs in format: 90XXXXXXXX or 90XXXXXXXX:Name",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Contacts</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <Button
            variant={importMode === "manual" ? "default" : "outline"}
            onClick={() => setImportMode("manual")}
            className="flex-1"
          >
            Manual
          </Button>
          <Button
            variant={importMode === "file" ? "default" : "outline"}
            onClick={() => setImportMode("file")}
            className="flex-1"
          >
            <Upload className="h-4 w-4 mr-2" />
            File
          </Button>
        </div>

        {importMode === "manual" ? (
          <div className="space-y-4">
            <div>
              <Label>Enter User IDs</Label>
              <Textarea
                placeholder="90XXXXXXXX:John Doe&#10;90XXXXXXXX:Jane&#10;90XXXXXXXX"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                rows={6}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Format: 90XXXXXXXX or 90XXXXXXXX:Name (one per line)
              </p>
            </div>
            <Button
              onClick={handleManualImport}
              disabled={loading || !manualInput.trim()}
              className="w-full"
            >
              {loading ? <LoadingSpinner size="sm" /> : "Import Contacts"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">Click to upload file</p>
              <p className="text-sm text-muted-foreground mt-1">
                TXT or CSV with user IDs
              </p>
            </div>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            {loading && (
              <div className="flex justify-center">
                <LoadingSpinner />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
