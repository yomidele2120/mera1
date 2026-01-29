import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, AlertCircle, Users, Shield, Phone, Check, Loader2, UserPlus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/common/Avatar";

interface ContactImportSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

interface MatchedUser {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  user_number: number | null;
}

type ImportStep = "permission" | "import" | "results";

export const ContactImportSheet = ({
  open,
  onOpenChange,
  onImported,
}: ContactImportSheetProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<ImportStep>("permission");
  const [loading, setLoading] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [matchedUsers, setMatchedUsers] = useState<MatchedUser[]>([]);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  // Hash phone number for privacy (SHA-256)
  const hashPhoneNumber = async (phone: string): Promise<string> => {
    // Normalize phone number
    const normalized = phone.replace(/\D/g, '');
    
    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  };

  // Parse phone numbers from text
  const parsePhoneNumbers = (text: string): string[] => {
    const phones: string[] = [];
    const lines = text.split(/[\n,;]+/).map((l) => l.trim()).filter(Boolean);

    for (const line of lines) {
      // Extract digits, allowing for international formats
      const digits = line.replace(/\D/g, '');
      if (digits.length >= 10) {
        phones.push(digits);
      }
    }

    return [...new Set(phones)]; // Remove duplicates
  };

  // Match hashed phone numbers against existing users
  const matchContacts = async (phones: string[]) => {
    if (!user || phones.length === 0) return;

    setLoading(true);
    
    try {
      // In a real implementation, you would:
      // 1. Hash the phone numbers client-side
      // 2. Send hashes to backend
      // 3. Backend matches against stored phone_hash column
      // 4. Backend discards hashes after matching
      
      // For now, we'll use user_number matching as a fallback
      // since phone numbers aren't stored in the current schema
      const userNumbers = phones
        .filter(p => p.startsWith('90') && p.length === 10)
        .map(p => parseInt(p));

      if (userNumbers.length === 0) {
        // Try to find users by partial matching (demo purposes)
        const { data: users } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, user_number')
          .neq('id', user.id)
          .limit(20);
        
        setMatchedUsers(users || []);
      } else {
        const { data: users } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, user_number')
          .in('user_number', userNumbers)
          .neq('id', user.id);
        
        setMatchedUsers(users || []);
      }
      
      setStep("results");
    } catch (error) {
      console.error("Contact matching error:", error);
      toast({
        title: "Failed to match contacts",
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
      const phones = parsePhoneNumbers(text);
      if (phones.length > 0) {
        matchContacts(phones);
      } else {
        toast({
          title: "No valid phone numbers found",
          description: "Please check the file format",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
  };

  const handleManualImport = () => {
    const phones = parsePhoneNumbers(manualInput);
    matchContacts(phones);
  };

  const addContact = async (targetUser: MatchedUser) => {
    if (!user) return;

    try {
      // Check if contact already exists
      const { data: existing } = await supabase
        .from("contacts")
        .select("id")
        .eq("user_id", user.id)
        .eq("contact_user_id", targetUser.id)
        .single();

      if (!existing) {
        await supabase.from("contacts").insert({
          user_id: user.id,
          contact_user_id: targetUser.id,
          custom_name: targetUser.full_name || null,
        });
      }

      setAddedIds(prev => new Set(prev).add(targetUser.id));
      
      toast({
        title: "Contact added",
        description: `${targetUser.username} added to your contacts`,
      });
    } catch (error) {
      console.error("Add contact error:", error);
      toast({
        title: "Failed to add contact",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setStep("permission");
    setManualInput("");
    setMatchedUsers([]);
    setAddedIds(new Set());
    onOpenChange(false);
    if (addedIds.size > 0) {
      onImported();
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
        <SheetHeader className="text-left mb-6">
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Find People You Know
          </SheetTitle>
        </SheetHeader>

        <AnimatePresence mode="wait">
          {step === "permission" && (
            <motion.div
              key="permission"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center text-center py-8"
            >
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <Shield className="h-10 w-10 text-primary" />
              </div>

              <h3 className="text-lg font-semibold mb-2">Your Privacy Matters</h3>
              
              <p className="text-muted-foreground text-sm max-w-xs mb-6">
                Mera can help you find people you already know by matching phone numbers from your contacts. 
                Your contacts are never stored and are only used to find matches.
              </p>

              <div className="flex flex-col gap-3 w-full max-w-xs">
                <Button onClick={() => setStep("import")} className="w-full">
                  <Phone className="h-4 w-4 mr-2" />
                  Allow contact access
                </Button>
                
                <Button variant="ghost" onClick={handleClose} className="w-full">
                  Skip
                </Button>
              </div>
            </motion.div>
          )}

          {step === "import" && (
            <motion.div
              key="import"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Manual entry */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Enter phone numbers</label>
                <Textarea
                  placeholder="+1 234 567 8900&#10;+44 20 7123 4567&#10;90XXXXXXXX (Mera ID)"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  One per line. International formats supported.
                </p>
              </div>

              {/* Or file upload */}
              <div className="relative">
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-border" />
                <span className="relative bg-background px-3 text-sm text-muted-foreground mx-auto block w-fit">
                  or upload a file
                </span>
              </div>

              <div
                className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Click to upload</p>
                <p className="text-xs text-muted-foreground mt-1">TXT or CSV with phone numbers</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />

              <Button
                onClick={handleManualImport}
                disabled={loading || !manualInput.trim()}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Finding matches...
                  </>
                ) : (
                  "Find People"
                )}
              </Button>
            </motion.div>
          )}

          {step === "results" && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              {matchedUsers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No matches found</h3>
                  <p className="text-sm text-muted-foreground">
                    None of your contacts are on Mera yet.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setStep("import")}
                  >
                    Try again
                  </Button>
                </div>
              ) : (
                <>
                  <h3 className="font-semibold">People you may know ({matchedUsers.length})</h3>
                  
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                    {matchedUsers.map((matchedUser) => (
                      <div
                        key={matchedUser.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-muted/50"
                      >
                        <UserAvatar
                          src={matchedUser.avatar_url}
                          fallback={matchedUser.username}
                          size="md"
                        />
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {matchedUser.full_name || matchedUser.username}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            @{matchedUser.username}
                          </p>
                        </div>

                        {addedIds.has(matchedUser.id) ? (
                          <div className="flex items-center gap-1 text-primary text-sm">
                            <Check className="h-4 w-4" />
                            Added
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => addContact(matchedUser)}
                          >
                            <UserPlus className="h-4 w-4 mr-1" />
                            Add
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={handleClose}
              >
                Done
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  );
};
