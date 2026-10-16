export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      assistant_usage: {
        Row: {
          cache_read_tokens: number;
          created_at: string;
          id: number;
          input_tokens: number;
          kind: string;
          model: string;
          output_tokens: number;
          stop_reason: string | null;
          tools: string[];
          user_id: string | null;
        };
        Insert: {
          cache_read_tokens?: number;
          created_at?: string;
          id?: never;
          input_tokens?: number;
          kind: string;
          model: string;
          output_tokens?: number;
          stop_reason?: string | null;
          tools?: string[];
          user_id?: string | null;
        };
        Update: {
          cache_read_tokens?: number;
          created_at?: string;
          id?: never;
          input_tokens?: number;
          kind?: string;
          model?: string;
          output_tokens?: number;
          stop_reason?: string | null;
          tools?: string[];
          user_id?: string | null;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          after: Json | null;
          at: string;
          before: Json | null;
          entity: string;
          entity_id: string | null;
          id: number;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          after?: Json | null;
          at?: string;
          before?: Json | null;
          entity: string;
          entity_id?: string | null;
          id?: never;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          after?: Json | null;
          at?: string;
          before?: Json | null;
          entity?: string;
          entity_id?: string | null;
          id?: never;
        };
        Relationships: [];
      };
      brands: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      conversation_contacts: {
        Row: {
          conversation_id: string;
          created_at: string;
          email: string;
          full_name: string | null;
        };
        Insert: {
          conversation_id: string;
          created_at?: string;
          email: string;
          full_name?: string | null;
        };
        Update: {
          conversation_id?: string;
          created_at?: string;
          email?: string;
          full_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'conversation_contacts_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: true;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
        ];
      };
      conversation_messages: {
        Row: {
          attachments: number;
          author_id: string | null;
          body: string;
          conversation_id: string;
          created_at: string;
          email_message_id: string | null;
          id: number;
          inbound_email_id: string | null;
          kind: string;
          source: string;
        };
        Insert: {
          attachments?: number;
          author_id?: string | null;
          body: string;
          conversation_id: string;
          created_at?: string;
          email_message_id?: string | null;
          id?: never;
          inbound_email_id?: string | null;
          kind: string;
          source: string;
        };
        Update: {
          attachments?: number;
          author_id?: string | null;
          body?: string;
          conversation_id?: string;
          created_at?: string;
          email_message_id?: string | null;
          id?: never;
          inbound_email_id?: string | null;
          kind?: string;
          source?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'conversation_messages_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
        ];
      };
      conversations: {
        Row: {
          assigned_to: string | null;
          channel: string;
          created_at: string;
          id: string;
          last_customer_message_at: string | null;
          last_message_at: string;
          last_staff_message_at: string | null;
          locale: string;
          number: number;
          order_id: string | null;
          request_id: string | null;
          revision: number;
          status: string;
          subject: string;
          topic: string;
          updated_at: string;
        };
        Insert: {
          assigned_to?: string | null;
          channel: string;
          created_at?: string;
          id?: string;
          last_customer_message_at?: string | null;
          last_message_at?: string;
          last_staff_message_at?: string | null;
          locale: string;
          number?: never;
          order_id?: string | null;
          request_id?: string | null;
          revision?: number;
          status?: string;
          subject: string;
          topic?: string;
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          channel?: string;
          created_at?: string;
          id?: string;
          last_customer_message_at?: string | null;
          last_message_at?: string;
          last_staff_message_at?: string | null;
          locale?: string;
          number?: never;
          order_id?: string | null;
          request_id?: string | null;
          revision?: number;
          status?: string;
          subject?: string;
          topic?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'conversations_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      daily_reports: {
        Row: {
          facts: NonNullable<Json>;
          generated_at: string;
          generated_by: string | null;
          id: string;
          location_id: string;
          report_date: string;
          summary: string | null;
          summary_at: string | null;
          summary_model: string | null;
        };
        Insert: {
          facts: NonNullable<Json>;
          generated_at?: string;
          generated_by?: string | null;
          id?: string;
          location_id: string;
          report_date: string;
          summary?: string | null;
          summary_at?: string | null;
          summary_model?: string | null;
        };
        Update: {
          facts?: NonNullable<Json>;
          generated_at?: string;
          generated_by?: string | null;
          id?: string;
          location_id?: string;
          report_date?: string;
          summary?: string | null;
          summary_at?: string | null;
          summary_model?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'daily_reports_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'stock_locations';
            referencedColumns: ['id'];
          },
        ];
      };
      inventory_levels: {
        Row: {
          location_id: string;
          on_hand: number;
          reorder_point: number | null;
          reserved: number;
          updated_at: string;
          variant_id: string;
        };
        Insert: {
          location_id: string;
          on_hand?: number;
          reorder_point?: number | null;
          reserved?: number;
          updated_at?: string;
          variant_id: string;
        };
        Update: {
          location_id?: string;
          on_hand?: number;
          reorder_point?: number | null;
          reserved?: number;
          updated_at?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'inventory_levels_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'stock_locations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inventory_levels_variant_id_fkey';
            columns: ['variant_id'];
            isOneToOne: false;
            referencedRelation: 'product_variants';
            referencedColumns: ['id'];
          },
        ];
      };
      inventory_movements: {
        Row: {
          actor_id: string | null;
          created_at: string;
          delta_on_hand: number;
          delta_reserved: number;
          id: number;
          location_id: string;
          on_hand_after: number;
          quantity: number;
          reason: string | null;
          reference: string | null;
          reserved_after: number;
          type: string;
          variant_id: string;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          delta_on_hand: number;
          delta_reserved: number;
          id?: never;
          location_id: string;
          on_hand_after: number;
          quantity: number;
          reason?: string | null;
          reference?: string | null;
          reserved_after: number;
          type: string;
          variant_id: string;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          delta_on_hand?: number;
          delta_reserved?: number;
          id?: never;
          location_id?: string;
          on_hand_after?: number;
          quantity?: number;
          reason?: string | null;
          reference?: string | null;
          reserved_after?: number;
          type?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'inventory_movements_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'stock_locations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inventory_movements_variant_id_fkey';
            columns: ['variant_id'];
            isOneToOne: false;
            referencedRelation: 'product_variants';
            referencedColumns: ['id'];
          },
        ];
      };
      message_emails: {
        Row: {
          attempts: number;
          created_at: string;
          last_error: string | null;
          locked_until: string | null;
          message_id: number;
          provider_id: string | null;
          sent_at: string | null;
          status: string;
        };
        Insert: {
          attempts?: number;
          created_at?: string;
          last_error?: string | null;
          locked_until?: string | null;
          message_id: number;
          provider_id?: string | null;
          sent_at?: string | null;
          status?: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          last_error?: string | null;
          locked_until?: string | null;
          message_id?: number;
          provider_id?: string | null;
          sent_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'message_emails_message_id_fkey';
            columns: ['message_id'];
            isOneToOne: true;
            referencedRelation: 'conversation_messages';
            referencedColumns: ['id'];
          },
        ];
      };
      message_templates: {
        Row: {
          active: boolean;
          body: string;
          created_at: string;
          id: string;
          locale: string;
          revision: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          body: string;
          created_at?: string;
          id?: string;
          locale: string;
          revision?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          body?: string;
          created_at?: string;
          id?: string;
          locale?: string;
          revision?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      newsletter_subscribers: {
        Row: {
          consent_version: string;
          consented_at: string;
          created_at: string;
          email: string;
          id: string;
          locale: string;
          sender_synced_at: string | null;
          source: string;
          unsubscribed_at: string | null;
          updated_at: string;
        };
        Insert: {
          consent_version: string;
          consented_at?: string;
          created_at?: string;
          email: string;
          id?: string;
          locale: string;
          sender_synced_at?: string | null;
          source?: string;
          unsubscribed_at?: string | null;
          updated_at?: string;
        };
        Update: {
          consent_version?: string;
          consented_at?: string;
          created_at?: string;
          email?: string;
          id?: string;
          locale?: string;
          sender_synced_at?: string | null;
          source?: string;
          unsubscribed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_contacts: {
        Row: {
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          country: string | null;
          created_at: string;
          email: string;
          full_name: string;
          order_id: string;
          phone: string | null;
          postal_code: string | null;
          province: string | null;
          updated_at: string;
        };
        Insert: {
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          email: string;
          full_name: string;
          order_id: string;
          phone?: string | null;
          postal_code?: string | null;
          province?: string | null;
          updated_at?: string;
        };
        Update: {
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string;
          order_id?: string;
          phone?: string | null;
          postal_code?: string | null;
          province?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_contacts_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: true;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      order_emails: {
        Row: {
          attempts: number;
          created_at: string;
          id: number;
          kind: string;
          last_error: string | null;
          locked_until: string | null;
          order_id: string;
          provider_id: string | null;
          sent_at: string | null;
          status: string;
        };
        Insert: {
          attempts?: number;
          created_at?: string;
          id?: never;
          kind: string;
          last_error?: string | null;
          locked_until?: string | null;
          order_id: string;
          provider_id?: string | null;
          sent_at?: string | null;
          status?: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          id?: never;
          kind?: string;
          last_error?: string | null;
          locked_until?: string | null;
          order_id?: string;
          provider_id?: string | null;
          sent_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_emails_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      order_events: {
        Row: {
          actor_id: string | null;
          at: string;
          detail: Json | null;
          from_status: string | null;
          id: number;
          kind: string;
          order_id: string;
          to_status: string | null;
        };
        Insert: {
          actor_id?: string | null;
          at?: string;
          detail?: Json | null;
          from_status?: string | null;
          id?: never;
          kind: string;
          order_id: string;
          to_status?: string | null;
        };
        Update: {
          actor_id?: string | null;
          at?: string;
          detail?: Json | null;
          from_status?: string | null;
          id?: never;
          kind?: string;
          order_id?: string;
          to_status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'order_events_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      order_lines: {
        Row: {
          brand_name: string;
          line_total_cents: number;
          order_id: string;
          product_name: string;
          quantity: number;
          size_ml: number | null;
          sku: string | null;
          unit_price_cents: number;
          variant_id: string;
          variant_label: string | null;
        };
        Insert: {
          brand_name: string;
          line_total_cents: number;
          order_id: string;
          product_name: string;
          quantity: number;
          size_ml?: number | null;
          sku?: string | null;
          unit_price_cents: number;
          variant_id: string;
          variant_label?: string | null;
        };
        Update: {
          brand_name?: string;
          line_total_cents?: number;
          order_id?: string;
          product_name?: string;
          quantity?: number;
          size_ml?: number | null;
          sku?: string | null;
          unit_price_cents?: number;
          variant_id?: string;
          variant_label?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'order_lines_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_lines_variant_id_fkey';
            columns: ['variant_id'];
            isOneToOne: false;
            referencedRelation: 'product_variants';
            referencedColumns: ['id'];
          },
        ];
      };
      order_payment_attempts: {
        Row: {
          amount_cents: number;
          created_at: string;
          currency: string;
          id: string;
          order_id: string;
          provider: string;
          reference: string;
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          currency?: string;
          id?: string;
          order_id: string;
          provider: string;
          reference: string;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          order_id?: string;
          provider?: string;
          reference?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_payment_attempts_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      order_payments: {
        Row: {
          amount_cents: number;
          attempt_id: string;
          currency: string;
          decision: string;
          id: number;
          order_id: string;
          outcome: string;
          provider: string;
          reason: string | null;
          received_at: string;
          transaction_id: string;
        };
        Insert: {
          amount_cents: number;
          attempt_id: string;
          currency: string;
          decision: string;
          id?: never;
          order_id: string;
          outcome: string;
          provider: string;
          reason?: string | null;
          received_at?: string;
          transaction_id: string;
        };
        Update: {
          amount_cents?: number;
          attempt_id?: string;
          currency?: string;
          decision?: string;
          id?: never;
          order_id?: string;
          outcome?: string;
          provider?: string;
          reason?: string | null;
          received_at?: string;
          transaction_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_payments_attempt_id_fkey';
            columns: ['attempt_id'];
            isOneToOne: false;
            referencedRelation: 'order_payment_attempts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_payments_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      order_refunds: {
        Row: {
          amount_cents: number;
          created_at: string;
          error: string | null;
          id: string;
          order_id: string;
          payment_id: number;
          provider: string;
          reference: string;
          request_id: string;
          requested_by: string | null;
          resolved_at: string | null;
          response_code: string | null;
          status: string;
          to_status: string | null;
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          error?: string | null;
          id?: string;
          order_id: string;
          payment_id: number;
          provider: string;
          reference: string;
          request_id: string;
          requested_by?: string | null;
          resolved_at?: string | null;
          response_code?: string | null;
          status?: string;
          to_status?: string | null;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          error?: string | null;
          id?: string;
          order_id?: string;
          payment_id?: number;
          provider?: string;
          reference?: string;
          request_id?: string;
          requested_by?: string | null;
          resolved_at?: string | null;
          response_code?: string | null;
          status?: string;
          to_status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'order_refunds_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_refunds_payment_id_fkey';
            columns: ['payment_id'];
            isOneToOne: false;
            referencedRelation: 'order_payments';
            referencedColumns: ['id'];
          },
        ];
      };
      orders: {
        Row: {
          channel: string;
          created_at: string;
          currency: string;
          fulfillment: string;
          id: string;
          items_cents: number;
          locale: string;
          location_id: string;
          number: number;
          paid_at: string | null;
          received_transaction_id: string | null;
          request_id: string;
          reservation: string;
          reserved_until: string;
          revision: number;
          shipping_cents: number;
          status: string;
          total_cents: number;
          tracking_reference: string | null;
          updated_at: string;
        };
        Insert: {
          channel?: string;
          created_at?: string;
          currency?: string;
          fulfillment: string;
          id?: string;
          items_cents: number;
          locale: string;
          location_id: string;
          number?: never;
          paid_at?: string | null;
          received_transaction_id?: string | null;
          request_id: string;
          reservation?: string;
          reserved_until: string;
          revision?: number;
          shipping_cents?: number;
          status?: string;
          total_cents: number;
          tracking_reference?: string | null;
          updated_at?: string;
        };
        Update: {
          channel?: string;
          created_at?: string;
          currency?: string;
          fulfillment?: string;
          id?: string;
          items_cents?: number;
          locale?: string;
          location_id?: string;
          number?: never;
          paid_at?: string | null;
          received_transaction_id?: string | null;
          request_id?: string;
          reservation?: string;
          reserved_until?: string;
          revision?: number;
          shipping_cents?: number;
          status?: string;
          total_cents?: number;
          tracking_reference?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'stock_locations';
            referencedColumns: ['id'];
          },
        ];
      };
      permissions: {
        Row: {
          code: string;
          requires_aal2: boolean;
        };
        Insert: {
          code: string;
          requires_aal2: boolean;
        };
        Update: {
          code?: string;
          requires_aal2?: boolean;
        };
        Relationships: [];
      };
      product_media: {
        Row: {
          alt: string | null;
          created_at: string;
          id: string;
          origin: string;
          position: number;
          product_id: string;
          provisional: boolean;
          role: string;
          source: string | null;
          url: string;
        };
        Insert: {
          alt?: string | null;
          created_at?: string;
          id?: string;
          origin: string;
          position?: number;
          product_id: string;
          provisional?: boolean;
          role?: string;
          source?: string | null;
          url: string;
        };
        Update: {
          alt?: string | null;
          created_at?: string;
          id?: string;
          origin?: string;
          position?: number;
          product_id?: string;
          provisional?: boolean;
          role?: string;
          source?: string | null;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'product_media_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      product_scent_profiles: {
        Row: {
          base_notes: string[];
          families: string[];
          heart_notes: string[];
          key_notes: string[];
          product_id: string;
          seasons: string[];
          source_note: string | null;
          source_url: string;
          times_of_day: string[];
          top_notes: string[];
          updated_at: string;
        };
        Insert: {
          base_notes?: string[];
          families?: string[];
          heart_notes?: string[];
          key_notes?: string[];
          product_id: string;
          seasons?: string[];
          source_note?: string | null;
          source_url: string;
          times_of_day?: string[];
          top_notes?: string[];
          updated_at?: string;
        };
        Update: {
          base_notes?: string[];
          families?: string[];
          heart_notes?: string[];
          key_notes?: string[];
          product_id?: string;
          seasons?: string[];
          source_note?: string | null;
          source_url?: string;
          times_of_day?: string[];
          top_notes?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'product_scent_profiles_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: true;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      product_translations: {
        Row: {
          description: string | null;
          locale: string;
          product_id: string;
          tagline: string | null;
          updated_at: string;
        };
        Insert: {
          description?: string | null;
          locale: string;
          product_id: string;
          tagline?: string | null;
          updated_at?: string;
        };
        Update: {
          description?: string | null;
          locale?: string;
          product_id?: string;
          tagline?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'product_translations_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      product_variants: {
        Row: {
          active: boolean;
          compare_at_price_cents: number | null;
          created_at: string;
          ean: string | null;
          id: string;
          label: string | null;
          position: number;
          product_id: string;
          retail_price_cents: number | null;
          size_ml: number | null;
          sku: string | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          compare_at_price_cents?: number | null;
          created_at?: string;
          ean?: string | null;
          id?: string;
          label?: string | null;
          position?: number;
          product_id: string;
          retail_price_cents?: number | null;
          size_ml?: number | null;
          sku?: string | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          compare_at_price_cents?: number | null;
          created_at?: string;
          ean?: string | null;
          id?: string;
          label?: string | null;
          position?: number;
          product_id?: string;
          retail_price_cents?: number | null;
          size_ml?: number | null;
          sku?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'product_variants_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      products: {
        Row: {
          audience: string | null;
          brand_id: string;
          concentration: string | null;
          created_at: string;
          featured: boolean;
          id: string;
          name: string;
          position: number;
          published_at: string | null;
          slug: string;
          source_ref: string | null;
          status: string;
          unboxing_scene: string | null;
          updated_at: string;
        };
        Insert: {
          audience?: string | null;
          brand_id: string;
          concentration?: string | null;
          created_at?: string;
          featured?: boolean;
          id?: string;
          name: string;
          position?: number;
          published_at?: string | null;
          slug: string;
          source_ref?: string | null;
          status?: string;
          unboxing_scene?: string | null;
          updated_at?: string;
        };
        Update: {
          audience?: string | null;
          brand_id?: string;
          concentration?: string | null;
          created_at?: string;
          featured?: boolean;
          id?: string;
          name?: string;
          position?: number;
          published_at?: string | null;
          slug?: string;
          source_ref?: string | null;
          status?: string;
          unboxing_scene?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'products_brand_id_fkey';
            columns: ['brand_id'];
            isOneToOne: false;
            referencedRelation: 'brands';
            referencedColumns: ['id'];
          },
        ];
      };
      role_permissions: {
        Row: {
          permission: string;
          role: string;
        };
        Insert: {
          permission: string;
          role: string;
        };
        Update: {
          permission?: string;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'role_permissions_permission_fkey';
            columns: ['permission'];
            isOneToOne: false;
            referencedRelation: 'permissions';
            referencedColumns: ['code'];
          },
        ];
      };
      shipping_rates: {
        Row: {
          active: boolean;
          free_from_cents: number | null;
          price_cents: number;
          updated_at: string;
          updated_by: string | null;
          zone: string;
        };
        Insert: {
          active?: boolean;
          free_from_cents?: number | null;
          price_cents: number;
          updated_at?: string;
          updated_by?: string | null;
          zone: string;
        };
        Update: {
          active?: boolean;
          free_from_cents?: number | null;
          price_cents?: number;
          updated_at?: string;
          updated_by?: string | null;
          zone?: string;
        };
        Relationships: [];
      };
      staff_members: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string | null;
          display_name: string | null;
          role: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          display_name?: string | null;
          role: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          display_name?: string | null;
          role?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      stock_locations: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          id: string;
          kind: string;
          name: string;
        };
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          id?: string;
          kind: string;
          name: string;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          name?: string;
        };
        Relationships: [];
      };
      stock_watch_settings: {
        Row: {
          dead_stock_days: number;
          id: boolean;
          safety_days: number;
          sales_window_days: number;
          target_cover_days: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          dead_stock_days: number;
          id?: boolean;
          safety_days: number;
          sales_window_days: number;
          target_cover_days: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          dead_stock_days?: number;
          id?: boolean;
          safety_days?: number;
          sales_window_days?: number;
          target_cover_days?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      store_content: {
        Row: {
          kind: string;
          locale: string;
          payload: NonNullable<Json>;
          published_at: string;
          revision: number;
        };
        Insert: {
          kind: string;
          locale: string;
          payload: NonNullable<Json>;
          published_at?: string;
          revision: number;
        };
        Update: {
          kind?: string;
          locale?: string;
          payload?: NonNullable<Json>;
          published_at?: string;
          revision?: number;
        };
        Relationships: [];
      };
      store_sale_lines: {
        Row: {
          movement_id: number;
          quantity: number;
          retail_price_cents: number | null;
          sale_id: number;
          unit_price_cents: number | null;
          variant_id: string;
        };
        Insert: {
          movement_id: number;
          quantity: number;
          retail_price_cents?: number | null;
          sale_id: number;
          unit_price_cents?: number | null;
          variant_id: string;
        };
        Update: {
          movement_id?: number;
          quantity?: number;
          retail_price_cents?: number | null;
          sale_id?: number;
          unit_price_cents?: number | null;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'store_sale_lines_movement_id_fkey';
            columns: ['movement_id'];
            isOneToOne: false;
            referencedRelation: 'inventory_movements';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'store_sale_lines_sale_id_fkey';
            columns: ['sale_id'];
            isOneToOne: false;
            referencedRelation: 'store_sales';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'store_sale_lines_variant_id_fkey';
            columns: ['variant_id'];
            isOneToOne: false;
            referencedRelation: 'product_variants';
            referencedColumns: ['id'];
          },
        ];
      };
      store_sales: {
        Row: {
          actor_id: string | null;
          created_at: string;
          id: number;
          kind: string;
          location_id: string;
          request_id: string;
          ticket_ref: string | null;
          units: number;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          id?: never;
          kind: string;
          location_id: string;
          request_id: string;
          ticket_ref?: string | null;
          units: number;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          id?: never;
          kind?: string;
          location_id?: string;
          request_id?: string;
          ticket_ref?: string | null;
          units?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'store_sales_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'stock_locations';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_add_conversation_note: {
        Args: { p_body: string; p_conversation_id: string };
        Returns: number;
      };
      admin_apply_price_review: {
        Args: { p_confirmed: string[]; p_review_id: string };
        Returns: string;
      };
      admin_assign_conversation: {
        Args: {
          p_assignee: string;
          p_conversation_id: string;
          p_revision: number;
        };
        Returns: {
          assigned_to: string | null;
          channel: string;
          created_at: string;
          id: string;
          last_customer_message_at: string | null;
          last_message_at: string;
          last_staff_message_at: string | null;
          locale: string;
          number: number;
          order_id: string | null;
          request_id: string | null;
          revision: number;
          status: string;
          subject: string;
          topic: string;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'conversations';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_assign_supplier_brand: {
        Args: {
          p_brand_id?: string;
          p_preferred?: boolean;
          p_supplier_id: string;
        };
        Returns: number;
      };
      admin_cancel_invite: { Args: { p_email: string }; Returns: undefined };
      admin_control_assistant_usage: {
        Args: { p_from: string; p_to: string };
        Returns: {
          cache_read_tokens: number;
          calls: number;
          day: string;
          input_tokens: number;
          kind: string;
          model: string;
          output_tokens: number;
          person: string;
          user_id: string;
        }[];
      };
      admin_control_attention: {
        Args: { p_from: string; p_to: string };
        Returns: {
          day: string;
          hits: number;
          kind: string;
          product_id: string;
        }[];
      };
      admin_control_backups: {
        Args: { p_limit?: number };
        Returns: {
          created_at: string;
          error: string;
          id: number;
          kind: string;
          path: string;
          sha256: string;
          size_bytes: number;
          status: string;
          table_rows: Json;
        }[];
      };
      admin_control_costs: {
        Args: Record<PropertyKey, never>;
        Returns: {
          amount_net_cents: number;
          area: string;
          category: string;
          concept: string;
          ends_on: string;
          frequency: string;
          id: string;
          notes: string;
          starts_on: string;
          updated_at: string;
        }[];
      };
      admin_control_data_quality: {
        Args: Record<PropertyKey, never>;
        Returns: {
          check_key: string;
          detail: string;
          label: string;
          product_id: string;
          severity: string;
          variant_id: string;
        }[];
      };
      admin_control_delete_cost: { Args: { p_id: string }; Returns: undefined };
      admin_control_delete_delivery: {
        Args: { p_id: string };
        Returns: undefined;
      };
      admin_control_delete_task: { Args: { p_id: string }; Returns: undefined };
      admin_control_deliveries: {
        Args: Record<PropertyKey, never>;
        Returns: {
          amount_net_cents: number;
          billing_status: string;
          created_at: string;
          delivered_on: string;
          description: string;
          due_on: string;
          id: string;
          reference: string;
          status: string;
          title: string;
          updated_at: string;
        }[];
      };
      admin_control_export: {
        Args: {
          p_limit?: number;
          p_offset: number;
          p_schema: string;
          p_table: string;
        };
        Returns: Json;
      };
      admin_control_export_catalog: {
        Args: Record<PropertyKey, never>;
        Returns: {
          approx_rows: number;
          key_columns: string[];
          schema_name: string;
          table_name: string;
        }[];
      };
      admin_control_log_backup: {
        Args: {
          p_error?: string;
          p_kind: string;
          p_path: string;
          p_sha256: string;
          p_size_bytes: number;
          p_status: string;
          p_table_rows: Json;
        };
        Returns: number;
      };
      admin_control_month_facts: {
        Args: { p_from: string; p_to: string };
        Returns: {
          cogs_net_cents: number;
          month: string;
          priced_returned_units: number;
          priced_sold_units: number;
          received_net_cents: number;
          received_units: number;
          retail_price_cents: number;
          returned_gross_cents: number;
          returned_units: number;
          sold_gross_cents: number;
          sold_units: number;
          uncosted_received_units: number;
          uncosted_units: number;
          variant_id: string;
        }[];
      };
      admin_control_save_cost: {
        Args: {
          p_amount_net_cents: number;
          p_area: string;
          p_category: string;
          p_concept: string;
          p_ends_on?: string;
          p_frequency: string;
          p_id: string;
          p_notes?: string;
          p_starts_on: string;
        };
        Returns: string;
      };
      admin_control_save_delivery: {
        Args: {
          p_amount_net_cents?: number;
          p_billing_status?: string;
          p_delivered_on?: string;
          p_description?: string;
          p_due_on?: string;
          p_id: string;
          p_reference?: string;
          p_status: string;
          p_title: string;
        };
        Returns: string;
      };
      admin_control_save_task: {
        Args: {
          p_area: string;
          p_due_on?: string;
          p_id: string;
          p_notes?: string;
          p_owner: string;
          p_priority: string;
          p_status: string;
          p_title: string;
        };
        Returns: string;
      };
      admin_control_set_task_status: {
        Args: { p_id: string; p_status: string };
        Returns: undefined;
      };
      admin_control_system_status: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      admin_control_tasks: {
        Args: Record<PropertyKey, never>;
        Returns: {
          area: string;
          completed_at: string;
          created_at: string;
          due_on: string;
          id: string;
          notes: string;
          owner: string;
          priority: string;
          status: string;
          title: string;
          updated_at: string;
        }[];
      };
      admin_control_variant_events: {
        Args: { p_variant_ids: string[] };
        Returns: {
          at: string;
          compare_at_cents: number;
          cost_net_cents: number;
          kind: string;
          price_cents: number;
          variant_id: string;
        }[];
      };
      admin_control_variant_series: {
        Args: { p_from: string; p_grain?: string; p_to: string };
        Returns: {
          series: Json;
          variant_id: string;
        }[];
      };
      admin_create_purchase_order: {
        Args: {
          p_expected_on?: string;
          p_lines?: Json;
          p_location_id: string;
          p_notes?: string;
          p_supplier_id: string;
        };
        Returns: string;
      };
      admin_delete_conversation: {
        Args: { p_conversation_id: string; p_revision: number };
        Returns: undefined;
      };
      admin_delete_purchase_order: {
        Args: { p_order_id: string; p_revision: number };
        Returns: undefined;
      };
      admin_get_content: {
        Args: { p_kind: string; p_locale: string };
        Returns: Json;
      };
      admin_grant_staff: {
        Args: { p_display_name?: string; p_email: string; p_role: string };
        Returns: string;
      };
      admin_inventory_once: {
        Args: { p_input: Json; p_request_id: string };
        Returns: Json;
      };
      admin_link_conversation_order: {
        Args: {
          p_conversation_id: string;
          p_order_number: number;
          p_revision: number;
        };
        Returns: {
          assigned_to: string | null;
          channel: string;
          created_at: string;
          id: string;
          last_customer_message_at: string | null;
          last_message_at: string;
          last_staff_message_at: string | null;
          locale: string;
          number: number;
          order_id: string | null;
          request_id: string | null;
          revision: number;
          status: string;
          subject: string;
          topic: string;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'conversations';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_list_purchase_orders: {
        Args: { p_order_id?: string; p_status?: string };
        Returns: {
          closed_at: string;
          created_at: string;
          expected_on: string;
          id: string;
          line_count: number;
          location_id: string;
          location_name: string;
          notes: string;
          number: string;
          ordered_at: string;
          revision: number;
          status: string;
          supplier_id: string;
          supplier_name: string;
          supplier_reference: string;
          total_cost_net_cents: number;
          units_ordered: number;
          units_received: number;
        }[];
      };
      admin_list_staff: {
        Args: Record<PropertyKey, never>;
        Returns: {
          active: boolean;
          created_at: string;
          display_name: string;
          email: string;
          last_sign_in_at: string;
          role: string;
          user_id: string;
        }[];
      };
      admin_list_suppliers: {
        Args: Record<PropertyKey, never>;
        Returns: {
          active: boolean;
          contact_name: string;
          created_at: string;
          email: string;
          id: string;
          lead_time_days: number;
          name: string;
          notes: string;
          open_orders: number;
          phone: string;
          variant_count: number;
        }[];
      };
      admin_message_assignees: {
        Args: Record<PropertyKey, never>;
        Returns: {
          name: string;
          user_id: string;
        }[];
      };
      admin_open_purchase_orders: {
        Args: { p_location_id: string };
        Returns: {
          expected_on: string;
          number: string;
          ordered_at: string;
          status: string;
          units_ordered: number;
          units_received: number;
        }[];
      };
      admin_pending_invites: {
        Args: Record<PropertyKey, never>;
        Returns: {
          created_at: string;
          display_name: string;
          email: string;
          role: string;
        }[];
      };
      admin_prepare_invite: {
        Args: { p_display_name: string; p_email: string; p_role: string };
        Returns: undefined;
      };
      admin_publish_content: {
        Args: { p_expected: number; p_kind: string; p_locale: string };
        Returns: undefined;
      };
      admin_purchase_order_lines: {
        Args: { p_order_id: string };
        Returns: {
          line_id: number;
          line_position: number;
          pack_size: number;
          quantity_ordered: number;
          quantity_received: number;
          supplier_sku: string;
          unit_cost_net_cents: number;
          variant_id: string;
        }[];
      };
      admin_purchase_order_receipts: {
        Args: { p_order_id: string };
        Returns: {
          actor_name: string;
          at: string;
          costs_recorded: number;
          receipt_id: number;
          reference: string;
          units: number;
        }[];
      };
      admin_receive_purchase_order: {
        Args: {
          p_items: Json;
          p_order_id: string;
          p_record_costs?: boolean;
          p_reference?: string;
          p_request_id: string;
        };
        Returns: number;
      };
      admin_record_inventory_movement: {
        Args: {
          p_location_id: string;
          p_quantity: number;
          p_reason?: string;
          p_reference?: string;
          p_type: string;
          p_variant_id: string;
        };
        Returns: {
          actor_id: string | null;
          created_at: string;
          delta_on_hand: number;
          delta_reserved: number;
          id: number;
          location_id: string;
          on_hand_after: number;
          quantity: number;
          reason: string | null;
          reference: string | null;
          reserved_after: number;
          type: string;
          variant_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'inventory_movements';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_record_stocktake: {
        Args: {
          p_counted: number;
          p_location_id: string;
          p_reason?: string;
          p_variant_id: string;
        };
        Returns: {
          actor_id: string | null;
          created_at: string;
          delta_on_hand: number;
          delta_reserved: number;
          id: number;
          location_id: string;
          on_hand_after: number;
          quantity: number;
          reason: string | null;
          reference: string | null;
          reserved_after: number;
          type: string;
          variant_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'inventory_movements';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_record_store_sale: {
        Args: {
          p_items: Json;
          p_kind: string;
          p_location_id: string;
          p_request_id: string;
          p_ticket_ref?: string;
        };
        Returns: {
          actor_id: string | null;
          created_at: string;
          id: number;
          kind: string;
          location_id: string;
          request_id: string;
          ticket_ref: string | null;
          units: number;
        };
        SetofOptions: {
          from: '*';
          to: 'store_sales';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_record_variant_cost: {
        Args: {
          p_cost_net_cents: number;
          p_note?: string;
          p_variant_id: string;
        };
        Returns: string;
      };
      admin_record_variant_costs: { Args: { p_items: Json }; Returns: number };
      admin_remove_supplier_variant: {
        Args: { p_supplier_id: string; p_variant_id: string };
        Returns: undefined;
      };
      admin_reply_conversation: {
        Args: { p_body: string; p_conversation_id: string; p_revision: number };
        Returns: {
          assigned_to: string | null;
          channel: string;
          created_at: string;
          id: string;
          last_customer_message_at: string | null;
          last_message_at: string;
          last_staff_message_at: string | null;
          locale: string;
          number: number;
          order_id: string | null;
          request_id: string | null;
          revision: number;
          status: string;
          subject: string;
          topic: string;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'conversations';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_report_inventory_period: {
        Args: { p_from: string; p_location_id: string; p_to: string };
        Returns: {
          adjusted_units: number;
          closing_cost_is_later: boolean;
          closing_cost_net_cents: number;
          closing_units: number;
          last_sale_at: string;
          lost_units: number;
          opening_cost_is_later: boolean;
          opening_cost_net_cents: number;
          opening_units: number;
          received_units: number;
          returned_units: number;
          sold_units: number;
          transferred_units: number;
          variant_id: string;
        }[];
      };
      admin_report_purchases: {
        Args: { p_from: string; p_to: string };
        Returns: {
          avg_lead_time_days: number;
          declared_lead_time_days: number;
          max_lead_time_days: number;
          orders_placed: number;
          orders_with_lead: number;
          receipts: number;
          supplier_active: boolean;
          supplier_id: string;
          supplier_name: string;
          units_ordered: number;
          units_received: number;
          units_received_without_cost: number;
          value_received_net_cents: number;
        }[];
      };
      admin_request_refund: {
        Args: {
          p_amount_cents: number;
          p_order_id: string;
          p_payment_id: number;
          p_request_id: string;
          p_revision: number;
          p_to: string;
        };
        Returns: Json;
      };
      admin_restore_content: {
        Args: {
          p_expected: number;
          p_kind: string;
          p_locale: string;
          p_revision_id: number;
        };
        Returns: number;
      };
      admin_retry_refund: { Args: { p_refund_id: string }; Returns: Json };
      admin_review_price: {
        Args: {
          p_compare_at: number;
          p_cost: number;
          p_expected: string;
          p_price: number;
          p_required: string[];
          p_variant_id: string;
        };
        Returns: string;
      };
      admin_save_content: {
        Args: {
          p_expected: number;
          p_kind: string;
          p_locale: string;
          p_payload: Json;
        };
        Returns: number;
      };
      admin_save_message_template: {
        Args: {
          p_active: boolean;
          p_body: string;
          p_id: string;
          p_locale: string;
          p_revision?: number;
          p_title: string;
        };
        Returns: {
          active: boolean;
          body: string;
          created_at: string;
          id: string;
          locale: string;
          revision: number;
          title: string;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'message_templates';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_save_shipping_rate: {
        Args: {
          p_active: boolean;
          p_free_from_cents: number;
          p_price_cents: number;
          p_zone: string;
        };
        Returns: {
          active: boolean;
          free_from_cents: number | null;
          price_cents: number;
          updated_at: string;
          updated_by: string | null;
          zone: string;
        };
        SetofOptions: {
          from: '*';
          to: 'shipping_rates';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_save_supplier: {
        Args: {
          p_active?: boolean;
          p_contact_name?: string;
          p_email?: string;
          p_id: string;
          p_lead_time_days?: number;
          p_name: string;
          p_notes?: string;
          p_phone?: string;
        };
        Returns: string;
      };
      admin_save_supplier_variant: {
        Args: {
          p_lead_time_days?: number;
          p_pack_size?: number;
          p_preferred?: boolean;
          p_supplier_id: string;
          p_supplier_sku?: string;
          p_variant_id: string;
        };
        Returns: undefined;
      };
      admin_set_conversation_status: {
        Args: {
          p_conversation_id: string;
          p_revision: number;
          p_status: string;
        };
        Returns: {
          assigned_to: string | null;
          channel: string;
          created_at: string;
          id: string;
          last_customer_message_at: string | null;
          last_message_at: string;
          last_staff_message_at: string | null;
          locale: string;
          number: number;
          order_id: string | null;
          request_id: string | null;
          revision: number;
          status: string;
          subject: string;
          topic: string;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'conversations';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_set_primary_media: {
        Args: { p_media_id: string; p_product_id: string };
        Returns: undefined;
      };
      admin_set_purchase_order_lines: {
        Args: { p_lines: Json; p_order_id: string; p_revision: number };
        Returns: number;
      };
      admin_set_reorder_point: {
        Args: {
          p_location_id: string;
          p_reorder_point: number;
          p_variant_id: string;
        };
        Returns: undefined;
      };
      admin_set_staff_active: {
        Args: { p_active: boolean; p_user_id: string };
        Returns: undefined;
      };
      admin_set_stock_watch_settings: {
        Args: {
          p_dead_stock_days: number;
          p_safety_days: number;
          p_sales_window_days: number;
          p_target_cover_days: number;
        };
        Returns: undefined;
      };
      admin_stock_watch_facts: {
        Args: { p_location_id: string };
        Returns: {
          first_stocked_at: string;
          has_supplier: boolean;
          incoming_units: number;
          last_sale_at: string;
          lead_time_days: number;
          ledger_on_hand: number;
          ledger_reserved: number;
          pack_size: number;
          units_sold: number;
          variant_id: string;
        }[];
      };
      admin_supplier_terms: {
        Args: { p_supplier_id?: string; p_variant_ids?: string[] };
        Returns: {
          effective_lead_time_days: number;
          lead_time_days: number;
          pack_size: number;
          preferred: boolean;
          supplier_active: boolean;
          supplier_id: string;
          supplier_name: string;
          supplier_sku: string;
          variant_id: string;
        }[];
      };
      admin_transition_order: {
        Args: {
          p_order_id: string;
          p_revision: number;
          p_to: string;
          p_tracking_reference?: string;
        };
        Returns: {
          channel: string;
          created_at: string;
          currency: string;
          fulfillment: string;
          id: string;
          items_cents: number;
          locale: string;
          location_id: string;
          number: number;
          paid_at: string | null;
          received_transaction_id: string | null;
          request_id: string;
          reservation: string;
          reserved_until: string;
          revision: number;
          shipping_cents: number;
          status: string;
          total_cents: number;
          tracking_reference: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'orders';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_transition_purchase_order: {
        Args: { p_action: string; p_order_id: string; p_revision: number };
        Returns: string;
      };
      admin_update_purchase_order: {
        Args: {
          p_expected_on?: string;
          p_notes?: string;
          p_order_id: string;
          p_revision: number;
          p_supplier_reference?: string;
        };
        Returns: number;
      };
      admin_variant_costs: {
        Args: { p_variant_ids: string[] };
        Returns: {
          cost_net_cents: number;
          note: string;
          recorded_at: string;
          variant_id: string;
        }[];
      };
      admin_variant_price_history: {
        Args: { p_variant_id: string };
        Returns: {
          price_cents: number;
          valid_from: string;
          valid_to: string;
        }[];
      };
      control_access: { Args: Record<PropertyKey, never>; Returns: boolean };
      newsletter_subscribe: {
        Args: {
          p_consent_version: string;
          p_email: string;
          p_locale: string;
          p_source?: string;
        };
        Returns: undefined;
      };
      record_audit_event: {
        Args: {
          action: string;
          after?: Json;
          before?: Json;
          entity: string;
          entity_id?: string;
        };
        Returns: undefined;
      };
      storefront_availability: {
        Args: { p_product_ids: string[] };
        Returns: {
          status: string;
          variant_id: string;
        }[];
      };
      track_product_event: {
        Args: { p_kind: string; p_slug: string };
        Returns: boolean;
      };
      web_contact_submit: {
        Args: {
          p_body: string;
          p_email: string;
          p_full_name: string;
          p_locale: string;
          p_order_number?: number;
          p_request_id: string;
          p_subject: string;
          p_topic: string;
        };
        Returns: Json;
      };
      web_inbound_email_record: {
        Args: {
          p_attachments?: number;
          p_body: string;
          p_from_email: string;
          p_from_name: string;
          p_inbound_id: string;
          p_message_id?: string;
          p_subject: string;
          p_token: string;
          p_trusted?: boolean;
        };
        Returns: Json;
      };
      web_message_email_result: {
        Args: {
          p_error?: string;
          p_message_id: number;
          p_ok: boolean;
          p_provider_id?: string;
        };
        Returns: undefined;
      };
      web_message_emails_claim: { Args: { p_limit?: number }; Returns: Json };
      web_order_create: {
        Args: {
          p_contact: Json;
          p_fulfillment: string;
          p_hold_minutes?: number;
          p_items: Json;
          p_locale: string;
          p_location_id: string;
          p_provider: string;
          p_request_id: string;
        };
        Returns: Json;
      };
      web_order_email_result: {
        Args: {
          p_error?: string;
          p_id: number;
          p_ok: boolean;
          p_provider_id?: string;
        };
        Returns: undefined;
      };
      web_order_emails_claim: { Args: { p_limit?: number }; Returns: Json };
      web_order_new_attempt: {
        Args: { p_order_id: string; p_provider: string };
        Returns: Json;
      };
      web_order_record_payment: {
        Args: {
          p_amount_cents: number;
          p_currency: string;
          p_outcome: string;
          p_provider: string;
          p_reference: string;
          p_transaction_id: string;
        };
        Returns: Json;
      };
      web_order_refund_result: {
        Args: {
          p_error?: string;
          p_refund_id: string;
          p_response_code?: string;
          p_status: string;
        };
        Returns: Json;
      };
      web_order_release_expired: {
        Args: { p_limit?: number };
        Returns: number;
      };
      web_order_status: { Args: { p_order_id: string }; Returns: Json };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
