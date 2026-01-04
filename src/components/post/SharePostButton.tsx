import { useState } from "react";
import { Share2, Send, Copy, BookOpen, Repeat2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { SharePostToMessageDialog } from "./SharePostToMessageDialog";
import { ShareToStoryDialog } from "./ShareToStoryDialog";

interface SharePostButtonProps {
  postId: string;
  mediaUrl: string | null;
  caption?: string | null;
}

export const SharePostButton = ({ postId, mediaUrl, caption }: SharePostButtonProps) => {
  const { toast } = useToast();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [storyDialogOpen, setStoryDialogOpen] = useState(false);

  const handleCopyLink = () => {
    const postUrl = `${window.location.origin}/post/${postId}`;
    navigator.clipboard.writeText(postUrl);
    toast({
      title: "Link copied",
      description: "Post link copied to clipboard",
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
          <DropdownMenuItem onClick={() => setStoryDialogOpen(true)}>
            <BookOpen className="h-4 w-4 mr-2" />
            Share to Story
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setStoryDialogOpen(true)}>
            <Repeat2 className="h-4 w-4 mr-2" />
            Repost with Caption
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShareDialogOpen(true)}>
            <Send className="h-4 w-4 mr-2" />
            Send as Message
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopyLink}>
            <Copy className="h-4 w-4 mr-2" />
            Copy Link
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

      <ShareToStoryDialog
        open={storyDialogOpen}
        onOpenChange={setStoryDialogOpen}
        postId={postId}
        mediaUrl={mediaUrl}
        originalCaption={caption}
      />
    </>
  );
};
