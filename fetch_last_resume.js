import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://qhzhepmdngqwovumnqkv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoemhlcG1kbmdxd292dW1ucWt2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjcxMzcwNywiZXhwIjoyMDk4Mjg5NzA3fQ.ipi1mp9lM9C8QtH5L51ePRuNrjPWweJJ6Ugcjg1csyw"
);

async function main() {
  const { data, error } = await supabase
    .from("resume_history")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error fetching resume history:", error);
    return;
  }

  console.log("Found", data.length, "rows.");
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    console.log(`\n--- Row ${i + 1} ---`);
    console.log("Filename:", row.resume_filename);
    console.log("Created At:", row.created_at);
    console.log("Raw rewritten_resume length:", row.rewritten_resume.length);
    console.log("Sample (first 200 chars):", JSON.stringify(row.rewritten_resume.substring(0, 200)));
    console.log("Does it contain \\n?", row.rewritten_resume.includes("\n"));
  }
}

main();
