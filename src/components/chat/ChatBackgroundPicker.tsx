import { useState, useRef } from "react";
import { Image, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";

const PRESET_BACKGROUNDS = [
  "https://images.unsplash.com/photo-1557683316-973673baf926?w=800&q=80",
  "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80",
  "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=800&q=80",
  "https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=800&q=80",
  "https://images.unsplash.com/photo-1518655048521-f130df041f66?w=800&q=80",
  "https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?w=800&q=80",
];

interface ChatBackgroundPickerProps {
  currentBackground: string | null;
  onBackgroundChange: (url: string | null) => void;
}

export const ChatBackgroundPicker = ({
  currentBackground,
  onBackgroundChange,
}: ChatBackgroundPickerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectPreset = async (url: string) => {
    if (!user) return;
    
    try {
      await supabase
        .from("profiles")
        .update({ chat_background_url: url })
        .eq("id", user.id);
      
      onBackgroundChange(url);
      toast({ title: "Background updated" });
      setIsOpen(false);
    } catch (error) {
      console.error("Error updating background:", error);
      toast({ title: "Failed to update background", variant: "destructive" });
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/chat-bg-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("media")
        .getPublicUrl(fileName);

      await supabase
        .from("profiles")
        .update({ chat_background_url: urlData.publicUrl })
        .eq("id", user.id);

      onBackgroundChange(urlData.publicUrl);
      toast({ title: "Background uploaded" });
      setIsOpen(false);
    } catch (error) {
      console.error("Error uploading background:", error);
      toast({ title: "Failed to upload background", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = async () => {
    if (!user) return;
    
    try {
      await supabase
        .from("profiles")
        .update({ chat_background_url: null })
        .eq("id", user.id);
      
      onBackgroundChange(null);
      toast({ title: "Background removed" });
      setIsOpen(false);
    } catch (error) {
      console.error("Error removing background:", error);
      toast({ title: "Failed to remove background", variant: "destructive" });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button className="p-2 rounded-full hover:bg-muted transition-colors">
          <Image className="h-5 w-5 text-muted-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chat Background</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {PRESET_BACKGROUNDS.map((url) => (
              <button
                key={url}
                onClick={() => handleSelectPreset(url)}
                className="relative aspect-video rounded-lg overflow-hidden hover:ring-2 ring-primary transition-all"
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
                {currentBackground === url && (
                  <div className="absolute inset-0 bg-primary/50 flex items-center justify-center">
                    <Check className="h-6 w-6 text-primary-foreground" />
                  </div>
                )}
              </button>
            ))}
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex-1"
            >
              {isUploading ? <LoadingSpinner size="sm" /> : "Upload Custom"}
            </Button>
            {currentBackground && (
              <Button variant="outline" onClick={handleRemove}>
                <X className="h-4 w-4 mr-2" />
                Remove
              </Button>
            )}
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
