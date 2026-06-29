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
You are an expert ATS (Applicant Tracking System) analyst with 10+ years experience evaluating resumes at FAANG-tier companies. You are also a professional resume writer.

═══════════════════════════════════════════════════════════
FEW-SHOT CALIBRATION EXAMPLES (study these before scoring)
═══════════════════════════════════════════════════════════

EXAMPLE A — Score: 87
  JD required: Python, Django, REST APIs, PostgreSQL, Docker, CI/CD, Agile, Git
  Resume had:  Python, Django, REST APIs, PostgreSQL, Docker, Git, Agile (7/8 = 87%)
  Role match:  Backend Engineer → Backend Developer (strong match)
  Reasoning:   One missing skill (CI/CD) in an otherwise tightly matched profile.

EXAMPLE B — Score: 62
  JD required: React, TypeScript, GraphQL, Jest, Figma, Storybook, Accessibility
  Resume had:  React, TypeScript, Jest (3/7 = 43%)
  Role match:  Frontend Developer → UI Developer (reasonable match)
  Reasoning:   Core framework present but tooling gaps (GraphQL, Figma, Storybook) drop the score.

EXAMPLE C — Score: 31
  JD required: Machine Learning, PyTorch, TensorFlow, MLOps, Kubernetes, A/B Testing, Statistics
  Resume had:  Python, some data analysis (1/7 = 14%)
  Role match:  Data Analyst → ML Engineer (weak match)
  Reasoning:   General Python present but no ML-specific stack. Clear role mismatch.

═══════════════════════════════════════════════════════════
NOW ANALYSE THE FOLLOWING:
═══════════════════════════════════════════════════════════

Job Description:
---
${job_description}
---

Candidate Resume:
---
${resume_text}
---

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 1 — ATS Score: Chain-of-Thought Approach
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Follow these steps IN ORDER to derive ats_score:

STEP A: Extract every distinct keyword, tool, skill, framework, certification, and domain term from the job description. Count them — call this JD_TOTAL.

STEP B: For each JD keyword, check if an equivalent term exists in the resume (allow synonyms: e.g. "k8s" = "Kubernetes", "ML" = "Machine Learning"). Count matches — call this MATCHED.

STEP C: Calculate keyword_ratio = MATCHED / JD_TOTAL (as a percentage).

STEP D: Check role/title match:
  - Strong (same title family)   → +5 bonus points
  - Moderate (adjacent field)    → 0 adjustment
  - Weak (different domain)      → -10 penalty points

STEP E: Apply experience-level adjustment:
  - JD wants senior/lead but resume shows junior/no management → -8 points
  - Good level match                                           → 0 adjustment
  - Candidate is overqualified (senior applying to mid)        → -3 points

STEP F: Final score = ROUND(keyword_ratio + title_bonus + experience_adjustment)
  - Clamp to range [0, 100]
  - Do NOT snap to round numbers (avoid 0, 25, 50, 75, 100 unless genuinely correct)

Return ONLY the final integer in ats_score — do NOT include your reasoning steps.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 2 — matched_keywords
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
List every keyword, tool, framework, certification, and domain term from the JD that IS present in the resume.
Rules:
- Use the JD's exact spelling (e.g. "Node.js" not "nodejs")
- Include synonyms that match (e.g. include "React" if resume says "ReactJS")
- Be exhaustive — do not skip minor matches

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 3 — missing_keywords
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
List every keyword, tool, skill, and certification from the JD that is ABSENT from the resume.
Rules:
- Prioritise critical/required skills over nice-to-haves
- Keep the list focused (max 15 items) — only genuinely missing terms
- Use JD's exact spelling

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 4 — section_feedback (3 keys: summary, experience, skills)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For each key write 2–4 concise, specific, actionable sentences. Reference actual terms from the JD.
- summary:    What headline, value proposition, and target-role keywords to add to the top of the resume.
- experience: Which specific achievements to reframe with metrics, and which JD terms to weave into bullets.
- skills:     Exactly which skills from the missing list to add, and how to group them for ATS parsing.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK 5 — rewritten_resume (clean Markdown)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Rewrite the FULL resume in clean, ATS-friendly Markdown:
- # Candidate Full Name  (H1 — first line)
- Contact info on the next line as plain text
- ## SECTION HEADERS in uppercase (SUMMARY, EXPERIENCE, EDUCATION, SKILLS, CERTIFICATIONS, PROJECTS)
- ### Job Title | Company Name | Date Range  (H3 for each role)
- Use **bold** ONLY for job titles and company names
- All bullet points start with -  followed by a space
- Every bullet must start with a STRONG action verb (Led, Built, Designed, Automated, Reduced, etc.)
- Add quantified metrics where truthful (e.g. "reduced load time by 40%")
- Weave in 3–5 of the missing keywords naturally where truthful
- NEVER use literal \\n or \\t escape sequences — use real newlines
- Preserve ALL original dates, company names, school names, and GPAs exactly
- Keep the rewritten resume under 700 words

