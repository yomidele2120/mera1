import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Pin, BellOff, Archive, MoreHorizontal, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface Topic {
  id: string;
  name: string;
  is_pinned: boolean;
  is_muted: boolean;
  is_archived: boolean;
  unread_count?: number;
}

interface TopicTabsProps {
  topics: Topic[];
  activeTopicId: string | null;
  onSelectTopic: (topicId: string) => void;
  onCreateTopic: (name: string) => void;
  onUpdateTopic: (topicId: string, updates: Partial<Topic>) => void;
}

export const TopicTabs = ({
  topics,
  activeTopicId,
  onSelectTopic,
  onCreateTopic,
  onUpdateTopic,
}: TopicTabsProps) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");

  // Sort topics: pinned first, then by name
  const sortedTopics = [...topics].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    if (a.is_archived && !b.is_archived) return 1;
    if (!a.is_archived && b.is_archived) return -1;
    return a.name.localeCompare(b.name);
  });

  const visibleTopics = sortedTopics.filter(t => !t.is_archived);

  const handleCreate = () => {
    if (newTopicName.trim()) {
      onCreateTopic(newTopicName.trim());
      setNewTopicName("");
      setIsCreating(false);
    }
  };

  return (
    <div className="border-b border-border bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-1 px-2 py-2 overflow-x-auto scrollbar-hide">
        {visibleTopics.map((topic) => (
          <motion.button
            key={topic.id}
            onClick={() => onSelectTopic(topic.id)}
            className={cn(
              "relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all",
              activeTopicId === topic.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            )}
            whileTap={{ scale: 0.95 }}
          >
            {topic.is_pinned && (
              <Pin className="h-3 w-3" />
            )}
            {topic.is_muted && (
              <BellOff className="h-3 w-3 opacity-50" />
            )}
            <span>{topic.name}</span>
            
            {topic.unread_count && topic.unread_count > 0 && (
              <span className="ml-1 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                {topic.unread_count > 99 ? "99+" : topic.unread_count}
              </span>
            )}

            {/* Topic options dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <button className="ml-1 opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100">
                  <MoreHorizontal className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card z-50">
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateTopic(topic.id, { is_pinned: !topic.is_pinned });
                  }}
                >
                  <Pin className="h-4 w-4 mr-2" />
                  {topic.is_pinned ? "Unpin" : "Pin"}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateTopic(topic.id, { is_muted: !topic.is_muted });
                  }}
                >
                  <BellOff className="h-4 w-4 mr-2" />
                  {topic.is_muted ? "Unmute" : "Mute"}
                </DropdownMenuItem>
                {topic.name !== "General" && (
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateTopic(topic.id, { is_archived: true });
                    }}
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    Archive
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </motion.button>
        ))}

        {/* Create new topic button */}
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full h-8 w-8 p-0 flex-shrink-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xs">
            <DialogHeader>
              <DialogTitle>New Topic</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Input
                placeholder="Topic name (e.g., Business, Plans)"
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="input-field"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsCreating(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="btn-primary flex-1"
                  onClick={handleCreate}
                  disabled={!newTopicName.trim()}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Create
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
