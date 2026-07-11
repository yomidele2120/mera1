import { useEffect, useState } from "react";
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { UserAvatar } from "@/components/common/Avatar";
import { useAuth } from "@/contexts/AuthContext";
import { StickyHeader } from "@/components/common/StickyHeader";
import { supabase } from "@/integrations/supabase/client";

interface CallRow {
  id: string;
  room_id: string;
  caller_id: string;
  caller_name: string;
  callee_id: string;
  call_type: "video" | "voice";
  status: string;
  created_at: string;
}

interface ProfileLite {
  id: string;
  username: string;
  avatar_url: string | null;
}

const CallsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("calls")
        .select("*")
        .or(`caller_id.eq.${user.id},callee_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("[CallsPage] fetch error", error);
        if (!cancelled) setLoading(false);
        return;
      }
      const rows = (data ?? []) as CallRow[];
      const otherIds = Array.from(
        new Set(rows.map((c) => (c.caller_id === user.id ? c.callee_id : c.caller_id))),
      );
      let profileMap: Record<string, ProfileLite> = {};
      if (otherIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", otherIds);
        profileMap = Object.fromEntries((profs ?? []).map((p) => [p.id, p as ProfileLite]));
      }
      if (!cancelled) {
        setCalls(rows);
        setProfiles(profileMap);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const openChat = async (otherId: string, username?: string) => {
    const { data: existingChat } = await supabase
      .from("chats")
      .select("id")
      .or(
        `and(user1_id.eq.${user?.id},user2_id.eq.${otherId}),and(user1_id.eq.${otherId},user2_id.eq.${user?.id})`,
      )
      .maybeSingle();
    if (existingChat) navigate(`/messages/${existingChat.id}`);
    else if (username) navigate(`/user/${username}`);
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="-mx-4 md:mx-0">
        <StickyHeader title="Calls" />
        <div className="px-4 pt-4">
          {calls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Phone className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground">No calls yet</h3>
              <p className="text-sm text-muted-foreground">Your call history will appear here</p>
            </div>
          ) : (
            <div className="space-y-1">
              {calls.map((call) => {
                const outgoing = call.caller_id === user?.id;
                const otherId = outgoing ? call.callee_id : call.caller_id;
                const other = profiles[otherId];
                const missed = !outgoing && (call.status === "declined" || call.status === "ended");
                const Icon = missed
                  ? PhoneMissed
                  : outgoing
                    ? PhoneOutgoing
                    : PhoneIncoming;
                return (
                  <button
                    key={call.id}
                    onClick={() => openChat(otherId, other?.username)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition text-left"
                  >
                    <UserAvatar
                      username={other?.username ?? call.caller_name}
                      avatarUrl={other?.avatar_url ?? undefined}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {other?.username ?? call.caller_name}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Icon className={`h-3 w-3 ${missed ? "text-destructive" : ""}`} />
                        {outgoing ? "Outgoing" : missed ? "Missed" : "Incoming"} ·{" "}
                        {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
                      </div>
                    </div>
                    {call.call_type === "video" ? (
                      <Video className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Phone className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default CallsPage;
