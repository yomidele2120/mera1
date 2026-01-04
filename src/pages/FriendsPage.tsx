import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Phone, UserPlus, Search, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { UserAvatar } from "@/components/common/Avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Link, useNavigate } from "react-router-dom";
import { DialPad } from "@/components/friends/DialPad";
import { EditContactDialog } from "@/components/friends/EditContactDialog";

interface Friend {
  id: string;
  username: string;
  avatar_url: string | null;
  user_number: number | null;
  customName?: string | null;
  contactId?: string;
}

const FriendsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [contacts, setContacts] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingContact, setEditingContact] = useState<Friend | null>(null);

  const fetchFriendsAndContacts = async () => {
    if (!user) return;

    try {
      // Fetch mutual followers (friends)
      const { data: following } = await supabase
        .from("followers")
        .select("following_id")
        .eq("follower_id", user.id);

      const { data: followers } = await supabase
        .from("followers")
        .select("follower_id")
        .eq("following_id", user.id);

      const followingIds = following?.map((f) => f.following_id) || [];
      const followerIds = followers?.map((f) => f.follower_id) || [];
      
      // Mutual friends
      const mutualIds = followingIds.filter((id) => followerIds.includes(id));

      // Fetch contacts with custom names
      const { data: contactsData } = await supabase
        .from("contacts")
        .select("id, contact_user_id, custom_name")
        .eq("user_id", user.id);

      const contactMap = new Map(
        contactsData?.map((c) => [c.contact_user_id, { customName: c.custom_name, contactId: c.id }]) || []
      );

      if (mutualIds.length > 0) {
        const { data: friendsData } = await supabase
          .from("profiles")
          .select("id, username, avatar_url, user_number")
          .in("id", mutualIds);

        const friendsWithCustomNames = (friendsData || []).map((f) => ({
          ...f,
          customName: contactMap.get(f.id)?.customName,
          contactId: contactMap.get(f.id)?.contactId,
        }));

        setFriends(friendsWithCustomNames);
      }

      // Fetch all saved contacts (non-friend contacts)
      const contactUserIds = contactsData
        ?.filter((c) => !mutualIds.includes(c.contact_user_id))
        .map((c) => c.contact_user_id) || [];

      if (contactUserIds.length > 0) {
        const { data: contactProfiles } = await supabase
          .from("profiles")
          .select("id, username, avatar_url, user_number")
          .in("id", contactUserIds);

        const contactsWithNames = (contactProfiles || []).map((c) => ({
          ...c,
          customName: contactMap.get(c.id)?.customName,
          contactId: contactMap.get(c.id)?.contactId,
        }));

        setContacts(contactsWithNames);
      }
    } catch (error) {
      console.error("Error fetching friends:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFriendsAndContacts();
  }, [user]);

  const handleDeleteContact = async (contactId: string) => {
    try {
      await supabase.from("contacts").delete().eq("id", contactId);
      toast({ title: "Contact deleted" });
      fetchFriendsAndContacts();
    } catch (error) {
      toast({ title: "Error deleting contact", variant: "destructive" });
    }
  };

  const handleStartChat = async (friendId: string) => {
    if (!user) return;

    try {
      // Check for existing chat
      const { data: existingChat } = await supabase
        .from("chats")
        .select("id")
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${friendId}),and(user1_id.eq.${friendId},user2_id.eq.${user.id})`)
        .single();

      if (existingChat) {
        navigate(`/messages/${existingChat.id}`);
      } else {
        const { data: newChat } = await supabase
          .from("chats")
          .insert({ user1_id: user.id, user2_id: friendId })
          .select()
          .single();

        if (newChat) {
          navigate(`/messages/${newChat.id}`);
        }
      }
    } catch (error) {
      console.error("Error starting chat:", error);
    }
  };

  const filteredFriends = friends.filter((f) =>
    (f.customName || f.username).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredContacts = contacts.filter((c) =>
    (c.customName || c.username).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const FriendCard = ({ friend, showActions = true }: { friend: Friend; showActions?: boolean }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:bg-accent/50 transition-colors"
    >
      <Link to={`/user/${friend.username}`}>
        <UserAvatar src={friend.avatar_url} fallback={friend.username} size="md" />
      </Link>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">
          {friend.customName || friend.username}
        </p>
        {friend.customName && (
          <p className="text-xs text-muted-foreground">@{friend.username}</p>
        )}
        {friend.user_number && (
          <p className="text-xs text-muted-foreground">{friend.user_number}</p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => handleStartChat(friend.id)}
      >
        <Phone className="h-4 w-4" />
      </Button>
      {showActions && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditingContact(friend)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit name
            </DropdownMenuItem>
            {friend.contactId && (
              <DropdownMenuItem
                onClick={() => handleDeleteContact(friend.contactId!)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove contact
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </motion.div>
  );

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6" />
            Friends
          </h1>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <UserPlus className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Contact by ID</DialogTitle>
              </DialogHeader>
              <DialPad onContactAdded={fetchFriendsAndContacts} />
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search friends..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Tabs defaultValue="friends" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="friends">Friends ({friends.length})</TabsTrigger>
            <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="space-y-2 mt-4">
            <AnimatePresence>
              {filteredFriends.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No friends yet</p>
                  <p className="text-sm">Follow users who follow you back to add friends</p>
                </div>
              ) : (
                filteredFriends.map((friend) => (
                  <FriendCard key={friend.id} friend={friend} />
                ))
              )}
            </AnimatePresence>
          </TabsContent>

          <TabsContent value="contacts" className="space-y-2 mt-4">
            <AnimatePresence>
              {filteredContacts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <UserPlus className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No saved contacts</p>
                  <p className="text-sm">Use the dial pad to add contacts by user ID</p>
                </div>
              ) : (
                filteredContacts.map((contact) => (
                  <FriendCard key={contact.id} friend={contact} />
                ))
              )}
            </AnimatePresence>
          </TabsContent>
        </Tabs>
      </div>

      {editingContact && (
        <EditContactDialog
          contact={editingContact}
          open={!!editingContact}
          onOpenChange={(open) => !open && setEditingContact(null)}
          onSaved={fetchFriendsAndContacts}
        />
      )}
    </MainLayout>
  );
};

export default FriendsPage;
