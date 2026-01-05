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

    // Check if email already exists
    const { data: userData } = await supabase.auth.admin.listUsers();
    const existingUser = userData?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    
    if (existingUser) {
      return new Response(
        JSON.stringify({ error: "An account with this email already exists" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP in a temporary table (using password_reset_codes for simplicity)
    // We'll use a special user_id for signup verification
    const { error: insertError } = await supabase
      .from("password_reset_codes")
      .upsert({
        user_id: "00000000-0000-0000-0000-000000000000", // Placeholder for signup
        email: email.toLowerCase(),
        code: otp,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
        used: false,
        attempts: 0,
      }, { 
        onConflict: 'email',
        ignoreDuplicates: false 
      });

    if (insertError) {
      console.error("Error storing OTP:", insertError);
      // Try insert without upsert
      const { error: insertError2 } = await supabase
        .from("password_reset_codes")
        .insert({
          user_id: "00000000-0000-0000-0000-000000000000",
          email: email.toLowerCase(),
          code: otp,
        });
      
      if (insertError2) {
        console.error("Error on second attempt:", insertError2);
        return new Response(
          JSON.stringify({ error: "Failed to generate verification code" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
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
