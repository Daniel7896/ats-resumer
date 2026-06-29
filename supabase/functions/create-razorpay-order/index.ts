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

    // Initialize Admin Supabase Client for database lookups and writes
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

    const { plan, mock = false } = await req.json();

    if (!plan) {
      return new Response(JSON.stringify({ error: "Missing plan parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lookup plan details from DB (never trust price from frontend)
    const { data: planInfo, error: planError } = await supabaseAdmin
      .from("plan_limits")
      .select("price")
      .eq("plan", plan)
      .single();

    if (planError || !planInfo) {
      return new Response(JSON.stringify({ error: `Invalid plan or price not found: ${planError?.message || ""}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Direct transition to zero-price plan (e.g. downgrading/resetting to free)
    if (planInfo.price === 0) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({ plan: plan })
        .eq("id", user.id);

      if (profileError) {
        throw profileError;
      }

      // Log the transition in payments
      await supabaseAdmin.from("payments").insert({
        user_id: user.id,
        razorpay_order_id: `free_reset_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        plan,
        amount: 0,
        status: "paid"
      });

      return new Response(JSON.stringify({
        success: true,
        plan,
        zeroPrice: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const isDev = Deno.env.get("ENVIRONMENT") === "development";
    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

    // Gate Mock Mode strictly behind development environment flag
    if (mock || !keyId || !keySecret) {
      if (!isDev) {
        return new Response(
          JSON.stringify({ error: "Mock mode is only permitted in the local development environment." }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Generate a mock order ID
      const mockOrderId = `order_mock_${Math.random().toString(36).substring(2, 15)}`;
      
      // Log the mock order creation in the payments table
      const { error: dbError } = await supabaseAdmin.from("payments").insert({
        user_id: user.id,
        razorpay_order_id: mockOrderId,
        plan,
        amount: planInfo.price,
        status: "created"
      });

      if (dbError) {
        throw dbError;
      }

      return new Response(JSON.stringify({
        id: mockOrderId,
        amount: planInfo.price * 100,
        currency: "INR",
        mock: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Call Real Razorpay API
    const auth = btoa(`${keyId}:${keySecret}`);
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: planInfo.price * 100,
        currency: "INR",
        receipt: `receipt_${user.id.substring(0, 8)}_${Date.now()}`
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: `Razorpay API error: ${errorText}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const order = await response.json();

    // Log real order creation in the payments table
    const { error: dbError } = await supabaseAdmin.from("payments").insert({
      user_id: user.id,
      razorpay_order_id: order.id,
      plan,
      amount: planInfo.price,
      status: "created"
    });

    if (dbError) {
      throw dbError;
    }

    return new Response(JSON.stringify({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      mock: false
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("create-razorpay-order error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
