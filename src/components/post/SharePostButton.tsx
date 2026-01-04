import { useState } from "react";
import { Share2, Send, Copy, ExternalLink } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { SharePostToMessageDialog } from "./SharePostToMessageDialog";

interface SharePostButtonProps {
  postId: string;
  mediaUrl: string | null;
  caption?: string | null;
}

export const SharePostButton = ({ postId, mediaUrl, caption }: SharePostButtonProps) => {
  const { toast } = useToast();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const handleCopyLink = () => {
    const postUrl = `${window.location.origin}/post/${postId}`;
    navigator.clipboard.writeText(postUrl);
    toast({
      title: "Link copied",
      description: "Post link copied to clipboard",
    });
  };

  const handleShareToFeed = () => {
    handleCopyLink();
    toast({
      title: "Share to feed",
      description: "You can paste the link in your post caption to share",
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button>
            <Share2 className="h-6 w-6 text-foreground hover:text-muted-foreground transition-colors" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
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
        </DropdownMenuContent>
      </DropdownMenu>

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
