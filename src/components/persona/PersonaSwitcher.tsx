import { useState } from "react";
import { ChevronDown, Plus, Check, User, Briefcase, Users, Ghost } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/common/Avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface Persona {
  id: string;
  user_id?: string;
  persona_type: "public" | "friends" | "business" | "anonymous";
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_default: boolean;
  privacy_level?: string;
  created_at?: string;
  updated_at?: string;
}

interface PersonaSwitcherProps {
  personas: Persona[];
  activePersona: Persona | null;
  onSelectPersona: (persona: Persona) => void;
  onCreatePersona: (data: Partial<Persona>) => void;
  compact?: boolean;
}

const PERSONA_ICONS = {
  public: User,
  friends: Users,
  business: Briefcase,
  anonymous: Ghost,
};

const PERSONA_LABELS = {
  public: "Public",
  friends: "Friends",
  business: "Business",
  anonymous: "Anonymous",
};

const PERSONA_COLORS = {
  public: "text-blue-500",
  friends: "text-green-500",
  business: "text-amber-500",
  anonymous: "text-purple-500",
};

export const PersonaSwitcher = ({
  personas,
  activePersona,
  onSelectPersona,
  onCreatePersona,
  compact = false,
}: PersonaSwitcherProps) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newPersona, setNewPersona] = useState<Partial<Persona>>({
    persona_type: "friends",
    username: "",
    display_name: "",
    bio: "",
  });

  const handleCreate = () => {
    if (newPersona.username?.trim()) {
      onCreatePersona(newPersona);
      setNewPersona({
        persona_type: "friends",
        username: "",
        display_name: "",
        bio: "",
      });
      setIsCreating(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(
            "flex items-center gap-2 px-2 py-1 rounded-lg transition-colors hover:bg-muted",
            compact && "p-1"
          )}>
            {activePersona ? (
              <>
                <div className="relative">
                  <UserAvatar
                    src={activePersona.avatar_url}
                    fallback={activePersona.username}
                    size="xs"
                  />
                  <div className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
                    activePersona.persona_type === "public" && "bg-blue-500",
                    activePersona.persona_type === "friends" && "bg-green-500",
                    activePersona.persona_type === "business" && "bg-amber-500",
                    activePersona.persona_type === "anonymous" && "bg-purple-500"
                  )} />
                </div>
                {!compact && (
                  <>
                    <span className="text-sm font-medium truncate max-w-24">
                      @{activePersona.username}
                    </span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </>
                )}
              </>
            ) : (
              <>
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-3 w-3" />
                </div>
                {!compact && <ChevronDown className="h-3 w-3 text-muted-foreground" />}
              </>
            )}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-64 bg-card z-50">
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            Switch Persona
          </div>
          
          {personas.map((persona) => {
            const PersonaIcon = PERSONA_ICONS[persona.persona_type];
            const isActive = activePersona?.id === persona.id;
            
            return (
              <DropdownMenuItem
                key={persona.id}
                onClick={() => onSelectPersona(persona)}
                className={cn(
                  "flex items-center gap-3 px-2 py-2",
                  isActive && "bg-muted"
                )}
              >
                <UserAvatar
                  src={persona.avatar_url}
                  fallback={persona.username}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium truncate">@{persona.username}</span>
                    <PersonaIcon className={cn("h-3 w-3", PERSONA_COLORS[persona.persona_type])} />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {PERSONA_LABELS[persona.persona_type]}
                    {persona.is_default && " • Default"}
                  </p>
                </div>
                {isActive && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
            );
          })}

          <DropdownMenuSeparator />
          
          <DropdownMenuItem
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 text-primary"
          >
            <Plus className="h-4 w-4" />
            <span>Create New Persona</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Persona Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create New Persona</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            {/* Persona Type Selection */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["friends", "business", "anonymous"] as const).map((type) => {
                  const TypeIcon = PERSONA_ICONS[type];
                  const isSelected = newPersona.persona_type === type;
                  
                  return (
                    <button
                      key={type}
                      onClick={() => setNewPersona({ ...newPersona, persona_type: type })}
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-xl border-2 transition-all",
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-muted-foreground"
                      )}
                    >
                      <TypeIcon className={cn("h-4 w-4", PERSONA_COLORS[type])} />
                      <span className={cn("text-sm", isSelected && "font-medium")}>
                        {PERSONA_LABELS[type]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Username */}
            <div>
              <Label htmlFor="persona-username">Username</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  @
                </span>
                <Input
                  id="persona-username"
                  value={newPersona.username || ""}
                  onChange={(e) => setNewPersona({
                    ...newPersona,
                    username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
                  })}
                  className="pl-8 input-field"
                  placeholder="username"
                  maxLength={30}
                />
              </div>
            </div>

            {/* Display Name */}
            <div>
              <Label htmlFor="persona-name">Display Name (optional)</Label>
              <Input
                id="persona-name"
                value={newPersona.display_name || ""}
                onChange={(e) => setNewPersona({ ...newPersona, display_name: e.target.value })}
                className="input-field mt-1"
                placeholder="Display name"
                maxLength={50}
              />
            </div>

            {/* Bio */}
            <div>
              <Label htmlFor="persona-bio">Bio (optional)</Label>
              <Textarea
                id="persona-bio"
                value={newPersona.bio || ""}
                onChange={(e) => setNewPersona({ ...newPersona, bio: e.target.value })}
                className="input-field mt-1 resize-none"
                placeholder="Tell people about this persona"
                rows={2}
                maxLength={150}
              />
            </div>

            <div className="flex gap-2 pt-2">
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
                disabled={!newPersona.username?.trim()}
              >
                Create Persona
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
