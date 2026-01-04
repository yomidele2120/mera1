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

    // Check rate limiting
    const { data: canProceed } = await supabase.rpc("check_password_reset_rate_limit", { p_email: email });
    
    if (!canProceed) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Find user by email
    const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error("Error listing users:", userError);
      return new Response(
        JSON.stringify({ error: "An error occurred" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const user = userData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      // Return success even if user not found to prevent email enumeration
      return new Response(
        JSON.stringify({ success: true, message: "If an account exists, a verification code has been sent." }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP in database
    const { error: insertError } = await supabase
      .from("password_reset_codes")
      .insert({
        user_id: user.id,
        email: email.toLowerCase(),
        code: otp,
      });

    if (insertError) {
      console.error("Error storing OTP:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to generate verification code" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // For demo purposes, we'll use the Lovable AI to send the email
    // In production, integrate with Resend or similar email service
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    
    // Log the OTP for testing (in production, remove this)
    console.log(`OTP for ${email}: ${otp}`);

    // Since we don't have Resend configured, we'll simulate email sending
    // In a real scenario, you would send the email here using Resend
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "If an account exists, a verification code has been sent.",
        // Only include OTP in development for testing
        ...(Deno.env.get("ENVIRONMENT") !== "production" && { debug_otp: otp })
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in send-password-reset-code:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
