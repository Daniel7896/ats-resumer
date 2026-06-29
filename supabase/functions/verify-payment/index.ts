import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase Client with User Auth Context
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Initialize Admin Supabase Client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get User Auth Details
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized user token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id) {
      return new Response(JSON.stringify({ error: "Missing order_id or payment_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Retrieve order log from DB
    const { data: paymentLog, error: logError } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("razorpay_order_id", razorpay_order_id)
      .single();

    if (logError || !paymentLog) {
      return new Response(JSON.stringify({ error: `Payment record not found for order: ${razorpay_order_id}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isDev = Deno.env.get("ENVIRONMENT") === "development";
    const isMock = razorpay_order_id.startsWith("order_mock_") || razorpay_payment_id.startsWith("pay_mock_");

    if (isMock) {
      if (!isDev) {
        return new Response(
          JSON.stringify({ error: "Mock payments are prohibited in the production environment." }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Mock signature verification succeeds directly in dev
      // Update payment record in database
      const { error: updateError } = await supabaseAdmin
        .from("payments")
        .update({
          razorpay_payment_id,
          razorpay_signature: razorpay_signature || "mock_signature",
          status: "paid",
        })
        .eq("razorpay_order_id", razorpay_order_id);

      if (updateError) {
        throw updateError;
      }

      // Update user plan to paid tier using service_role
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({ plan: paymentLog.plan })
        .eq("id", paymentLog.user_id);

      if (profileError) {
        throw profileError;
      }

      return new Response(JSON.stringify({ success: true, plan: paymentLog.plan }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Real Signature Verification
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keySecret) {
      return new Response(JSON.stringify({ error: "Server error: verification secret is missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!razorpay_signature) {
      return new Response(JSON.stringify({ error: "Missing signature for verification" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compute signature: HMAC-SHA256 of order_id + "|" + payment_id
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(keySecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const data = new TextEncoder().encode(`${razorpay_order_id}|${razorpay_payment_id}`);
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, data);
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (expectedSignature !== razorpay_signature) {
      // Mark transaction as failed
      await supabaseAdmin
        .from("payments")
        .update({ status: "failed" })
        .eq("razorpay_order_id", razorpay_order_id);

      return new Response(JSON.stringify({ error: "Invalid payment signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update payment record to paid
    const { error: updateError } = await supabaseAdmin
      .from("payments")
      .update({
        razorpay_payment_id,
        razorpay_signature,
        status: "paid",
      })
      .eq("razorpay_order_id", razorpay_order_id);

    if (updateError) {
      throw updateError;
    }

    // Update user profile plan
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ plan: paymentLog.plan })
      .eq("id", paymentLog.user_id);

    if (profileError) {
      throw profileError;
    }

    return new Response(JSON.stringify({ success: true, plan: paymentLog.plan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("verify-payment error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
