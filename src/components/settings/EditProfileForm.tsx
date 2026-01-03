import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Camera, Loader2 } from "lucide-react";
import { UserAvatar } from "@/components/common/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export const EditProfileForm = () => {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState(profile?.username || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [usernameError, setUsernameError] = useState("");

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const checkUsernameAvailability = async (newUsername: string) => {
    if (newUsername === profile?.username) {
      setUsernameError("");
      return true;
    }

    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", newUsername)
      .neq("id", profile?.id)
      .single();

    if (data) {
      setUsernameError("Username is already taken");
      return false;
    }

    setUsernameError("");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setIsLoading(true);

    // Check username availability
    const isAvailable = await checkUsernameAvailability(username);
    if (!isAvailable) {
      setIsLoading(false);
      return;
    }

    let avatarUrl = profile.avatar_url;

    // Upload new avatar if selected
    if (avatarFile) {
      const fileExt = avatarFile.name.split(".").pop();
      const fileName = `${profile.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(`avatars/${fileName}`, avatarFile);

      if (uploadError) {
        toast({
          title: "Upload failed",
          description: "Could not upload profile photo",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("media")
        .getPublicUrl(`avatars/${fileName}`);

      avatarUrl = urlData.publicUrl;
    }

    // Update profile
    const { error } = await supabase
      .from("profiles")
      .update({
        username,
        bio,
        avatar_url: avatarUrl,
      })
      .eq("id", profile.id);

    if (error) {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully",
      });
      refreshProfile();
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-6">
      {/* Avatar Upload */}
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <UserAvatar
            src={avatarPreview || profile?.avatar_url}
            fallback={username}
            size="xl"
          />
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-0 right-0 p-2 rounded-full gradient-primary text-primary-foreground shadow-lg"
          >
            <Camera className="h-4 w-4" />
          </motion.button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-sm font-semibold text-primary hover:underline"
        >
          Change profile photo
        </button>
      </div>

      {/* Username */}
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
            setUsernameError("");
          }}
          onBlur={() => checkUsernameAvailability(username)}
          placeholder="username"
          className="bg-muted/50"
        />
        {usernameError && (
          <p className="text-sm text-destructive">{usernameError}</p>
        )}
      </div>

      {/* Bio */}
      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, 150))}
          placeholder="Tell us about yourself..."
          rows={3}
          className="bg-muted/50 resize-none"
        />
        <p className="text-xs text-muted-foreground text-right">
          {bio.length}/150
        </p>
      </div>

      {/* Submit */}
      <Button
        type="submit"
        className="w-full gradient-primary"
        disabled={isLoading || !!usernameError}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Saving...
          </>
        ) : (
          "Save changes"
        )}
      </Button>
    </form>
  );
};
