import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Phone, UserPlus, Search, MoreVertical, Pencil, Trash2, Upload, UserCheck, Clock, Send } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StickyHeader } from "@/components/common/StickyHeader";
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
import { FriendRequestCard } from "@/components/friends/FriendRequestCard";
import { ContactImportDialog } from "@/components/friends/ContactImportDialog";
import { ContactImportSheet } from "@/components/friends/ContactImportSheet";
import { FriendSuggestions } from "@/components/friends/FriendSuggestions";

interface Friend {
  id: string;
  username: string;
  avatar_url: string | null;
  user_number: number | null;
  customName?: string | null;
  contactId?: string;
}

interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
  sender?: {
    id: string;
    username: string;
    avatar_url: string | null;
    user_number: number | null;
  };
  receiver?: {
    id: string;
    username: string;
    avatar_url: string | null;
    user_number: number | null;
  };
}

const FriendsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [contacts, setContacts] = useState<Friend[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestLoading, setRequestLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingContact, setEditingContact] = useState<Friend | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importSheetOpen, setImportSheetOpen] = useState(false);

  const fetchFriendsAndContacts = async () => {
    if (!user) return;

    try {
      // Fetch accepted friend requests (friends)
      const { data: acceptedRequests } = await supabase
        .from("friend_requests")
        .select("id, sender_id, receiver_id, status")
        .eq("status", "accepted")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

      // Fetch contacts with custom names
      const { data: contactsData } = await supabase
        .from("contacts")
        .select("id, contact_user_id, custom_name")
        .eq("user_id", user.id);

      const contactMap = new Map(
        contactsData?.map((c) => [c.contact_user_id, { customName: c.custom_name, contactId: c.id }]) || []
      );

      // Extract friend IDs from accepted requests
      const friendIds = new Set<string>();
      acceptedRequests?.forEach((req) => {
        const friendId = req.sender_id === user.id ? req.receiver_id : req.sender_id;
        friendIds.add(friendId);
      });

      // Fetch friend profiles
      if (friendIds.size > 0) {
        const { data: friendProfiles } = await supabase
          .from("profiles")
          .select("id, username, avatar_url, user_number")
          .in("id", Array.from(friendIds));

        const friendsWithCustomNames = (friendProfiles || []).map((f) => ({
          ...f,
          customName: contactMap.get(f.id)?.customName,
          contactId: contactMap.get(f.id)?.contactId,
        }));

        setFriends(friendsWithCustomNames);
      } else {
        setFriends([]);
      }

      // Fetch all saved contacts (non-friend contacts)
      const contactUserIds = contactsData
        ?.filter((c) => !friendIds.has(c.contact_user_id))
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
      } else {
        setContacts([]);
      }

      // Fetch pending friend requests
      const { data: incomingData } = await supabase
        .from("friend_requests")
        .select("id, sender_id, receiver_id, status, created_at")
        .eq("receiver_id", user.id)
        .eq("status", "pending");

      const { data: outgoingData } = await supabase
        .from("friend_requests")
        .select("id, sender_id, receiver_id, status, created_at")
        .eq("sender_id", user.id)
        .eq("status", "pending");

      // Fetch profiles for incoming requests
      const incomingSenderIds = incomingData?.map((r) => r.sender_id) || [];
      const outgoingReceiverIds = outgoingData?.map((r) => r.receiver_id) || [];

      const allProfileIds = [...new Set([...incomingSenderIds, ...outgoingReceiverIds])];
      
      let profilesMap = new Map<string, any>();
      if (allProfileIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, avatar_url, user_number")
          .in("id", allProfileIds);
        
        profiles?.forEach((p) => profilesMap.set(p.id, p));
      }

      const incomingWithProfiles = (incomingData || []).map((r) => ({
        ...r,
        sender: profilesMap.get(r.sender_id),
      }));

      const outgoingWithProfiles = (outgoingData || []).map((r) => ({
        ...r,
        receiver: profilesMap.get(r.receiver_id),
      }));

      setIncomingRequests(incomingWithProfiles);
      setOutgoingRequests(outgoingWithProfiles);
    } catch (error) {
      console.error("Error fetching friends:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFriendsAndContacts();

    // Subscribe to friend request changes
    const channel = supabase
      .channel("friend-requests")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friend_requests",
        },
        () => {
          fetchFriendsAndContacts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleAcceptRequest = async (requestId: string) => {
    setRequestLoading(true);
    try {
      const { error } = await supabase
        .from("friend_requests")
        .update({ status: "accepted" })
        .eq("id", requestId);

      if (error) throw error;
      toast({ title: "Friend request accepted!" });
      fetchFriendsAndContacts();
    } catch (error) {
      toast({ title: "Error accepting request", variant: "destructive" });
    } finally {
      setRequestLoading(false);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    setRequestLoading(true);
    try {
      const { error } = await supabase
        .from("friend_requests")
        .update({ status: "rejected" })
        .eq("id", requestId);

      if (error) throw error;
      toast({ title: "Friend request rejected" });
      fetchFriendsAndContacts();
    } catch (error) {
      toast({ title: "Error rejecting request", variant: "destructive" });
    } finally {
      setRequestLoading(false);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    setRequestLoading(true);
    try {
      const { error } = await supabase
        .from("friend_requests")
        .delete()
        .eq("id", requestId);

      if (error) throw error;
      toast({ title: "Friend request cancelled" });
      fetchFriendsAndContacts();
    } catch (error) {
      toast({ title: "Error cancelling request", variant: "destructive" });
    } finally {
      setRequestLoading(false);
    }
  };

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

  const totalRequests = incomingRequests.length + outgoingRequests.length;

  return (
    <MainLayout>
      <div className="-mx-4 md:mx-0">
        <StickyHeader 
          title="Friends"
          rightAction={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setImportSheetOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Find
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add
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
          }
        />

        <div className="px-4 pt-4 space-y-4">
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="friends" className="flex items-center gap-1">
              <UserCheck className="h-4 w-4" />
              Friends ({friends.length})
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex items-center gap-1 relative">
              <Clock className="h-4 w-4" />
              Requests
              {totalRequests > 0 && (
                <span className="ml-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                  {totalRequests}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="space-y-4 mt-4">
            <FriendSuggestions />
            
            <AnimatePresence>
              {filteredFriends.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No friends yet</p>
                  <p className="text-sm">Send friend requests to connect with others</p>
                </div>
              ) : (
                filteredFriends.map((friend) => (
                  <FriendCard key={friend.id} friend={friend} />
                ))
              )}
            </AnimatePresence>
          </TabsContent>

          <TabsContent value="requests" className="space-y-4 mt-4">
            {incomingRequests.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <Send className="h-4 w-4 rotate-180" />
                  Incoming Requests ({incomingRequests.length})
                </h3>
                <div className="space-y-2">
                  <AnimatePresence>
                    {incomingRequests.map((request) => (
                      <FriendRequestCard
                        key={request.id}
                        request={request}
                        type="incoming"
                        onAccept={handleAcceptRequest}
                        onReject={handleRejectRequest}
                        loading={requestLoading}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {outgoingRequests.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Sent Requests ({outgoingRequests.length})
                </h3>
                <div className="space-y-2">
                  <AnimatePresence>
                    {outgoingRequests.map((request) => (
                      <FriendRequestCard
                        key={request.id}
                        request={request}
                        type="outgoing"
                        onCancel={handleCancelRequest}
                        loading={requestLoading}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {totalRequests === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No pending requests</p>
                <p className="text-sm">Friend requests will appear here</p>
              </div>
            )}
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
      </div>

      {editingContact && (
        <EditContactDialog
          contact={editingContact}
          open={!!editingContact}
          onOpenChange={(open) => !open && setEditingContact(null)}
          onSaved={fetchFriendsAndContacts}
        />
      )}

      <ContactImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImported={fetchFriendsAndContacts}
      />

      <ContactImportSheet
        open={importSheetOpen}
        onOpenChange={setImportSheetOpen}
        onImported={fetchFriendsAndContacts}
      />
    </MainLayout>
  );
};

export default FriendsPage;
