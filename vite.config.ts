import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const FALLBACK_SUPABASE_URL = "https://aeiqhaqwudhhdfsvnnja.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlaXFoYXF3dWRoaGRmc3ZubmphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NDQ0MjgsImV4cCI6MjA4MjMyMDQyOH0.8MIo_yc0dKMxxBpQlaIeuv9iCIVs8fi4FULxSOtHChk";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const supabasePublishableKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    FALLBACK_SUPABASE_PUBLISHABLE_KEY;
  
  return {
    server: {
      host: "::",
      port: 8080,
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
        supabasePublishableKey
      ),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(
        supabasePublishableKey
      ),
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ['react', 'react-dom'],
    },
  };
});
