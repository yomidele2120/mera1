import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  email: string;
}

const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { email }: RequestBody = await req.json();
    
    if (!email || !email.includes("@")) {
      return new Response(
        JSON.stringify({ error: "Valid email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if email already exists with a confirmed account
    const { data: userData } = await supabase.auth.admin.listUsers();
    const existingUser = userData?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    
    // Only block if user exists AND has confirmed their email (completed signup)
    if (existingUser && existingUser.email_confirmed_at) {
      return new Response(
        JSON.stringify({ error: "An account with this email already exists. Please login instead." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    // If user exists but never confirmed, delete the incomplete account to allow fresh signup
    if (existingUser && !existingUser.email_confirmed_at) {
      console.log(`Deleting unconfirmed user ${existingUser.id} to allow fresh signup`);
      await supabase.auth.admin.deleteUser(existingUser.id);
    }

    // Generate OTP
    const otp = generateOTP();
    
    // Delete any existing codes for this email first
    await supabase
      .from("signup_verification_codes")
      .delete()
      .eq("email", email.toLowerCase());
    
    // Store OTP in signup_verification_codes table
    const { error: insertError } = await supabase
      .from("signup_verification_codes")
      .insert({
        email: email.toLowerCase(),
        code: otp,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
        used: false,
        attempts: 0,
      });

    if (insertError) {
      console.error("Error storing OTP:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to generate verification code" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Log the OTP for development (in production, integrate with email service)
    console.log(`Signup verification OTP for ${email}: ${otp}`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Verification code sent to your email.",
        // Include OTP in development for testing
        ...(Deno.env.get("ENVIRONMENT") !== "production" && { debug_otp: otp })
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in send-signup-verification:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
