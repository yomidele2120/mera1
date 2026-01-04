import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { FullPageLoader } from "@/components/common/LoadingSpinner";
import { CallProvider } from "@/components/call/CallProvider";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { OfflineIndicator } from "@/components/common/OfflineIndicator";

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

// Initialize push notifications
const PushNotificationInit = () => {
  usePushNotifications();
  return null;
};

const AppRoutes = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />
        <Route path="/" element={<ProtectedRoute><FeedPage /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
        <Route path="/create" element={<ProtectedRoute><CreatePage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/user/:username" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
        <Route path="/messages/ai" element={<ProtectedRoute><AIChatPage /></ProtectedRoute>} />
        <Route path="/messages/:chatId" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
        <Route path="/post/:postId" element={<ProtectedRoute><PostPage /></ProtectedRoute>} />
        <Route path="/stories/:username" element={<ProtectedRoute><StoryViewerPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/calls" element={<ProtectedRoute><CallsPage /></ProtectedRoute>} />
        <Route path="/friends" element={<ProtectedRoute><FriendsPage /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <CallProvider>
            <TooltipProvider>
              <OfflineIndicator />
              <PushNotificationInit />
              <Toaster />
              <Sonner />
              <AppRoutes />
            </TooltipProvider>
          </CallProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
