import { useState } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface ReportDialogProps {
  reportedUserId?: string;
  reportedPostId?: string;
  reportedMessageId?: string;
  trigger?: React.ReactNode;
}

const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "violence", label: "Violence or threats" },
  { value: "impersonation", label: "Impersonation" },
  { value: "other", label: "Other" },
];

export const ReportDialog = ({
  reportedUserId,
  reportedPostId,
  reportedMessageId,
  trigger,
}: ReportDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user || !reason) return;

    setLoading(true);
    try {
      await supabase.from("reports").insert({
        reporter_id: user.id,
        reason: details ? `${reason}: ${details}` : reason,
        reported_user_id: reportedUserId || null,
        reported_post_id: reportedPostId || null,
        reported_message_id: reportedMessageId || null,
      });

      toast({
        title: "Report submitted",
        description: "Thank you for helping keep our community safe.",
      });
      setOpen(false);
      setReason("");
      setDetails("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="text-destructive">
            <Flag className="h-4 w-4 mr-1" />
            Report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report Content</DialogTitle>
          <DialogDescription>
            Help us understand what's wrong. Your report is anonymous.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <RadioGroup value={reason} onValueChange={setReason}>
            {REPORT_REASONS.map((r) => (
              <div key={r.value} className="flex items-center space-x-2">
                <RadioGroupItem value={r.value} id={r.value} />
                <Label htmlFor={r.value}>{r.label}</Label>
              </div>
            ))}
          </RadioGroup>

          {reason && (
            <div>
              <Label>Additional details (optional)</Label>
              <Textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Provide more context..."
                className="mt-1"
              />
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={!reason || loading}
            className="w-full"
          >
            {loading ? "Submitting..." : "Submit Report"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
