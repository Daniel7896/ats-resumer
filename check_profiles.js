import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://qhzhepmdngqwovumnqkv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoemhlcG1kbmdxd292dW1ucWt2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjcxMzcwNywiZXhwIjoyMDk4Mjg5NzA3fQ.ipi1mp9lM9C8QtH5L51ePRuNrjPWweJJ6Ugcjg1csyw"
);

async function main() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*");

  if (error) {
    console.error("Error fetching profiles:", error);
    return;
  }

  console.log("Total profiles:", data.length);
  for (const prof of data) {
    console.log(`Profile ID: ${prof.id}, Plan: ${JSON.stringify(prof.plan)}, Name: ${prof.full_name}`);
  }
}

main();
