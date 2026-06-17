export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      stylist_workspaces: {
        Row: {
          id: string;
          user_id: string | null;
          platform_workspace_id: string | null;
          name: string;
          display_name: string | null;
          visitor_token: string;
          onboarding_complete: boolean;
          is_default: boolean;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          platform_workspace_id?: string | null;
          name?: string;
          display_name?: string | null;
          visitor_token: string;
          onboarding_complete?: boolean;
          is_default?: boolean;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stylist_workspaces"]["Insert"]>;
        Relationships: [];
      };
      stylist_wardrobes: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string | null;
          name: string;
          slug: string;
          is_default: boolean;
          item_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id?: string | null;
          name?: string;
          slug?: string;
          is_default?: boolean;
          item_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stylist_wardrobes"]["Insert"]>;
        Relationships: [];
      };
      stylist_uploaded_images: {
        Row: {
          id: string;
          user_id: string | null;
          workspace_id: string;
          storage_path: string;
          thumb_path: string | null;
          mime_type: string;
          byte_size: number | null;
          width: number | null;
          height: number | null;
          content_hash: string | null;
          status: string;
          source: string;
          vision: Json;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          workspace_id: string;
          storage_path: string;
          thumb_path?: string | null;
          mime_type?: string;
          byte_size?: number | null;
          width?: number | null;
          height?: number | null;
          content_hash?: string | null;
          status?: string;
          source?: string;
          vision?: Json;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["stylist_uploaded_images"]["Insert"]>;
        Relationships: [];
      };
      stylist_wardrobe_items: {
        Row: {
          id: string;
          workspace_id: string;
          wardrobe_id: string | null;
          user_id: string | null;
          image_id: string | null;
          storage_path: string;
          thumb_path: string | null;
          category: string | null;
          colors: string[] | null;
          description: string;
          formality: string | null;
          status: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          wardrobe_id?: string | null;
          user_id?: string | null;
          image_id?: string | null;
          storage_path: string;
          thumb_path?: string | null;
          category?: string | null;
          colors?: string[] | null;
          description?: string;
          formality?: string | null;
          status?: string;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stylist_wardrobe_items"]["Insert"]>;
        Relationships: [];
      };
      stylist_conversations: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string | null;
          title: string | null;
          status: string;
          last_message_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id?: string | null;
          title?: string | null;
          status?: string;
          last_message_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stylist_conversations"]["Insert"]>;
        Relationships: [];
      };
      stylist_messages: {
        Row: {
          id: string;
          conversation_id: string;
          workspace_id: string | null;
          role: string;
          content: string;
          metadata: Json;
          token_count: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          workspace_id?: string | null;
          role: string;
          content?: string;
          metadata?: Json;
          token_count?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stylist_messages"]["Insert"]>;
        Relationships: [];
      };
      stylist_outfit_generations: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string | null;
          conversation_id: string | null;
          message_id: string | null;
          wardrobe_id: string | null;
          user_prompt: string | null;
          intent: string | null;
          prompt_context: Json;
          stylist_pick_id: string | null;
          status: string;
          model_config: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id?: string | null;
          conversation_id?: string | null;
          message_id?: string | null;
          wardrobe_id?: string | null;
          user_prompt?: string | null;
          intent?: string | null;
          prompt_context?: Json;
          stylist_pick_id?: string | null;
          status?: string;
          model_config?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stylist_outfit_generations"]["Insert"]>;
        Relationships: [];
      };
      stylist_outfit_looks: {
        Row: {
          id: string;
          generation_id: string;
          image_id: string | null;
          storage_path: string;
          wardrobe_item_ids: string[] | null;
          rationale: string;
          vibe: string | null;
          occasion_tag: string | null;
          is_stylist_pick: boolean;
          feedback: string | null;
          worn_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          generation_id: string;
          image_id?: string | null;
          storage_path: string;
          wardrobe_item_ids?: string[] | null;
          rationale?: string;
          vibe?: string | null;
          occasion_tag?: string | null;
          is_stylist_pick?: boolean;
          feedback?: string | null;
          worn_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stylist_outfit_looks"]["Insert"]>;
        Relationships: [];
      };
      stylist_outfit_look_items: {
        Row: {
          look_id: string;
          wardrobe_item_id: string;
          sort_order: number;
        };
        Insert: {
          look_id: string;
          wardrobe_item_id: string;
          sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["stylist_outfit_look_items"]["Insert"]>;
        Relationships: [];
      };
      stylist_memory_summaries: {
        Row: {
          id: string;
          workspace_id: string;
          section: string;
          content: Json;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          section: string;
          content?: Json;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stylist_memory_summaries"]["Insert"]>;
        Relationships: [];
      };
      stylist_preference_signals: {
        Row: {
          id: string;
          workspace_id: string;
          signal_type: string;
          payload: Json;
          source_look_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          signal_type: string;
          payload?: Json;
          source_look_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stylist_preference_signals"]["Insert"]>;
        Relationships: [];
      };
      stylist_mem0_sync: {
        Row: {
          workspace_id: string;
          mem0_user_id: string;
          mem0_agent_id: string | null;
          last_synced_at: string | null;
          sync_status: string;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          workspace_id: string;
          mem0_user_id: string;
          mem0_agent_id?: string | null;
          last_synced_at?: string | null;
          sync_status?: string;
          error_message?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stylist_mem0_sync"]["Insert"]>;
        Relationships: [];
      };
      stylist_mem0_memory_refs: {
        Row: {
          id: string;
          workspace_id: string;
          mem0_memory_id: string;
          category: string | null;
          content_preview: string | null;
          source_type: string | null;
          source_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          mem0_memory_id: string;
          category?: string | null;
          content_preview?: string | null;
          source_type?: string | null;
          source_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stylist_mem0_memory_refs"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Workspace = Database["public"]["Tables"]["stylist_workspaces"]["Row"];
export type Wardrobe = Database["public"]["Tables"]["stylist_wardrobes"]["Row"];
export type UploadedImage = Database["public"]["Tables"]["stylist_uploaded_images"]["Row"];
export type WardrobeItem = Database["public"]["Tables"]["stylist_wardrobe_items"]["Row"];
export type OutfitLook = Database["public"]["Tables"]["stylist_outfit_looks"]["Row"];

export type ChatMessageMetadata = {
  type?: "text" | "outfit_generation" | "wardrobe_photos" | "memory_ref";
  generationId?: string;
  lookIds?: string[];
  wardrobeItemIds?: string[];
  wardrobeId?: string;
  intent?: string;
};

export type OutfitLookWithUrl = OutfitLook & {
  imageUrl: string;
  items?: (WardrobeItem & { imageUrl?: string })[];
};

export type MemoryCard = {
  section: "about" | "words" | "works" | "avoid";
  label: string;
  bullets: string[];
};