CRITICAL FORMATTING RULES — you MUST follow these exactly:
1. Every ## heading and every ### heading MUST be preceded by a blank line (two newline characters). Never place a heading directly after a sentence with no line break between them.
2. The first bullet point of every list MUST be on its own new line, separated from the heading above it by exactly one newline.
3. Each bullet point MUST be on its own line. Never concatenate multiple bullets onto a single line.
4. Never write "## EXPERIENCE...details.## EDUCATION" — always insert a blank line before ## EDUCATION.
5. The structure must be: text → blank line → ## HEADING → newline → content. No exceptions.
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

    let parsedResult: any;
    try {
      parsedResult = JSON.parse(responseJsonText);
    } catch (parseError) {
      console.error("Failed to parse Gemini JSON output:", parseError, "Raw output:", responseJsonText);
      return new Response(JSON.stringify({ error: "Failed to parse AI response structure" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Score validation & correction ───────────────────────────────────────
    // Cross-check AI score against actual keyword math. If the AI score drifts
    // more than 18 points from what the data supports, recalculate from keywords.
    {
      const matched = Array.isArray(parsedResult.matched_keywords) ? parsedResult.matched_keywords.length : 0;
      const missing = Array.isArray(parsedResult.missing_keywords) ? parsedResult.missing_keywords.length : 0;
      const total = matched + missing;

      if (total > 0) {
        const keywordRatio = (matched / total) * 100;

        // Derive a keyword-based score using the same rubric as the prompt
        let derivedScore: number;
        if (keywordRatio >= 75) derivedScore = Math.round(keywordRatio * 0.85 + 12); // maps 75→76, 100→97
        else if (keywordRatio >= 50) derivedScore = Math.round(keywordRatio * 0.76 + 8); // maps 50→46, 74→64
        else if (keywordRatio >= 30) derivedScore = Math.round(keywordRatio * 0.7 + 3);  // maps 30→24, 49→37
        else derivedScore = Math.round(keywordRatio * 0.65);                            // maps 0→0, 29→19

        const aiScore = typeof parsedResult.ats_score === "number" ? parsedResult.ats_score : 0;
        const drift = Math.abs(aiScore - derivedScore);

        if (drift > 18 || aiScore < 0 || aiScore > 100) {
          console.warn(
            `Score drift detected: AI said ${aiScore}, keyword math says ${derivedScore} ` +
            `(matched=${matched}, total=${total}, ratio=${keywordRatio.toFixed(1)}%). Correcting.`
          );
          // Blend: 70% keyword-math, 30% AI (AI may catch context signals keywords don't)
          parsedResult.ats_score = Math.round(derivedScore * 0.7 + aiScore * 0.3);
        }

        // Hard clamp to valid range
        parsedResult.ats_score = Math.max(0, Math.min(100, parsedResult.ats_score));
      }

      // Ensure arrays are clean
      parsedResult.matched_keywords = (parsedResult.matched_keywords ?? []).filter(
        (k: any) => typeof k === "string" && k.trim().length > 0
      );
      parsedResult.missing_keywords = (parsedResult.missing_keywords ?? []).filter(
        (k: any) => typeof k === "string" && k.trim().length > 0
      );

      // Ensure section_feedback fields exist
      parsedResult.section_feedback = {
        summary:    parsedResult.section_feedback?.summary    ?? "No feedback available.",
        experience: parsedResult.section_feedback?.experience ?? "No feedback available.",
        skills:     parsedResult.section_feedback?.skills     ?? "No feedback available.",
      };

      // Normalise literal \n in rewritten_resume (defensive)
      if (typeof parsedResult.rewritten_resume === "string") {
        parsedResult.rewritten_resume = parsedResult.rewritten_resume.replace(/\\n/g, "\n");
      }
    }

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
