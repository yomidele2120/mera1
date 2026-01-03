import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import authHero from "@/assets/auth-hero.jpg";

type AuthMode = "login" | "signup";

export const AuthPage = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signup") {
        if (username.length < 3) {
          toast({
            title: "Username too short",
            description: "Username must be at least 3 characters",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const { error } = await signUp(email, password, username);
        if (error) {
          toast({
            title: "Sign up failed",
            description: error.message,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Welcome to Mera!",
            description: "Your account has been created",
          });
          navigate("/");
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          toast({
            title: "Sign in failed",
            description: error.message,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Welcome back!",
            description: "You've been signed in",
          });
          navigate("/");
        }
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode((prev) => (prev === "login" ? "signup" : "login"));
    setEmail("");
    setPassword("");
    setUsername("");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left side - Hero Image */}
      <div className="hidden lg:block relative overflow-hidden">
        <motion.div
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="absolute inset-0"
        >
          <img
            src={authHero}
            alt="Mera"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-background/40" />
        </motion.div>

        {/* Overlay Content */}
        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="flex items-center gap-3"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary shadow-glow">
              <span className="font-display text-2xl font-bold text-primary-foreground">M</span>
            </div>
            <span className="font-display text-3xl font-bold text-foreground">mera</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="max-w-md"
          >
            <h1 className="font-display text-4xl font-bold leading-tight text-foreground mb-4">
              Share your moments with the world
            </h1>
            <p className="text-lg text-muted-foreground">
              Connect with friends, share stories, and discover amazing content from creators around the globe.
            </p>
          </motion.div>
        </div>

        {/* Floating Elements */}
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-20 top-1/3 h-20 w-20 rounded-full gradient-primary opacity-60 blur-xl"
        />
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-32 bottom-1/4 h-16 w-16 rounded-full bg-accent opacity-80 blur-lg"
        />
      </div>

      {/* Right side - Auth Form */}
      <div className="flex items-center justify-center p-6 lg:p-12 gradient-hero">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex items-center justify-center gap-3 lg:hidden"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary shadow-glow">
              <span className="font-display text-2xl font-bold text-primary-foreground">M</span>
            </div>
            <span className="font-display text-3xl font-bold text-gradient">mera</span>
          </motion.div>

          <div className="card-base p-8 lg:p-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, x: mode === "signup" ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: mode === "signup" ? -20 : 20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="mb-8 text-center">
                  <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                    {mode === "login" ? "Welcome back" : "Create account"}
                  </h2>
                  <p className="text-muted-foreground">
                    {mode === "login"
                      ? "Sign in to continue to Mera"
                      : "Join the Mera community today"}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {mode === "signup" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="Username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                          className="pl-12 input-field"
                          required
                        />
                      </div>
                    </motion.div>
                  )}

                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-12 input-field"
                      required
                    />
                  </div>

                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-12 pr-12 input-field"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full h-12 text-base"
                  >
                    {loading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <Sparkles className="h-5 w-5" />
                      </motion.div>
                    ) : (
                      <>
                        {mode === "login" ? "Sign in" : "Create account"}
                        <ArrowRight className="h-5 w-5 ml-2" />
                      </>
                    )}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    {mode === "login" ? "Don't have an account?" : "Already have an account?"}
                    <button
                      type="button"
                      onClick={toggleMode}
                      className="ml-2 font-semibold text-primary hover:underline"
                    >
                      {mode === "login" ? "Sign up" : "Sign in"}
                    </button>
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default AuthPage;
