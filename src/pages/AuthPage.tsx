import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Eye, EyeOff, Mail, Lock, User, ArrowRight, ArrowLeft, 
  Sparkles, Calendar, Users, Check, PartyPopper, Shield
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import authHero from "@/assets/auth-hero.jpg";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

type AuthMode = "login" | "signup" | "forgot";
type SignupStep = 1 | 2 | 3 | 4 | 5; // Added step 2 for email verification

// Validation schemas
const step1Schema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const step3Schema = z.object({
  dateOfBirth: z.string().refine((val) => {
    const date = new Date(val);
    const today = new Date();
    const age = today.getFullYear() - date.getFullYear();
    return age >= 13;
  }, "You must be at least 13 years old"),
  gender: z.string().min(1, "Please select a gender"),
});

const step4Schema = z.object({
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be less than 30 characters")
    .regex(/^[a-z0-9_]+$/, "Username can only contain lowercase letters, numbers, and underscores"),
});

export const AuthPage = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [signupStep, setSignupStep] = useState<SignupStep>(1);
  
  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userNumber, setUserNumber] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [resetSent, setResetSent] = useState(false);
  
  // Email verification state
  const [verificationCode, setVerificationCode] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);

  const { signIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const validateStep = (step: SignupStep): boolean => {
    setErrors({});
    try {
      if (step === 1) {
        step1Schema.parse({ fullName, email, password });
      } else if (step === 3) {
        step3Schema.parse({ dateOfBirth, gender });
      } else if (step === 4) {
        step4Schema.parse({ username });
      }
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const sendVerificationCode = async () => {
    if (!validateStep(1)) return;
    
    setSendingCode(true);
    try {
      const response = await supabase.functions.invoke("send-signup-verification", {
        body: { email },
      });

      const data = response.data;
      
      // Check for errors - could be in response.error or data.error
      const errorMessage = response.error?.message || data?.error;
      if (errorMessage) {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
        return;
      }

      // Store debug OTP for development
      if (data.debug_otp) {
        setDebugOtp(data.debug_otp);
      }

      toast({
        title: "Code sent!",
        description: "Please check your email for the verification code",
      });
      
      setSignupStep(2);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSendingCode(false);
    }
  };

  const verifyEmailCode = async () => {
    if (verificationCode.length !== 6) {
      setErrors({ code: "Please enter the 6-digit code" });
      return;
    }

    setVerifyingCode(true);
    try {
      const response = await supabase.functions.invoke("verify-signup-code", {
        body: { email, code: verificationCode },
      });

      if (response.error) {
        toast({
          title: "Error",
          description: response.error.message || "Failed to verify code",
          variant: "destructive",
        });
        return;
      }

      const data = response.data;
      
      if (data.error) {
        setErrors({ code: data.error });
        toast({
          title: "Invalid code",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      if (data.verified) {
        setEmailVerified(true);
        toast({
          title: "Email verified!",
          description: "You can now continue with your registration",
        });
        setSignupStep(3);
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setVerifyingCode(false);
    }
  };

  const resendVerificationCode = async () => {
    setSendingCode(true);
    try {
      const response = await supabase.functions.invoke("send-signup-verification", {
        body: { email },
      });

      if (response.data?.debug_otp) {
        setDebugOtp(response.data.debug_otp);
      }

      toast({
        title: "Code resent!",
        description: "Please check your email for the new verification code",
      });
      setVerificationCode("");
    } catch (err: any) {
      toast({
        title: "Error",
        description: "Failed to resend code",
        variant: "destructive",
      });
    } finally {
      setSendingCode(false);
    }
  };

  const handleNextStep = () => {
    if (signupStep === 1) {
      sendVerificationCode();
    } else if (validateStep(signupStep)) {
      setSignupStep((prev) => Math.min(prev + 1, 5) as SignupStep);
    }
  };

  const handlePrevStep = () => {
    if (signupStep === 2) {
      setVerificationCode("");
      setEmailVerified(false);
    }
    setSignupStep((prev) => Math.max(prev - 1, 1) as SignupStep);
  };

  const handleSignup = async () => {
    if (!emailVerified) {
      toast({
        title: "Email not verified",
        description: "Please verify your email first",
        variant: "destructive",
      });
      return;
    }
    
    if (!validateStep(4)) return;
    
    setLoading(true);
    try {
      const { error, userNumber: newUserNumber } = await signUp({
        email,
        password,
        username,
        fullName,
        dateOfBirth,
        gender,
      });

      if (error) {
        toast({
          title: "Sign up failed",
          description: error.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Show success step with user number
      setUserNumber(newUserNumber || null);
      setSignupStep(5);
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
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
    setSignupStep(1);
    setEmail("");
    setPassword("");
    setFullName("");
    setUsername("");
    setDateOfBirth("");
    setGender("");
    setErrors({});
    setUserNumber(null);
    setResetSent(false);
    setVerificationCode("");
    setEmailVerified(false);
    setDebugOtp(null);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrors({ email: "Please enter your email address" });
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await resetPassword(email);
      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setResetSent(true);
        toast({
          title: "Email sent",
          description: "Check your email for the password reset link",
        });
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

  const handleContinue = () => {
    toast({
      title: "Welcome to Mera!",
      description: "Your account is ready to use",
    });
    navigate("/");
  };

  // Progress indicator helper
  const getProgressStep = () => {
    if (signupStep <= 2) return 1;
    if (signupStep === 3) return 2;
    if (signupStep === 4) return 3;
    return 3;
  };

  // Render signup steps
  const renderSignupStep = () => {
    switch (signupStep) {
      case 1:
        return (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="mb-6 text-center">
              <div className="flex justify-center gap-2 mb-4">
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={`h-2 w-8 rounded-full transition-colors ${
                      step <= getProgressStep() ? "gradient-primary" : "bg-muted"
                    }`}
                  />
                ))}
              </div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                Let's get started
              </h2>
              <p className="text-muted-foreground">
                Enter your details to create an account
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Full Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-12 input-field"
                  />
                </div>
                {errors.fullName && (
                  <p className="text-sm text-destructive mt-1">{errors.fullName}</p>
                )}
              </div>

              <div>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-12 input-field"
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive mt-1">{errors.email}</p>
                )}
              </div>

              <div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-12 pr-12 input-field"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive mt-1">{errors.password}</p>
                )}
              </div>
            </div>

            <Button
              type="button"
              onClick={handleNextStep}
              disabled={sendingCode}
              className="btn-primary w-full h-12 text-base"
            >
              {sendingCode ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Sparkles className="h-5 w-5" />
                </motion.div>
              ) : (
                <>
                  Continue
                  <ArrowRight className="h-5 w-5 ml-2" />
                </>
              )}
            </Button>
          </motion.div>
        );

      case 2:
        return (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="mb-6 text-center">
              <div className="flex justify-center gap-2 mb-4">
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={`h-2 w-8 rounded-full transition-colors ${
                      step <= getProgressStep() ? "gradient-primary" : "bg-muted"
                    }`}
                  />
                ))}
              </div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4"
              >
                <Shield className="h-8 w-8 text-primary" />
              </motion.div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                Verify your email
              </h2>
              <p className="text-muted-foreground text-sm">
                We've sent a 6-digit code to <br />
                <span className="font-medium text-foreground">{email}</span>
              </p>
            </div>

            <div className="flex flex-col items-center gap-4">
              <InputOTP
                maxLength={6}
                value={verificationCode}
                onChange={(value) => {
                  setVerificationCode(value);
                  setErrors({});
                }}
              >
                <InputOTPGroup className="gap-2">
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
              
              {errors.code && (
                <p className="text-sm text-destructive">{errors.code}</p>
              )}

              {/* Debug OTP display for development */}
              {debugOtp && (
                <div className="bg-accent/50 rounded-lg px-4 py-2 text-center">
                  <p className="text-xs text-muted-foreground">Development code:</p>
                  <p className="font-mono font-bold text-primary">{debugOtp}</p>
                </div>
              )}

              <button
                type="button"
                onClick={resendVerificationCode}
                disabled={sendingCode}
                className="text-sm text-primary hover:underline disabled:opacity-50"
              >
                {sendingCode ? "Sending..." : "Didn't receive a code? Resend"}
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevStep}
                className="flex-1 h-12"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back
              </Button>
              <Button
                type="button"
                onClick={verifyEmailCode}
                disabled={verifyingCode || verificationCode.length !== 6}
                className="btn-primary flex-1 h-12"
              >
                {verifyingCode ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles className="h-5 w-5" />
                  </motion.div>
                ) : (
                  <>
                    Verify
                    <Check className="h-5 w-5 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        );

      case 3:
        return (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="mb-6 text-center">
              <div className="flex justify-center gap-2 mb-4">
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={`h-2 w-8 rounded-full transition-colors ${
                      step <= getProgressStep() ? "gradient-primary" : "bg-muted"
                    }`}
                  />
                ))}
              </div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                About you
              </h2>
              <p className="text-muted-foreground">
                Tell us a bit more about yourself
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Date of Birth</Label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="pl-12 input-field"
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>
                {errors.dateOfBirth && (
                  <p className="text-sm text-destructive mt-1">{errors.dateOfBirth}</p>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium mb-3 block">Gender</Label>
                <RadioGroup
                  value={gender}
                  onValueChange={setGender}
                  className="grid grid-cols-3 gap-3"
                >
                  {[
                    { value: "male", label: "Male" },
                    { value: "female", label: "Female" },
                    { value: "other", label: "Other" },
                  ].map((option) => (
                    <Label
                      key={option.value}
                      htmlFor={option.value}
                      className={`flex items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        gender === option.value
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-muted-foreground"
                      }`}
                    >
                      <RadioGroupItem
                        value={option.value}
                        id={option.value}
                        className="sr-only"
                      />
                      <span className={gender === option.value ? "text-primary font-medium" : ""}>
                        {option.label}
                      </span>
                    </Label>
                  ))}
                </RadioGroup>
                {errors.gender && (
                  <p className="text-sm text-destructive mt-1">{errors.gender}</p>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevStep}
                className="flex-1 h-12"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (validateStep(3)) {
                    setSignupStep(4);
                  }
                }}
                className="btn-primary flex-1 h-12"
              >
                Continue
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </div>
          </motion.div>
        );

      case 4:
        return (
          <motion.div
            key="step4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="mb-6 text-center">
              <div className="flex justify-center gap-2 mb-4">
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={`h-2 w-8 rounded-full transition-colors ${
                      step <= getProgressStep() ? "gradient-primary" : "bg-muted"
                    }`}
                  />
                ))}
              </div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                Choose your username
              </h2>
              <p className="text-muted-foreground">
                This is how others will find you
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                    @
                  </span>
                  <Input
                    type="text"
                    placeholder="username"
                    value={username}
                    onChange={(e) =>
                      setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                    }
                    className="pl-10 input-field"
                    maxLength={30}
                  />
                </div>
                {errors.username && (
                  <p className="text-sm text-destructive mt-1">{errors.username}</p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Lowercase letters, numbers, and underscores only
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevStep}
                className="flex-1 h-12"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back
              </Button>
              <Button
                type="button"
                onClick={handleSignup}
                disabled={loading}
                className="btn-primary flex-1 h-12"
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
                    Create Account
                    <Check className="h-5 w-5 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        );

      case 5:
        return (
          <motion.div
            key="step5"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-6"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-full gradient-primary mb-6"
            >
              <PartyPopper className="h-10 w-10 text-primary-foreground" />
            </motion.div>

            <h2 className="font-display text-2xl font-bold text-foreground mb-2">
              Welcome to Mera!
            </h2>
            <p className="text-muted-foreground mb-6">
              Your account has been created successfully
            </p>

            {userNumber && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-muted/50 rounded-2xl p-6 mb-6"
              >
                <p className="text-sm text-muted-foreground mb-2">Your unique User ID</p>
                <p className="font-display text-3xl font-bold text-primary">
                  {userNumber}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Friends can use this ID to find you
                </p>
              </motion.div>
            )}

            <div className="bg-accent/50 rounded-xl p-4 mb-6">
              <Check className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-sm text-foreground font-medium">
                Email verified
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {email}
              </p>
            </div>

            <Button
              type="button"
              onClick={handleContinue}
              className="btn-primary w-full h-12 text-base"
            >
              Get Started
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </motion.div>
        );
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] grid lg:grid-cols-2 overflow-x-hidden">
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
      <div className="flex items-center justify-center p-4 sm:p-6 lg:p-12 gradient-hero overflow-y-auto">
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

          <div className="card-base p-6 sm:p-8 lg:p-10">
            <AnimatePresence mode="wait">
              {mode === "login" ? (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-8 text-center">
                    <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                      Welcome back
                    </h2>
                    <p className="text-muted-foreground">
                      Sign in to continue to Mera
                    </p>
                  </div>

                  <form onSubmit={handleLogin} className="space-y-4">
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

                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setMode("forgot");
                          setResetSent(false);
                          setErrors({});
                        }}
                        className="text-sm text-primary hover:underline"
                      >
                        Forgot password?
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
                          Sign in
                          <ArrowRight className="h-5 w-5 ml-2" />
                        </>
                      )}
                    </Button>
                  </form>
                </motion.div>
              ) : mode === "forgot" ? (
                <motion.div
                  key="forgot"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-8 text-center">
                    <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                      Reset password
                    </h2>
                    <p className="text-muted-foreground">
                      {resetSent 
                        ? "Check your email for the reset link" 
                        : "Enter your email to receive a reset link"}
                    </p>
                  </div>

                  {resetSent ? (
                    <div className="space-y-4">
                      <div className="bg-accent/50 rounded-xl p-6 text-center">
                        <Mail className="h-10 w-10 text-primary mx-auto mb-3" />
                        <p className="text-sm text-foreground font-medium mb-1">
                          Email sent!
                        </p>
                        <p className="text-xs text-muted-foreground">
                          We've sent a password reset link to {email}
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={() => setMode("login")}
                        className="btn-primary w-full h-12 text-base"
                      >
                        <ArrowLeft className="h-5 w-5 mr-2" />
                        Back to sign in
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <div>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="pl-12 input-field"
                          />
                        </div>
                        {errors.email && (
                          <p className="text-sm text-destructive mt-1">{errors.email}</p>
                        )}
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
                            Send reset link
                            <ArrowRight className="h-5 w-5 ml-2" />
                          </>
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setMode("login")}
                        className="w-full h-12"
                      >
                        <ArrowLeft className="h-5 w-5 mr-2" />
                        Back to sign in
                      </Button>
                    </form>
                  )}
                </motion.div>
              ) : (
                renderSignupStep()
              )}
            </AnimatePresence>

            {(mode === "login" || (mode === "signup" && signupStep < 5)) && (
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
            )}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground px-4">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default AuthPage;
