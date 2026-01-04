import { useState } from "react";
import { motion } from "framer-motion";
import { Delete, Phone, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { UserAvatar } from "@/components/common/Avatar";

interface DialPadProps {
  onContactAdded?: () => void;
}

interface FoundUser {
  id: string;
  username: string;
  avatar_url: string | null;
  user_number: number | null;
}

export const DialPad = ({ onContactAdded }: DialPadProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [number, setNumber] = useState("");
  const [customName, setCustomName] = useState("");
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleDigitPress = (digit: string) => {
    if (number.length < 10) {
      setNumber((prev) => prev + digit);
    }
  };

  const handleDelete = () => {
    setNumber((prev) => prev.slice(0, -1));
    setFoundUser(null);
  };

  const handleClear = () => {
    setNumber("");
    setFoundUser(null);
    setCustomName("");
  };

  const handleSearch = async () => {
    if (!number || number.length < 10) {
      toast({ title: "Enter a valid 10-digit user ID", variant: "destructive" });
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, user_number")
        .eq("user_number", parseInt(number))
        .single();

      if (error || !data) {
        toast({ title: "User not found", variant: "destructive" });
        setFoundUser(null);
      } else {
        setFoundUser(data);
      }
    } catch (error) {
      toast({ title: "Error searching user", variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const handleSaveContact = async () => {
    if (!user || !foundUser) return;

    if (foundUser.id === user.id) {
      toast({ title: "Cannot add yourself as contact", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("contacts").upsert({
        user_id: user.id,
        contact_user_id: foundUser.id,
        custom_name: customName || null,
      }, {
        onConflict: "user_id,contact_user_id",
      });

      if (error) throw error;

      toast({ title: "Contact saved!" });
      handleClear();
      onContactAdded?.();
    } catch (error) {
      toast({ title: "Error saving contact", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

  return (
    <div className="space-y-4">
      {/* Display */}
      <div className="bg-muted rounded-xl p-4 text-center">
        <p className="text-2xl font-mono tracking-wider text-foreground min-h-[2rem]">
          {number || "Enter User ID"}
        </p>
      </div>

      {/* Dial Pad */}
      <div className="grid grid-cols-3 gap-2">
        {digits.map((digit) => (
          <motion.button
            key={digit}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleDigitPress(digit)}
            className="h-14 rounded-xl bg-card border border-border text-xl font-medium hover:bg-accent transition-colors"
          >
            {digit}
          </motion.button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={handleClear} className="flex-1">
          Clear
        </Button>
        <Button variant="outline" onClick={handleDelete} size="icon">
          <Delete className="h-4 w-4" />
        </Button>
        <Button onClick={handleSearch} disabled={searching} className="flex-1">
          <Phone className="h-4 w-4 mr-2" />
          {searching ? "Searching..." : "Search"}
        </Button>
      </div>

      {/* Found User */}
      {foundUser && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="border border-border rounded-xl p-4 space-y-4"
        >
          <div className="flex items-center gap-3">
            <UserAvatar src={foundUser.avatar_url} fallback={foundUser.username} size="md" />
            <div>
              <p className="font-medium">{foundUser.username}</p>
              <p className="text-sm text-muted-foreground">{foundUser.user_number}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customName">Save as (optional)</Label>
            <Input
              id="customName"
              placeholder="Enter custom name..."
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
          </div>

          <Button onClick={handleSaveContact} disabled={saving} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Contact"}
          </Button>
        </motion.div>
      )}
    </div>
  );
};
