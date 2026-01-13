import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://mzkrwlbwrwyempyrhsrt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16a3J3bGJ3cnd5ZW1weXJoc3J0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMzcxMDIsImV4cCI6MjA4MTYxMzEwMn0.A7rgvx7dyKH9QGVhxYIDQnd47pPepeergoFYfwDdV7s';

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// 🔴 ВАЖНО
window.supabase = supabase;
