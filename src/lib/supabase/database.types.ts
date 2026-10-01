// Generado desde adhara-dev con el conector de Supabase (generate_typescript_types).
// No editar a mano: regenerar tras cada migración.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
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
      store_sale_lines: {
        Row: {
          movement_id: number;
          quantity: number;
          sale_id: number;
          variant_id: string;
        };
        Insert: {
          movement_id: number;
          quantity: number;
          sale_id: number;
          variant_id: string;
        };
        Update: {
          movement_id?: number;
          quantity?: number;
          sale_id?: number;
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
      admin_assign_supplier_brand: {
        Args: {
          p_brand_id?: string;
          p_preferred?: boolean;
          p_supplier_id: string;
        };
        Returns: number;
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
      admin_delete_purchase_order: {
        Args: { p_order_id: string; p_revision: number };
        Returns: undefined;
      };
      admin_grant_staff: {
        Args: { p_display_name?: string; p_email: string; p_role: string };
        Returns: string;
      };
      admin_list_purchase_orders: {
        Args: { p_order_id?: string; p_status?: string };
        Returns: {
          closed_at: string | null;
          created_at: string;
          expected_on: string | null;
          id: string;
          line_count: number;
          location_id: string;
          location_name: string;
          notes: string | null;
          number: string;
          ordered_at: string | null;
          revision: number;
          status: string;
          supplier_id: string;
          supplier_name: string;
          supplier_reference: string | null;
          total_cost_net_cents: number | null;
          units_ordered: number;
          units_received: number;
        }[];
      };
      admin_list_staff: {
        Args: never;
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
        Args: never;
        Returns: {
          active: boolean;
          contact_name: string | null;
          created_at: string;
          email: string | null;
          id: string;
          lead_time_days: number | null;
          name: string;
          notes: string | null;
          open_orders: number;
          phone: string | null;
          variant_count: number;
        }[];
      };
      admin_purchase_order_lines: {
        Args: { p_order_id: string };
        Returns: {
          line_id: number;
          line_position: number;
          pack_size: number | null;
          quantity_ordered: number;
          quantity_received: number;
          supplier_sku: string | null;
          unit_cost_net_cents: number | null;
          variant_id: string;
        }[];
      };
      admin_purchase_order_receipts: {
        Args: { p_order_id: string };
        Returns: {
          actor_name: string | null;
          at: string;
          costs_recorded: number;
          receipt_id: number;
          reference: string | null;
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
      admin_record_variant_costs: {
        Args: { p_items: Json };
        Returns: number;
      };
      admin_remove_supplier_variant: {
        Args: { p_supplier_id: string; p_variant_id: string };
        Returns: undefined;
      };
      admin_report_inventory_period: {
        Args: { p_from: string; p_location_id: string; p_to: string };
        Returns: {
          adjusted_units: number;
          closing_cost_is_later: boolean | null;
          closing_cost_net_cents: number | null;
          closing_units: number;
          last_sale_at: string | null;
          lost_units: number;
          opening_cost_is_later: boolean | null;
          opening_cost_net_cents: number | null;
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
          avg_lead_time_days: number | null;
          declared_lead_time_days: number | null;
          max_lead_time_days: number | null;
          orders_placed: number;
          orders_with_lead: number;
          receipts: number;
          supplier_active: boolean;
          supplier_id: string;
          supplier_name: string;
          units_ordered: number;
          units_received: number;
          units_received_without_cost: number | null;
          value_received_net_cents: number | null;
        }[];
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
          first_stocked_at: string | null;
          has_supplier: boolean;
          incoming_units: number;
          last_sale_at: string | null;
          lead_time_days: number | null;
          ledger_on_hand: number;
          ledger_reserved: number;
          pack_size: number | null;
          units_sold: number;
          variant_id: string;
        }[];
      };
      admin_supplier_terms: {
        Args: { p_supplier_id?: string; p_variant_ids?: string[] };
        Returns: {
          effective_lead_time_days: number | null;
          lead_time_days: number | null;
          pack_size: number;
          preferred: boolean;
          supplier_active: boolean;
          supplier_id: string;
          supplier_name: string;
          supplier_sku: string | null;
          variant_id: string;
        }[];
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
          note: string | null;
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
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
