export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          role: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          message: string
          title: string
          type: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          message: string
          title: string
          type?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          message?: string
          title?: string
          type?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      banners: {
        Row: {
          created_at: string | null
          id: string
          image_url: string
          is_active: boolean | null
          link: string | null
          sort_order: number | null
          title: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url: string
          is_active?: boolean | null
          link?: string | null
          sort_order?: number | null
          title: string
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string
          is_active?: boolean | null
          link?: string | null
          sort_order?: number | null
          title?: string
        }
        Relationships: []
      }
      binance_amount_reservations: {
        Row: {
          amount_inr: number
          amount_usd: number
          created_at: string
          expires_at: string
          id: string
          payment_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_inr: number
          amount_usd: number
          created_at?: string
          expires_at?: string
          id?: string
          payment_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount_inr?: number
          amount_usd?: number
          created_at?: string
          expires_at?: string
          id?: string
          payment_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          created_at: string
          donation_amount: number | null
          id: string
          product_id: string | null
          quantity: number
          updated_at: string
          user_id: string
          variation_id: string | null
        }
        Insert: {
          created_at?: string
          donation_amount?: number | null
          id?: string
          product_id?: string | null
          quantity?: number
          updated_at?: string
          user_id: string
          variation_id?: string | null
        }
        Update: {
          created_at?: string
          donation_amount?: number | null
          id?: string
          product_id?: string | null
          quantity?: number
          updated_at?: string
          user_id?: string
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "product_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          icon_url: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          icon_url?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          icon_url?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          created_at: string | null
          id: string
          image_url: string | null
          is_admin: boolean | null
          message: string
          reply_to_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_admin?: boolean | null
          message: string
          reply_to_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_admin?: boolean | null
          message?: string
          reply_to_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      child_bot_earnings: {
        Row: {
          amount: number
          child_bot_id: string
          created_at: string
          id: string
          order_id: string
          status: string
        }
        Insert: {
          amount?: number
          child_bot_id: string
          created_at?: string
          id?: string
          order_id: string
          status?: string
        }
        Update: {
          amount?: number
          child_bot_id?: string
          created_at?: string
          id?: string
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "child_bot_earnings_child_bot_id_fkey"
            columns: ["child_bot_id"]
            isOneToOne: false
            referencedRelation: "child_bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_bot_earnings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "child_bot_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      child_bot_orders: {
        Row: {
          buyer_telegram_id: number
          child_bot_id: string
          created_at: string
          id: string
          main_order_id: string | null
          owner_commission: number
          product_name: string
          status: string
          telegram_order_id: string | null
          total_price: number
        }
        Insert: {
          buyer_telegram_id: number
          child_bot_id: string
          created_at?: string
          id?: string
          main_order_id?: string | null
          owner_commission?: number
          product_name: string
          status?: string
          telegram_order_id?: string | null
          total_price?: number
        }
        Update: {
          buyer_telegram_id?: number
          child_bot_id?: string
          created_at?: string
          id?: string
          main_order_id?: string | null
          owner_commission?: number
          product_name?: string
          status?: string
          telegram_order_id?: string | null
          total_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "child_bot_orders_child_bot_id_fkey"
            columns: ["child_bot_id"]
            isOneToOne: false
            referencedRelation: "child_bots"
            referencedColumns: ["id"]
          },
        ]
      }
      child_bot_settings: {
        Row: {
          child_bot_id: string
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          child_bot_id: string
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          child_bot_id?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "child_bot_settings_child_bot_id_fkey"
            columns: ["child_bot_id"]
            isOneToOne: false
            referencedRelation: "child_bots"
            referencedColumns: ["id"]
          },
        ]
      }
      child_bot_users: {
        Row: {
          child_bot_id: string
          created_at: string
          first_name: string | null
          id: string
          last_active: string
          telegram_id: number
          username: string | null
        }
        Insert: {
          child_bot_id: string
          created_at?: string
          first_name?: string | null
          id?: string
          last_active?: string
          telegram_id: number
          username?: string | null
        }
        Update: {
          child_bot_id?: string
          created_at?: string
          first_name?: string | null
          id?: string
          last_active?: string
          telegram_id?: number
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "child_bot_users_child_bot_id_fkey"
            columns: ["child_bot_id"]
            isOneToOne: false
            referencedRelation: "child_bots"
            referencedColumns: ["id"]
          },
        ]
      }
      child_bots: {
        Row: {
          bot_token: string
          bot_username: string | null
          created_at: string
          id: string
          is_active: boolean
          owner_telegram_id: number
          revenue_percent: number
          total_earnings: number
          total_orders: number
        }
        Insert: {
          bot_token: string
          bot_username?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          owner_telegram_id: number
          revenue_percent?: number
          total_earnings?: number
          total_orders?: number
        }
        Update: {
          bot_token?: string
          bot_username?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          owner_telegram_id?: number
          revenue_percent?: number
          total_earnings?: number
          total_orders?: number
        }
        Relationships: []
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          flash_sale_id: string | null
          id: string
          is_active: boolean | null
          max_discount: number | null
          min_purchase: number | null
          product_id: string | null
          starts_at: string | null
          updated_at: string
          usage_limit: number | null
          used_count: number | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          discount_type: string
          discount_value: number
          expires_at?: string | null
          flash_sale_id?: string | null
          id?: string
          is_active?: boolean | null
          max_discount?: number | null
          min_purchase?: number | null
          product_id?: string | null
          starts_at?: string | null
          updated_at?: string
          usage_limit?: number | null
          used_count?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          flash_sale_id?: string | null
          id?: string
          is_active?: boolean | null
          max_discount?: number | null
          min_purchase?: number | null
          product_id?: string | null
          starts_at?: string | null
          updated_at?: string
          usage_limit?: number | null
          used_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_flash_sale_id_fkey"
            columns: ["flash_sale_id"]
            isOneToOne: false
            referencedRelation: "flash_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          created_at: string
          flag: string | null
          id: string
          is_active: boolean | null
          name: string
          rate_to_inr: number
          sort_order: number | null
          symbol: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          flag?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          rate_to_inr?: number
          sort_order?: number | null
          symbol?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          flag?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          rate_to_inr?: number
          sort_order?: number | null
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_read: boolean | null
          message: string
          receiver_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_read?: boolean | null
          message: string
          receiver_id: string
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_read?: boolean | null
          message?: string
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      empty_cart_messages: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          message: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          message: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          message?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      flash_sales: {
        Row: {
          created_at: string | null
          end_time: string
          id: string
          is_active: boolean | null
          product_id: string | null
          sale_price: number
          start_time: string
          variation_id: string | null
          variation_name: string | null
        }
        Insert: {
          created_at?: string | null
          end_time: string
          id?: string
          is_active?: boolean | null
          product_id?: string | null
          sale_price: number
          start_time: string
          variation_id?: string | null
          variation_name?: string | null
        }
        Update: {
          created_at?: string | null
          end_time?: string
          id?: string
          is_active?: boolean | null
          product_id?: string | null
          sale_price?: number
          start_time?: string
          variation_id?: string | null
          variation_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flash_sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flash_sales_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "product_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      giveaway_points: {
        Row: {
          created_at: string
          id: string
          points: number
          telegram_id: number
          total_referrals: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          points?: number
          telegram_id: number
          total_referrals?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          points?: number
          telegram_id?: number
          total_referrals?: number
          updated_at?: string
        }
        Relationships: []
      }
      giveaway_products: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          points_required: number
          product_id: string
          stock: number | null
          updated_at: string
          variation_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          points_required?: number
          product_id: string
          stock?: number | null
          updated_at?: string
          variation_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          points_required?: number
          product_id?: string
          stock?: number | null
          updated_at?: string
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "giveaway_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "giveaway_products_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "product_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      giveaway_redemptions: {
        Row: {
          admin_note: string | null
          created_at: string
          giveaway_product_id: string
          id: string
          points_spent: number
          status: string
          telegram_id: number
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          giveaway_product_id: string
          id?: string
          points_spent: number
          status?: string
          telegram_id: number
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          giveaway_product_id?: string
          id?: string
          points_spent?: number
          status?: string
          telegram_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "giveaway_redemptions_giveaway_product_id_fkey"
            columns: ["giveaway_product_id"]
            isOneToOne: false
            referencedRelation: "giveaway_products"
            referencedColumns: ["id"]
          },
        ]
      }
      giveaway_referrals: {
        Row: {
          created_at: string
          id: string
          points_awarded: number
          referred_telegram_id: number
          referrer_telegram_id: number
        }
        Insert: {
          created_at?: string
          id?: string
          points_awarded?: number
          referred_telegram_id: number
          referrer_telegram_id: number
        }
        Update: {
          created_at?: string
          id?: string
          points_awarded?: number
          referred_telegram_id?: number
          referrer_telegram_id?: number
        }
        Relationships: []
      }
      giveaway_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      manual_deposit_requests: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          payment_method: string | null
          sender_name: string | null
          status: string | null
          transaction_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          payment_method?: string | null
          sender_name?: string | null
          status?: string | null
          transaction_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          payment_method?: string | null
          sender_name?: string | null
          status?: string | null
          transaction_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mother_bot_users: {
        Row: {
          created_at: string
          first_name: string | null
          id: string
          last_active: string
          last_name: string | null
          telegram_id: number
          username: string | null
        }
        Insert: {
          created_at?: string
          first_name?: string | null
          id?: string
          last_active?: string
          last_name?: string | null
          telegram_id: number
          username?: string | null
        }
        Update: {
          created_at?: string
          first_name?: string | null
          id?: string
          last_active?: string
          last_name?: string | null
          telegram_id?: number
          username?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      order_status_history: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          note: string | null
          order_id: string
          status: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          note?: string | null
          order_id: string
          status: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          note?: string | null
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          access_link: string | null
          admin_note: string | null
          buyer_confirmed: boolean | null
          created_at: string | null
          discount_applied: number | null
          guest_email: string | null
          guest_name: string | null
          guest_phone: string | null
          id: string
          is_withdrawable: boolean | null
          product_id: string | null
          product_image: string | null
          product_name: string
          quantity: number | null
          seller_id: string | null
          status: string | null
          total_price: number
          unit_price: number
          updated_at: string | null
          user_id: string | null
          user_note: string | null
        }
        Insert: {
          access_link?: string | null
          admin_note?: string | null
          buyer_confirmed?: boolean | null
          created_at?: string | null
          discount_applied?: number | null
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          is_withdrawable?: boolean | null
          product_id?: string | null
          product_image?: string | null
          product_name: string
          quantity?: number | null
          seller_id?: string | null
          status?: string | null
          total_price: number
          unit_price: number
          updated_at?: string | null
          user_id?: string | null
          user_note?: string | null
        }
        Update: {
          access_link?: string | null
          admin_note?: string | null
          buyer_confirmed?: boolean | null
          created_at?: string | null
          discount_applied?: number | null
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          is_withdrawable?: boolean | null
          product_id?: string | null
          product_image?: string | null
          product_name?: string
          quantity?: number | null
          seller_id?: string | null
          status?: string | null
          total_price?: number
          unit_price?: number
          updated_at?: string | null
          user_id?: string | null
          user_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_settings: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean | null
          setting_key: string
          setting_value: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean | null
          setting_key: string
          setting_value?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean | null
          setting_key?: string
          setting_value?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          amount_usd: number | null
          created_at: string
          id: string
          note: string
          payment_method: string | null
          product_id: string | null
          product_name: string | null
          status: string
          telegram_user_id: number | null
          updated_at: string
          user_id: string
          variation_id: string | null
        }
        Insert: {
          amount: number
          amount_usd?: number | null
          created_at?: string
          id?: string
          note: string
          payment_method?: string | null
          product_id?: string | null
          product_name?: string | null
          status?: string
          telegram_user_id?: number | null
          updated_at?: string
          user_id: string
          variation_id?: string | null
        }
        Update: {
          amount?: number
          amount_usd?: number | null
          created_at?: string
          id?: string
          note?: string
          payment_method?: string | null
          product_id?: string | null
          product_name?: string | null
          status?: string
          telegram_user_id?: number | null
          updated_at?: string
          user_id?: string
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "product_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_razorpay_deposits: {
        Row: {
          amount: number
          created_at: string
          id: string
          razorpay_order_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          razorpay_order_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          razorpay_order_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      price_history: {
        Row: {
          id: string
          price: number
          product_id: string | null
          recorded_at: string
          reseller_price: number | null
          variation_id: string | null
        }
        Insert: {
          id?: string
          price: number
          product_id?: string | null
          recorded_at?: string
          reseller_price?: number | null
          variation_id?: string | null
        }
        Update: {
          id?: string
          price?: number
          product_id?: string | null
          recorded_at?: string
          reseller_price?: number | null
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "product_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_stock_items: {
        Row: {
          access_link: string
          created_at: string
          id: string
          is_used: boolean
          order_id: string | null
          product_id: string
          telegram_order_id: string | null
          used_at: string | null
        }
        Insert: {
          access_link: string
          created_at?: string
          id?: string
          is_used?: boolean
          order_id?: string | null
          product_id: string
          telegram_order_id?: string | null
          used_at?: string | null
        }
        Update: {
          access_link?: string
          created_at?: string
          id?: string
          is_used?: boolean
          order_id?: string | null
          product_id?: string
          telegram_order_id?: string | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_stock_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stock_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stock_items_telegram_order_id_fkey"
            columns: ["telegram_order_id"]
            isOneToOne: false
            referencedRelation: "telegram_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variations: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          original_price: number | null
          price: number
          product_id: string
          reseller_price: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          original_price?: number | null
          price: number
          product_id: string
          reseller_price?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          original_price?: number | null
          price?: number
          product_id?: string
          reseller_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          access_link: string | null
          button_style: string | null
          category: string
          created_at: string | null
          delivery_mode: string
          description: string | null
          id: string
          image_url: string | null
          images: string[] | null
          is_active: boolean | null
          name: string
          original_price: number | null
          price: number
          rating: number | null
          reseller_price: number | null
          seo_tags: string | null
          show_link_in_bot: boolean
          show_link_in_website: boolean
          slug: string
          sold_count: number | null
          stock: number | null
          updated_at: string | null
        }
        Insert: {
          access_link?: string | null
          button_style?: string | null
          category: string
          created_at?: string | null
          delivery_mode?: string
          description?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_active?: boolean | null
          name: string
          original_price?: number | null
          price: number
          rating?: number | null
          reseller_price?: number | null
          seo_tags?: string | null
          show_link_in_bot?: boolean
          show_link_in_website?: boolean
          slug: string
          sold_count?: number | null
          stock?: number | null
          updated_at?: string | null
        }
        Update: {
          access_link?: string | null
          button_style?: string | null
          category?: string
          created_at?: string | null
          delivery_mode?: string
          description?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_active?: boolean | null
          name?: string
          original_price?: number | null
          price?: number
          rating?: number | null
          reseller_price?: number | null
          seo_tags?: string | null
          show_link_in_bot?: boolean
          show_link_in_website?: boolean
          slug?: string
          sold_count?: number | null
          stock?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_currency: string
          email: string
          fcm_token: string | null
          has_blue_check: boolean | null
          id: string
          is_reseller: boolean | null
          last_daily_bonus: string | null
          last_rank_decay: string | null
          name: string
          notifications_enabled: boolean | null
          pending_balance: number | null
          phone: string | null
          rank_balance: number | null
          referral_code: string | null
          referred_by: string | null
          total_deposit: number | null
          total_orders: number | null
          total_savings: number
          updated_at: string | null
          wallet_balance: number | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_currency?: string
          email: string
          fcm_token?: string | null
          has_blue_check?: boolean | null
          id: string
          is_reseller?: boolean | null
          last_daily_bonus?: string | null
          last_rank_decay?: string | null
          name: string
          notifications_enabled?: boolean | null
          pending_balance?: number | null
          phone?: string | null
          rank_balance?: number | null
          referral_code?: string | null
          referred_by?: string | null
          total_deposit?: number | null
          total_orders?: number | null
          total_savings?: number
          updated_at?: string | null
          wallet_balance?: number | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_currency?: string
          email?: string
          fcm_token?: string | null
          has_blue_check?: boolean | null
          id?: string
          is_reseller?: boolean | null
          last_daily_bonus?: string | null
          last_rank_decay?: string | null
          name?: string
          notifications_enabled?: boolean | null
          pending_balance?: number | null
          phone?: string | null
          rank_balance?: number | null
          referral_code?: string | null
          referred_by?: string | null
          total_deposit?: number | null
          total_orders?: number | null
          total_savings?: number
          updated_at?: string | null
          wallet_balance?: number | null
        }
        Relationships: []
      }
      ranks: {
        Row: {
          bg_color: string | null
          color: string | null
          created_at: string
          discount_percent: number
          discount_type: string
          icon: string | null
          id: string
          is_active: boolean | null
          min_balance: number
          name: string
          reseller_discount_percent: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          bg_color?: string | null
          color?: string | null
          created_at?: string
          discount_percent?: number
          discount_type?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          min_balance?: number
          name: string
          reseller_discount_percent?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          bg_color?: string | null
          color?: string | null
          created_at?: string
          discount_percent?: number
          discount_type?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          min_balance?: number
          name?: string
          reseller_discount_percent?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      razorpay_amount_reservations: {
        Row: {
          amount: number
          base_amount: number
          created_at: string
          deposit_request_id: string | null
          expires_at: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          base_amount: number
          created_at?: string
          deposit_request_id?: string | null
          expires_at?: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          base_amount?: number
          created_at?: string
          deposit_request_id?: string | null
          expires_at?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      redeem_code_usage: {
        Row: {
          code_id: string
          id: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          code_id: string
          id?: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          code_id?: string
          id?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "redeem_code_usage_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "redeem_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      redeem_codes: {
        Row: {
          amount: number
          code: string
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          updated_at: string
          usage_limit: number | null
          used_count: number | null
        }
        Insert: {
          amount: number
          code: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string
          usage_limit?: number | null
          used_count?: number | null
        }
        Update: {
          amount?: number
          code?: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string
          usage_limit?: number | null
          used_count?: number | null
        }
        Relationships: []
      }
      resale_links: {
        Row: {
          created_at: string
          custom_price: number
          id: string
          is_active: boolean
          link_code: string
          product_id: string
          reseller_id: string
          reseller_price: number
          uses: number
          variation_id: string | null
        }
        Insert: {
          created_at?: string
          custom_price: number
          id?: string
          is_active?: boolean
          link_code: string
          product_id: string
          reseller_id: string
          reseller_price: number
          uses?: number
          variation_id?: string | null
        }
        Update: {
          created_at?: string
          custom_price?: number
          id?: string
          is_active?: boolean
          link_code?: string
          product_id?: string
          reseller_id?: string
          reseller_price?: number
          uses?: number
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resale_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resale_links_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "product_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      search_logs: {
        Row: {
          created_at: string | null
          id: string
          results_count: number | null
          search_term: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          results_count?: number | null
          search_term: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          results_count?: number | null
          search_term?: string
          user_id?: string | null
        }
        Relationships: []
      }
      seller_product_variations: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          price: number
          product_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price: number
          product_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_product_variations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "seller_products"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_products: {
        Row: {
          access_link: string | null
          category: string
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          original_price: number | null
          price: number
          rating: number | null
          reseller_price: number | null
          seller_id: string
          sold_count: number | null
          stock: number | null
          updated_at: string | null
        }
        Insert: {
          access_link?: string | null
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          original_price?: number | null
          price: number
          rating?: number | null
          reseller_price?: number | null
          seller_id: string
          sold_count?: number | null
          stock?: number | null
          updated_at?: string | null
        }
        Update: {
          access_link?: string | null
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          original_price?: number | null
          price?: number
          rating?: number | null
          reseller_price?: number | null
          seller_id?: string
          sold_count?: number | null
          stock?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      site_visits: {
        Row: {
          created_at: string
          id: string
          page: string
          referrer: string | null
          subdomain: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          page: string
          referrer?: string | null
          subdomain?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          page?: string
          referrer?: string | null
          subdomain?: string | null
        }
        Relationships: []
      }
      telegram_ai_knowledge: {
        Row: {
          added_by: number
          answer: string
          created_at: string
          id: string
          language: string | null
          original_user_id: number | null
          question: string
          status: string
          updated_at: string
        }
        Insert: {
          added_by: number
          answer: string
          created_at?: string
          id?: string
          language?: string | null
          original_user_id?: number | null
          question: string
          status?: string
          updated_at?: string
        }
        Update: {
          added_by?: number
          answer?: string
          created_at?: string
          id?: string
          language?: string | null
          original_user_id?: number | null
          question?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      telegram_ai_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          telegram_id: number
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          telegram_id: number
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          telegram_id?: number
        }
        Relationships: []
      }
      telegram_bot_admins: {
        Row: {
          added_by: number
          created_at: string
          id: string
          telegram_id: number
        }
        Insert: {
          added_by: number
          created_at?: string
          id?: string
          telegram_id: number
        }
        Update: {
          added_by?: number
          created_at?: string
          id?: string
          telegram_id?: number
        }
        Relationships: []
      }
      telegram_bot_users: {
        Row: {
          created_at: string
          first_name: string | null
          id: string
          is_banned: boolean
          language: string | null
          last_active: string
          last_name: string | null
          telegram_id: number
          username: string | null
        }
        Insert: {
          created_at?: string
          first_name?: string | null
          id?: string
          is_banned?: boolean
          language?: string | null
          last_active?: string
          last_name?: string | null
          telegram_id: number
          username?: string | null
        }
        Update: {
          created_at?: string
          first_name?: string | null
          id?: string
          is_banned?: boolean
          language?: string | null
          last_active?: string
          last_name?: string | null
          telegram_id?: number
          username?: string | null
        }
        Relationships: []
      }
      telegram_conversation_state: {
        Row: {
          data: Json
          step: string
          telegram_id: number
          updated_at: string
        }
        Insert: {
          data?: Json
          step: string
          telegram_id: number
          updated_at?: string
        }
        Update: {
          data?: Json
          step?: string
          telegram_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      telegram_login_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          first_name: string | null
          id: string
          telegram_id: number
          used: boolean
          username: string | null
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          first_name?: string | null
          id?: string
          telegram_id: number
          used?: boolean
          username?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          first_name?: string | null
          id?: string
          telegram_id?: number
          used?: boolean
          username?: string | null
        }
        Relationships: []
      }
      telegram_orders: {
        Row: {
          admin_message_id: number | null
          amount: number
          created_at: string
          id: string
          product_id: string | null
          product_name: string | null
          reseller_profit: number | null
          reseller_telegram_id: number | null
          screenshot_file_id: string | null
          status: string
          telegram_user_id: number
          updated_at: string
          username: string | null
        }
        Insert: {
          admin_message_id?: number | null
          amount?: number
          created_at?: string
          id?: string
          product_id?: string | null
          product_name?: string | null
          reseller_profit?: number | null
          reseller_telegram_id?: number | null
          screenshot_file_id?: string | null
          status?: string
          telegram_user_id: number
          updated_at?: string
          username?: string | null
        }
        Update: {
          admin_message_id?: number | null
          amount?: number
          created_at?: string
          id?: string
          product_id?: string | null
          product_name?: string | null
          reseller_profit?: number | null
          reseller_telegram_id?: number | null
          screenshot_file_id?: string | null
          status?: string
          telegram_user_id?: number
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      telegram_resale_links: {
        Row: {
          created_at: string
          custom_price: number
          id: string
          is_active: boolean
          link_code: string
          product_id: string
          reseller_price: number
          reseller_telegram_id: number
          uses: number
          variation_id: string | null
        }
        Insert: {
          created_at?: string
          custom_price: number
          id?: string
          is_active?: boolean
          link_code: string
          product_id: string
          reseller_price: number
          reseller_telegram_id: number
          uses?: number
          variation_id?: string | null
        }
        Update: {
          created_at?: string
          custom_price?: number
          id?: string
          is_active?: boolean
          link_code?: string
          product_id?: string
          reseller_price?: number
          reseller_telegram_id?: number
          uses?: number
          variation_id?: string | null
        }
        Relationships: []
      }
      telegram_wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          telegram_id: number
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          telegram_id: number
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          telegram_id?: number
          type?: string
        }
        Relationships: []
      }
      telegram_wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          is_reseller: boolean
          referral_code: string | null
          referred_by: number | null
          telegram_id: number
          total_earned: number
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          is_reseller?: boolean
          referral_code?: string | null
          referred_by?: number | null
          telegram_id: number
          total_earned?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          is_reseller?: boolean
          referral_code?: string | null
          referred_by?: number | null
          telegram_id?: number
          total_earned?: number
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          status: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          status?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          status?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          temp_admin_expiry: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          temp_admin_expiry?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          temp_admin_expiry?: string | null
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          account_details: string
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          method: string
          status: string
          telegram_id: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_details: string
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          method?: string
          status?: string
          telegram_id?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_details?: string
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          method?: string
          status?: string
          telegram_id?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_order_refund: {
        Args: { _order_id: string; _user_id: string }
        Returns: Json
      }
      confirm_seller_receipt: {
        Args: { _buyer_id: string; _order_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_coupon_used_count: {
        Args: { coupon_id: string }
        Returns: undefined
      }
      increment_product_sold_count: {
        Args: { has_stock?: boolean; product_id: string; qty: number }
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      redeem_gift_code: {
        Args: { _code: string; _user_id: string }
        Returns: Json
      }
      transfer_funds: {
        Args: {
          _amount: number
          _note?: string
          _receiver_id: string
          _sender_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "user" | "admin" | "temp_admin" | "seller"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["user", "admin", "temp_admin", "seller"],
    },
  },
} as const
