import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://unywqywhahnnlftloqvm.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVueXdxeXdoYWhubmxmdGxvcXZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NTY4NTAsImV4cCI6MjA3NjUzMjg1MH0.t0kJjQ1mBzstddyXOLbpAy8Yc_oYwmp-4u4fRjMVels";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
