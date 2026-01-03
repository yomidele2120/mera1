import { Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useCallHistory, CallLog } from "@/hooks/useCalling";
import { CallHistoryItem } from "@/components/call/CallHistoryItem";
import { useAuth } from "@/contexts/AuthContext";
import { BackButton } from "@/components/common/BackButton";
import { supabase } from "@/integrations/supabase/client";

const CallsPage = () => {
  const { user } = useAuth();
  const { calls, loading } = useCallHistory();
  const navigate = useNavigate();

  const handleCallClick = async (call: CallLog) => {
    const otherUserId = call.caller_id === user?.id ? call.receiver_id : call.caller_id;
    
    // Find or create chat with this user
    const { data: existingChat } = await supabase
      .from('chats')
      .select('id')
      .or(`and(user1_id.eq.${user?.id},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${user?.id})`)
      .single();

    if (existingChat) {
      navigate(`/messages/${existingChat.id}`);
    } else {
      const otherUser = call.caller_id === user?.id ? call.receiver : call.caller;
      if (otherUser) {
        navigate(`/user/${otherUser.username}`);
      }
    }
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
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <BackButton />
          <h1 className="text-2xl font-bold text-foreground">Calls</h1>
        </div>

        {/* Call History */}
        {calls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Phone className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground">No calls yet</h3>
            <p className="text-sm text-muted-foreground">
              Your call history will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {calls.map((call) => (
              <CallHistoryItem
                key={call.id}
                call={call}
                currentUserId={user?.id || ''}
                onClick={() => handleCallClick(call)}
              />
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default CallsPage;
