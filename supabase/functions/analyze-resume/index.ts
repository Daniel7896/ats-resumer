// Deno Edge Function: analyze-resume
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS Preflight
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

    // Initialize Admin Supabase Client for bypass RLS limits checks
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

    const userId = user.id;

    // 1. Fetch user profile to get their subscription plan
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("plan")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("Profile fetch error:", profileError);
    }
    const userPlan = profile?.plan || "free";

    // 2. Fetch limits for this plan
    const { data: planLimits, error: limitError } = await supabaseAdmin
      .from("plan_limits")
      .select("monthly_analyses")
      .eq("plan", userPlan)
      .single();

    if (limitError) {
      console.error("Plan limit fetch error:", limitError);
    }
    const limit = planLimits ? planLimits.monthly_analyses : 5; // Fallback to 5 for free

    // 3. Fetch/create usage tracker for this month
    const now = new Date();
    const monthYear = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

    let { data: usage, error: usageError } = await supabaseAdmin
      .from("usage_tracking")
      .select("analyses_count")
      .eq("user_id", userId)
      .eq("month_year", monthYear)
      .maybeSingle();

    if (usageError) {
      console.error("Usage tracking fetch error:", usageError);
    }

    if (!usage) {
      const { data: newUsage, error: createUsageError } = await supabaseAdmin
        .from("usage_tracking")
        .insert({ user_id: userId, month_year: monthYear, analyses_count: 0 })
        .select("analyses_count")
        .single();

      if (createUsageError) {
        console.error("Creating month tracker error:", createUsageError);
      }
      usage = newUsage || { analyses_count: 0 };
    }

    const currentCount = usage?.analyses_count || 0;

    // 4. Enforce quota limits
    if (limit !== null && currentCount >= limit) {
      return new Response(
        JSON.stringify({
          error: "Quota Exceeded",
          code: "LIMIT_EXCEEDED",
          message: `You have used ${currentCount} of your ${limit} monthly analyses. Please upgrade your plan.`,
          limit,
          currentCount,
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 5. Parse request body
    const { resume_text, job_description, resume_filename } = await req.json();

    if (!resume_text || !job_description) {
      return new Response(JSON.stringify({ error: "Missing resume_text or job_description" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent token abuse
    if (resume_text.length > 50000 || job_description.length > 20000) {
      return new Response(JSON.stringify({ error: "Input text exceeds maximum allowed characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Call Gemini API
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      return new Response(JSON.stringify({ error: "Gemini API key is not configured on the server" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

    const promptText = `
Job Description:
${job_description}

Resume Text:
${resume_text}

Perform an expert analysis of the resume against the job description:
1. Provide an ATS compatibility score from 0 to 100 based on core qualifications, role match, and formatting suitability.
2. Extract the matched key terms and skills that are already present in the resume.
3. Identify crucial missing keywords and skills from the job description that should be integrated.
4. Give specific, actionable section feedback for the Summary, Experience, and Skills sections.
5. Generate a fully tailored, rewritten version of the resume in clean Markdown format. Focus bullet points on achievements and metrics, preserving dates and names of the original resume.
`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: promptText }]
        }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              ats_score: {
                type: "INTEGER",
                description: "ATS compatibility score between 0 and 100"
              },
              matched_keywords: {
                type: "ARRAY",
                items: { type: "STRING" },
                description: "Key skills, concepts, or tools matching the job description"
              },
              missing_keywords: {
                type: "ARRAY",
                items: { type: "STRING" },
                description: "Critical skills, keywords, or tools from the job description that are missing"
              },
              section_feedback: {
                type: "OBJECT",
                properties: {
                  summary: { type: "STRING", description: "Brief advice for the professional summary" },
                  experience: { type: "STRING", description: "Suggestions to align roles and bullet points" },
                  skills: { type: "STRING", description: "Advice for structuring tech or professional skills" }
                },
                required: ["summary", "experience", "skills"]
              },
              rewritten_resume: {
                type: "STRING",
                description: "Full tailored rewritten resume text in clean Markdown"
              }
            },
            required: ["ats_score", "matched_keywords", "missing_keywords", "section_feedback", "rewritten_resume"]
          }
        }
      }),
    });

    if (!geminiResponse.ok) {
      const geminiErrText = await geminiResponse.text();
      console.error("Gemini API Error details:", geminiErrText);
      return new Response(JSON.stringify({ error: "Failed to communicate with AI service" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiData = await geminiResponse.json();
    const responseJsonText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseJsonText) {
      console.error("Empty or invalid Gemini output:", geminiData);
      return new Response(JSON.stringify({ error: "Invalid AI response structure" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsedResult = JSON.parse(responseJsonText);

    // 7. Increment usage_tracking.analyses_count
    const { error: incrementError } = await supabaseAdmin
      .from("usage_tracking")
      .update({
        analyses_count: currentCount + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("month_year", monthYear);

    if (incrementError) {
      console.error("Error incrementing usage counter:", incrementError);
    }

    // 8. Store result in resume_history
    const { error: historyError } = await supabaseAdmin
      .from("resume_history")
      .insert({
        user_id: userId,
        resume_filename: resume_filename || "resume.pdf",
        job_description: job_description,
        ats_score: parsedResult.ats_score,
        matched_keywords: parsedResult.matched_keywords,
        missing_keywords: parsedResult.missing_keywords,
        rewritten_resume: parsedResult.rewritten_resume,
      });

    if (historyError) {
      console.error("Error storing resume history:", historyError);
    }

    // 9. Return result + quota status
    return new Response(
      JSON.stringify({
        ...parsedResult,
        remaining_quota: limit !== null ? limit - (currentCount + 1) : null,
        max_quota: limit,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (err: any) {
    console.error("Server function error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
