import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { FullPageLoader } from "@/components/common/LoadingSpinner";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { OfflineIndicator } from "@/components/common/OfflineIndicator";
import { IncomingCallOverlay } from "@/components/call/IncomingCallOverlay";
import { useCallSignaling } from "@/hooks/useCallSignaling";

// Lazy load pages for code splitting
const AuthPage = lazy(() => import("./pages/AuthPage"));
const FeedPage = lazy(() => import("./pages/FeedPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const CreatePage = lazy(() => import("./pages/CreatePage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const AIChatPage = lazy(() => import("./pages/AIChatPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const PostPage = lazy(() => import("./pages/PostPage"));
const StoryViewerPage = lazy(() => import("./pages/StoryViewerPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const CallsPage = lazy(() => import("./pages/CallsPage"));
const FriendsPage = lazy(() => import("./pages/FriendsPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <FullPageLoader />
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <FullPageLoader />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <FullPageLoader />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// Initialize push notifications with permission modal
const PushNotificationInit = () => {
  const { 
    showPermissionModal, 
    setShowPermissionModal, 
    requestPermission,
    skipPermissionPrompt
  } = usePushNotifications();
  
  // Lazy import the modal to avoid circular dependencies
  const NotificationPermissionModal = lazy(() => 
    import("./components/notifications/NotificationPermissionModal").then(m => ({ 
      default: m.NotificationPermissionModal 
    }))
  );
  
  return (
    <Suspense fallback={null}>
      <NotificationPermissionModal
        open={showPermissionModal}
        onOpenChange={setShowPermissionModal}
        onEnable={requestPermission}
        onSkip={skipPermissionPrompt}
      />
    </Suspense>
  );
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/auth" element={<PublicRoute><Suspense fallback={<PageLoader />}><AuthPage /></Suspense></PublicRoute>} />
      <Route path="/" element={<ProtectedRoute><Suspense fallback={null}><FeedPage /></Suspense></ProtectedRoute>} />
      <Route path="/search" element={<ProtectedRoute><Suspense fallback={null}><SearchPage /></Suspense></ProtectedRoute>} />
      <Route path="/create" element={<ProtectedRoute><Suspense fallback={null}><CreatePage /></Suspense></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Suspense fallback={null}><ProfilePage /></Suspense></ProtectedRoute>} />
      <Route path="/user/:username" element={<ProtectedRoute><Suspense fallback={null}><ProfilePage /></Suspense></ProtectedRoute>} />
      <Route path="/messages" element={<ProtectedRoute><Suspense fallback={null}><MessagesPage /></Suspense></ProtectedRoute>} />
      <Route path="/messages/ai" element={<ProtectedRoute><Suspense fallback={null}><AIChatPage /></Suspense></ProtectedRoute>} />
      <Route path="/messages/:chatId" element={<ProtectedRoute><Suspense fallback={null}><ChatPage /></Suspense></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><Suspense fallback={null}><NotificationsPage /></Suspense></ProtectedRoute>} />
      <Route path="/post/:postId" element={<ProtectedRoute><Suspense fallback={null}><PostPage /></Suspense></ProtectedRoute>} />
      <Route path="/stories/:username" element={<ProtectedRoute><Suspense fallback={null}><StoryViewerPage /></Suspense></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Suspense fallback={null}><SettingsPage /></Suspense></ProtectedRoute>} />
      <Route path="/calls" element={<ProtectedRoute><Suspense fallback={null}><CallsPage /></Suspense></ProtectedRoute>} />
      <Route path="/friends" element={<ProtectedRoute><Suspense fallback={null}><FriendsPage /></Suspense></ProtectedRoute>} />
      <Route path="*" element={<Suspense fallback={null}><NotFound /></Suspense>} />
    </Routes>
  );
};

const CallSignalingLayer = () => {
  const { user, profile } = useAuth();
  const { incomingCall, acceptCall, declineCall } = useCallSignaling(user?.id ?? "");
  if (!incomingCall || !user) return null;
  return (
    <IncomingCallOverlay
      incomingCall={incomingCall}
      currentUserID={user.id}
      currentUserName={profile?.full_name || profile?.username || user.email || "User"}
      onAccept={acceptCall}
      onDecline={declineCall}
    />
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <TooltipProvider>
            <OfflineIndicator />
            <PushNotificationInit />
            <Toaster />
            <Sonner />
            <AppRoutes />
            <CallSignalingLayer />
          </TooltipProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
