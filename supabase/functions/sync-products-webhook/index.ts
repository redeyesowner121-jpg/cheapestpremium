/*
  # Sync Products Webhook

  This webhook is triggered when products or categories are updated/created/deleted.
  It serves as a notification system to keep the bot in sync with the website.

  Usage: Call this endpoint to trigger product/category sync events
*/

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
