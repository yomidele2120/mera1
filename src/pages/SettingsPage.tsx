import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  User,
  Palette,
  Bell,
  Shield,
  Info,
  LogOut,
  Trash2,
  Hash,
  KeyRound,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StickyHeader } from "@/components/common/StickyHeader";
import { SettingsSection, SettingsItem } from "@/components/settings/SettingsSection";
import { EditProfileForm } from "@/components/settings/EditProfileForm";
import { SecurePasswordReset } from "@/components/settings/SecurePasswordReset";
import { ThemeSelector } from "@/components/settings/ThemeSelector";
import { Switch } from "@/components/ui/switch";
import { UserNumber } from "@/components/user/UserNumber";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type SettingsView = "main" | "edit-profile" | "change-password" | "appearance" | "notifications" | "privacy";

const SettingsPage = () => {
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const { toast } = useToast();
  const [currentView, setCurrentView] = useState<SettingsView>("main");

  // Notification toggles (UI only for now)
  const [notifyLikes, setNotifyLikes] = useState(true);
  const [notifyComments, setNotifyComments] = useState(true);
  const [notifyFollows, setNotifyFollows] = useState(true);
  const [notifyMessages, setNotifyMessages] = useState(true);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const renderContent = () => {
    switch (currentView) {
      case "edit-profile":
        return (
          <motion.div
            key="edit-profile"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <EditProfileForm />
          </motion.div>
        );

      case "change-password":
        return (
          <motion.div
            key="change-password"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <SecurePasswordReset onBack={() => setCurrentView("main")} />
          </motion.div>
        );

      case "appearance":
        return (
          <motion.div
            key="appearance"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <SettingsSection title="Theme" description="Choose your preferred theme">
              <ThemeSelector />
            </SettingsSection>
          </motion.div>
        );

      case "notifications":
        return (
          <motion.div
            key="notifications"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <SettingsSection title="Push Notifications" description="Manage what notifications you receive">
              <SettingsItem
                label="Likes"
                description="When someone likes your post"
                action={
                  <Switch
                    checked={notifyLikes}
                    onCheckedChange={setNotifyLikes}
                  />
                }
              />
              <SettingsItem
                label="Comments"
                description="When someone comments on your post"
                action={
                  <Switch
                    checked={notifyComments}
                    onCheckedChange={setNotifyComments}
                  />
                }
              />
              <SettingsItem
                label="New followers"
                description="When someone follows you"
                action={
                  <Switch
                    checked={notifyFollows}
                    onCheckedChange={setNotifyFollows}
                  />
                }
              />
              <SettingsItem
                label="Messages"
                description="When you receive a new message"
                action={
                  <Switch
                    checked={notifyMessages}
                    onCheckedChange={setNotifyMessages}
                  />
                }
              />
            </SettingsSection>
          </motion.div>
        );

      case "privacy":
        return (
          <motion.div
            key="privacy"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <SettingsSection title="Account Privacy">
              <SettingsItem
                label="Private account"
                description="Only approved followers can see your posts"
                action={<Switch />}
              />
            </SettingsSection>

            <SettingsSection title="Interactions">
              <SettingsItem
                label="Who can message you"
                description="Everyone"
                onClick={() => {}}
              />
              <SettingsItem
                label="Who can see your stories"
                description="Everyone"
                onClick={() => {}}
              />
            </SettingsSection>
          </motion.div>
        );

      default:
        return (
          <motion.div
            key="main"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            {/* Account Section */}
            <SettingsSection title="Account">
              <SettingsItem
                icon={<User className="h-5 w-5" />}
                label="Edit profile"
                description={`@${profile?.username}`}
                onClick={() => setCurrentView("edit-profile")}
              />
              <SettingsItem
                icon={<KeyRound className="h-5 w-5" />}
                label="Change password"
                description="Update your password"
                onClick={() => setCurrentView("change-password")}
              />
              <SettingsItem
                icon={<Hash className="h-5 w-5" />}
                label="Your User ID"
                description={
                  profile?.user_number
                    ? profile.user_number
                        .toString()
                        .replace(/(\d{3})(\d{3})(\d{4})/, "$1 · $2 · $3")
                    : "Use this to let others find you"
                }
                action={<UserNumber userNumber={profile?.user_number ?? null} showCopyButton />}
              />
              {/* Hide the redundant number text inside <UserNumber> so only the copy button shows on the right */}
              <style>{`.settings-userid-wrap span.font-mono{display:none}`}</style>
            </SettingsSection>

            {/* Preferences Section */}
            <SettingsSection title="Preferences">
              <SettingsItem
                icon={<Palette className="h-5 w-5" />}
                label="Appearance"
                description="Theme, display"
                onClick={() => setCurrentView("appearance")}
              />
              <SettingsItem
                icon={<Bell className="h-5 w-5" />}
                label="Notifications"
                description="Push, email"
                onClick={() => setCurrentView("notifications")}
              />
              <SettingsItem
                icon={<Shield className="h-5 w-5" />}
                label="Privacy & Security"
                description="Account privacy, blocked users"
                onClick={() => setCurrentView("privacy")}
              />
            </SettingsSection>

            {/* About Section */}
            <SettingsSection title="About">
              <SettingsItem
                icon={<Info className="h-5 w-5" />}
                label="About Mera"
                description="Version 1.0.0"
              />
            </SettingsSection>

            {/* Sign Out */}
            <SettingsSection title="Session">
              <SettingsItem
                icon={<LogOut className="h-5 w-5" />}
                label="Sign out"
                onClick={handleSignOut}
                danger
              />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <div>
                    <SettingsItem
                      icon={<Trash2 className="h-5 w-5" />}
                      label="Delete account"
                      description="Permanently delete your account"
                      danger
                      onClick={() => {}}
                    />
                  </div>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete your
                      account and remove all your data from our servers.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => {
                        toast({
                          title: "Account deletion",
                          description: "Please contact support to delete your account",
                        });
                      }}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </SettingsSection>
          </motion.div>
        );
    }
  };

  const getTitle = () => {
    switch (currentView) {
      case "edit-profile":
        return "Edit Profile";
      case "change-password":
        return "Change Password";
      case "appearance":
        return "Appearance";
      case "notifications":
        return "Notifications";
      case "privacy":
        return "Privacy & Security";
      default:
        return "Settings";
    }
  };

  return (
    <MainLayout>
      <div className="max-w-xl mx-auto -mx-4 md:mx-auto">
        {/* Header */}
        <StickyHeader
          title={getTitle()}
          onBack={() =>
            currentView === "main" ? navigate(-1) : setCurrentView("main")
          }
        />

        {/* Content */}
        <div className="p-4">
          <AnimatePresence mode="wait">{renderContent()}</AnimatePresence>
        </div>
      </div>
    </MainLayout>
  );
};

export default SettingsPage;
