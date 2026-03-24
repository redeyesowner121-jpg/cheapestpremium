/*
  # Sync Products Webhook

  This webhook syncs products between website and Telegram bot.
  It receives notifications about product changes and queues them for bot processing.
*/

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SyncPayload {
  type: "product" | "category";
  action: "create" | "update" | "delete";
  data?: any;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const payload: SyncPayload = await req.json();

    if (!payload.type || !payload.action) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: type, action" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[SYNC] ${payload.type} ${payload.action}:`, payload.data?.id || payload.data?.name);

    if (payload.type === "product") {
      if (payload.data?.id) {
        const { data: product } = await supabase
          .from("products")
          .select("*")
          .eq("id", payload.data.id)
          .maybeSingle();

        if (product) {
          const { error: queueError } = await supabase
            .from("product_sync_queue")
            .insert({
              event_type: `product_${payload.action}`,
              product_id: product.id,
            });

          if (queueError) {
            console.error("Queue error:", queueError);
          }
        }
      }
    }

    const response = {
      success: true,
      message: `Webhook received: ${payload.type} ${payload.action}`,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
