import { useState } from "react";
import { MoreHorizontal, Share2, Trash2, Flag, Send, Copy, ExternalLink } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ReportDialog } from "@/components/user/ReportDialog";
import { SharePostToMessageDialog } from "./SharePostToMessageDialog";

interface PostOptionsMenuProps {
  postId: string;
  postUserId: string;
  mediaUrl: string | null;
  caption?: string | null;
  onDeleted?: () => void;
}

export const PostOptionsMenu = ({
  postId,
  postUserId,
  mediaUrl,
  caption,
  onDeleted,
}: PostOptionsMenuProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const isOwner = user?.id === postUserId;

  const handleCopyLink = () => {
    const postUrl = `${window.location.origin}/post/${postId}`;
    navigator.clipboard.writeText(postUrl);
    toast({
      title: "Link copied",
      description: "Post link copied to clipboard",
    });
  };

  const handleShareToFeed = async () => {
    // For now, just copy link - actual repost feature would need schema changes
    handleCopyLink();
    toast({
      title: "Share to feed",
      description: "You can paste the link in your post caption to share",
    });
  };

  const handleDelete = async () => {
    if (!user || !isOwner) return;

    setDeleting(true);
    try {
      // Delete post media from storage if exists
      if (mediaUrl && mediaUrl.includes("/storage/")) {
        const path = mediaUrl.split("/media/")[1];
        if (path) {
          await supabase.storage.from("media").remove([path]);
        }
      }

      // Delete post
      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", postId)
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Post deleted",
        description: "Your post has been deleted",
      });

      onDeleted?.();
    } catch (error) {
      console.error("Error deleting post:", error);
      toast({
        title: "Error",
        description: "Failed to delete post",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="p-2 rounded-full hover:bg-muted transition-colors">
            <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={handleShareToFeed}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Share to feed
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShareDialogOpen(true)}>
                <Send className="h-4 w-4 mr-2" />
                Send as message
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyLink}>
                <Copy className="h-4 w-4 mr-2" />
                Copy link
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          {isOwner ? (
            <DropdownMenuItem
              onClick={() => setDeleteDialogOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete post
            </DropdownMenuItem>
          ) : (
            <ReportDialog
              reportedPostId={postId}
              trigger={
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <Flag className="h-4 w-4 mr-2" />
                  Report post
                </DropdownMenuItem>
              }
            />
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your post
              and all associated comments and likes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share to Message Dialog */}
      <SharePostToMessageDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        postId={postId}
        mediaUrl={mediaUrl}
        caption={caption}
      />
    </>
  );
};
