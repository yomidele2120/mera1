import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

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
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
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

    // Send verification email using Resend
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      
      const { error: emailError } = await resend.emails.send({
        from: "Mera <noreply@mera.app>",
        to: [email],
        subject: "Your Mera Verification Code",
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
                <tr>
                  <td align="center">
                    <table width="100%" max-width="480" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                      <tr>
                        <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px 40px; text-align: center;">
                          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Mera</h1>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 40px;">
                          <h2 style="color: #18181b; margin: 0 0 16px 0; font-size: 24px; font-weight: 600;">Verify your email</h2>
                          <p style="color: #52525b; margin: 0 0 24px 0; font-size: 16px; line-height: 1.5;">
                            Thanks for signing up! Use the verification code below to complete your registration:
                          </p>
                          <div style="background-color: #f4f4f5; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
                            <span style="font-size: 36px; font-weight: 700; color: #18181b; letter-spacing: 8px;">${otp}</span>
                          </div>
                          <p style="color: #71717a; margin: 0; font-size: 14px; line-height: 1.5;">
                            This code expires in 10 minutes. If you didn't request this code, you can safely ignore this email.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background-color: #fafafa; padding: 24px 40px; text-align: center; border-top: 1px solid #e4e4e7;">
                          <p style="color: #a1a1aa; margin: 0; font-size: 12px;">
                            © ${new Date().getFullYear()} Mera. All rights reserved.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
          </html>
        `,
      });

      if (emailError) {
        console.error("Error sending email:", emailError);
        // Don't fail the request - code is still saved, just log the error
        console.log(`Fallback: OTP for ${email}: ${otp}`);
      } else {
        console.log(`Verification email sent to ${email}`);
      }
    } else {
      // No Resend API key - log OTP for development
      console.log(`No RESEND_API_KEY configured. OTP for ${email}: ${otp}`);
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Verification code sent to your email.",
        // Include OTP in development for testing (when no Resend key)
        ...(!resendApiKey && { debug_otp: otp })
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
