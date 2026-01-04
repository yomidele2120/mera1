import { useState } from "react";
import { motion } from "framer-motion";
import { X, Sparkles, BookOpen, Repeat2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface ShareToStoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  mediaUrl: string | null;
  originalCaption?: string | null;
}

export const ShareToStoryDialog = ({
  open,
  onOpenChange,
  postId,
  mediaUrl,
  originalCaption,
}: ShareToStoryDialogProps) => {
  const [tab, setTab] = useState<"story" | "repost">("story");
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleShareToStory = async () => {
    if (!user || !mediaUrl) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("stories").insert({
        user_id: user.id,
        media_url: mediaUrl,
      });

      if (error) throw error;

      toast({
        title: "Shared to story",
        description: "Post has been added to your story",
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to share to story",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRepost = async () => {
    if (!user || !mediaUrl) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        media_url: mediaUrl,
        caption: caption.trim() || `Reposted: ${originalCaption || ""}`.trim(),
        post_type: "image",
      });

      if (error) throw error;

      toast({
        title: "Reposted",
        description: "Post has been shared to your feed",
      });
      onOpenChange(false);
      setCaption("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to repost",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Post</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "story" | "repost")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="story" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Story
            </TabsTrigger>
            <TabsTrigger value="repost" className="flex items-center gap-2">
              <Repeat2 className="h-4 w-4" />
              Repost
            </TabsTrigger>
          </TabsList>

          <TabsContent value="story" className="space-y-4">
            {mediaUrl && (
              <div className="relative aspect-square max-h-48 mx-auto overflow-hidden rounded-lg">
                <img
                  src={mediaUrl}
                  alt="Post preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <p className="text-sm text-muted-foreground text-center">
              Share this post to your story. It will be visible for 24 hours.
            </p>
            <Button
              onClick={handleShareToStory}
              disabled={loading || !mediaUrl}
              className="btn-primary w-full"
            >
              {loading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Sparkles className="h-5 w-5" />
                </motion.div>
              ) : (
                "Add to Story"
              )}
            </Button>
          </TabsContent>

          <TabsContent value="repost" className="space-y-4">
            {mediaUrl && (
              <div className="relative aspect-square max-h-32 mx-auto overflow-hidden rounded-lg">
                <img
                  src={mediaUrl}
                  alt="Post preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div>
              <Textarea
                placeholder="Write your own caption..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="min-h-24 resize-none"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right mt-1">
                {caption.length}/500
              </p>
            </div>
            <Button
              onClick={handleRepost}
              disabled={loading || !mediaUrl}
              className="btn-primary w-full"
            >
              {loading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Sparkles className="h-5 w-5" />
                </motion.div>
              ) : (
                "Repost to Feed"
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
