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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_actions_log: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          details: Json | null
          id: string
          target_establishment_id: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_establishment_id?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_establishment_id?: string | null
        }
        Relationships: []
      }
      appointment_blocks: {
        Row: {
          created_at: string
          end_time: string
          establishment_id: string
          id: string
          professional_id: string
          reason: string | null
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time: string
          establishment_id: string
          id?: string
          professional_id: string
          reason?: string | null
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time?: string
          establishment_id?: string
          id?: string
          professional_id?: string
          reason?: string | null
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_blocks_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_blocks_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_professionals: {
        Row: {
          appointment_id: string
          created_at: string
          establishment_id: string
          id: string
          professional_id: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          establishment_id: string
          id?: string
          professional_id: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          establishment_id?: string
          id?: string
          professional_id?: string
        }
        Relationships: []
      }
      appointment_services: {
        Row: {
          appointment_id: string
          created_at: string
          establishment_id: string
          id: string
          service_id: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          establishment_id: string
          id?: string
          service_id: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          establishment_id?: string
          id?: string
          service_id?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          appointment_date: string
          client_id: string
          created_at: string
          duration_minutes: number | null
          establishment_id: string
          id: string
          notes: string | null
          professional_id: string | null
          service_amount: number | null
          service_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          appointment_date: string
          client_id: string
          created_at?: string
          duration_minutes?: number | null
          establishment_id: string
          id?: string
          notes?: string | null
          professional_id?: string | null
          service_amount?: number | null
          service_id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          client_id?: string
          created_at?: string
          duration_minutes?: number | null
          establishment_id?: string
          id?: string
          notes?: string | null
          professional_id?: string | null
          service_amount?: number | null
          service_id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_webhook_logs: {
        Row: {
          asaas_payment_id: string | null
          asaas_subscription_id: string | null
          created_at: string
          error: string | null
          event: string | null
          id: string
          payload: Json
          processed: boolean
        }
        Insert: {
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          created_at?: string
          error?: string | null
          event?: string | null
          id?: string
          payload: Json
          processed?: boolean
        }
        Update: {
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          created_at?: string
          error?: string | null
          event?: string | null
          id?: string
          payload?: Json
          processed?: boolean
        }
        Relationships: []
      }
      card_machine_fees: {
        Row: {
          card_machine_id: string
          created_at: string
          establishment_id: string
          fee_percentage: number
          id: string
          installments: number | null
          payment_type: string
          updated_at: string
        }
        Insert: {
          card_machine_id: string
          created_at?: string
          establishment_id: string
          fee_percentage?: number
          id?: string
          installments?: number | null
          payment_type: string
          updated_at?: string
        }
        Update: {
          card_machine_id?: string
          created_at?: string
          establishment_id?: string
          fee_percentage?: number
          id?: string
          installments?: number | null
          payment_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_machine_fees_card_machine_id_fkey"
            columns: ["card_machine_id"]
            isOneToOne: false
            referencedRelation: "card_machines"
            referencedColumns: ["id"]
          },
        ]
      }
      card_machines: {
        Row: {
          active: boolean
          created_at: string
          establishment_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          establishment_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          establishment_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      cash_flow_entries: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string
          entry_date: string
          entry_type: string
          establishment_id: string
          id: string
          notes: string | null
          payment_method: string | null
          source: string
          source_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          description: string
          entry_date?: string
          entry_type: string
          establishment_id: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          source?: string
          source_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string
          entry_date?: string
          entry_type?: string
          establishment_id?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          source?: string
          source_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          acquisition_source: string | null
          balance: number
          birth_date: string | null
          birth_day: number | null
          birth_month: number | null
          created_at: string
          email: string | null
          establishment_id: string
          gender: string | null
          id: string
          import_source: string | null
          imported_at: string | null
          instagram: string | null
          last_service_date: string | null
          name: string
          nickname: string | null
          notes: string | null
          phone: string
          total_spent: number | null
          updated_at: string
          visit_count: number | null
        }
        Insert: {
          acquisition_source?: string | null
          balance?: number
          birth_date?: string | null
          birth_day?: number | null
          birth_month?: number | null
          created_at?: string
          email?: string | null
          establishment_id: string
          gender?: string | null
          id?: string
          import_source?: string | null
          imported_at?: string | null
          instagram?: string | null
          last_service_date?: string | null
          name: string
          nickname?: string | null
          notes?: string | null
          phone: string
          total_spent?: number | null
          updated_at?: string
          visit_count?: number | null
        }
        Update: {
          acquisition_source?: string | null
          balance?: number
          birth_date?: string | null
          birth_day?: number | null
          birth_month?: number | null
          created_at?: string
          email?: string | null
          establishment_id?: string
          gender?: string | null
          id?: string
          import_source?: string | null
          imported_at?: string | null
          instagram?: string | null
          last_service_date?: string | null
          name?: string
          nickname?: string | null
          notes?: string | null
          phone?: string
          total_spent?: number | null
          updated_at?: string
          visit_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comanda_items: {
        Row: {
          comanda_id: string
          commission_amount: number
          commission_percentage: number
          created_at: string
          establishment_id: string
          id: string
          kind: string
          name: string
          professional_id: string | null
          qty: number
          service_id: string | null
          total: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          comanda_id: string
          commission_amount?: number
          commission_percentage?: number
          created_at?: string
          establishment_id: string
          id?: string
          kind?: string
          name: string
          professional_id?: string | null
          qty?: number
          service_id?: string | null
          total?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          comanda_id?: string
          commission_amount?: number
          commission_percentage?: number
          created_at?: string
          establishment_id?: string
          id?: string
          kind?: string
          name?: string
          professional_id?: string | null
          qty?: number
          service_id?: string | null
          total?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comanda_items_comanda_id_fkey"
            columns: ["comanda_id"]
            isOneToOne: false
            referencedRelation: "comandas"
            referencedColumns: ["id"]
          },
        ]
      }
      comandas: {
        Row: {
          appointment_id: string | null
          client_id: string
          closed_at: string | null
          created_at: string
          discount: number
          establishment_id: string
          id: string
          notes: string | null
          opened_at: string
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          client_id: string
          closed_at?: string | null
          created_at?: string
          discount?: number
          establishment_id: string
          id?: string
          notes?: string | null
          opened_at?: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          client_id?: string
          closed_at?: string | null
          created_at?: string
          discount?: number
          establishment_id?: string
          id?: string
          notes?: string | null
          opened_at?: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      establishment_users: {
        Row: {
          active: boolean
          created_at: string
          establishment_id: string
          id: string
          professional_id: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          establishment_id: string
          id?: string
          professional_id?: string | null
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          establishment_id?: string
          id?: string
          professional_id?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string
          establishment_id: string
          expense_date: string
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          description: string
          establishment_id: string
          expense_date?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string
          establishment_id?: string
          expense_date?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          created_at: string
          current_amount: number | null
          establishment_id: string
          id: string
          month: number
          target_amount: number
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          current_amount?: number | null
          establishment_id: string
          id?: string
          month: number
          target_amount: number
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          current_amount?: number | null
          establishment_id?: string
          id?: string
          month?: number
          target_amount?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "goals_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          active: boolean
          commission_percentage: number
          commission_type: string
          created_at: string
          custom_percentage: number
          daily_amount: number
          establishment_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          commission_percentage?: number
          commission_type?: string
          created_at?: string
          custom_percentage?: number
          daily_amount?: number
          establishment_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          commission_percentage?: number
          commission_type?: string
          created_at?: string
          custom_percentage?: number
          daily_amount?: number
          establishment_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professionals_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accepting_bookings: boolean
          business_name: string
          business_type: string
          cep: string
          city: string
          created_at: string
          document: string
          email: string
          id: string
          last_access_at: string | null
          neighborhood: string
          owner_name: string
          phone: string
          plan: string | null
          slug: string | null
          status: string | null
          street: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepting_bookings?: boolean
          business_name: string
          business_type: string
          cep: string
          city: string
          created_at?: string
          document: string
          email: string
          id?: string
          last_access_at?: string | null
          neighborhood: string
          owner_name: string
          phone: string
          plan?: string | null
          slug?: string | null
          status?: string | null
          street: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepting_bookings?: boolean
          business_name?: string
          business_type?: string
          cep?: string
          city?: string
          created_at?: string
          document?: string
          email?: string
          id?: string
          last_access_at?: string | null
          neighborhood?: string
          owner_name?: string
          phone?: string
          plan?: string | null
          slug?: string | null
          status?: string | null
          street?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sale_professionals: {
        Row: {
          commission_amount: number
          commission_percentage: number
          created_at: string
          establishment_id: string
          id: string
          professional_id: string
          role: string
          sale_id: string
        }
        Insert: {
          commission_amount?: number
          commission_percentage?: number
          created_at?: string
          establishment_id: string
          id?: string
          professional_id: string
          role?: string
          sale_id: string
        }
        Update: {
          commission_amount?: number
          commission_percentage?: number
          created_at?: string
          establishment_id?: string
          id?: string
          professional_id?: string
          role?: string
          sale_id?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          amount: number
          appointment_id: string | null
          card_machine_id: string | null
          client_id: string
          created_at: string
          establishment_id: string
          fee_amount: number
          gross_amount: number | null
          id: string
          installments: number | null
          net_amount: number | null
          notes: string | null
          payment_method: string | null
          professional_id: string | null
          sale_date: string
          service_id: string
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          card_machine_id?: string | null
          client_id: string
          created_at?: string
          establishment_id: string
          fee_amount?: number
          gross_amount?: number | null
          id?: string
          installments?: number | null
          net_amount?: number | null
          notes?: string | null
          payment_method?: string | null
          professional_id?: string | null
          sale_date?: string
          service_id: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          card_machine_id?: string | null
          client_id?: string
          created_at?: string
          establishment_id?: string
          fee_amount?: number
          gross_amount?: number | null
          id?: string
          installments?: number | null
          net_amount?: number | null
          notes?: string | null
          payment_method?: string | null
          professional_id?: string | null
          sale_date?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_professionals: {
        Row: {
          created_at: string
          establishment_id: string
          id: string
          professional_id: string
          service_id: string
        }
        Insert: {
          created_at?: string
          establishment_id: string
          id?: string
          professional_id: string
          service_id: string
        }
        Update: {
          created_at?: string
          establishment_id?: string
          id?: string
          professional_id?: string
          service_id?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean | null
          commission_as_assistant: number
          commission_solo: number
          commission_with_assistants: number
          cost_price: number
          created_at: string
          description: string | null
          duration_minutes: number | null
          establishment_id: string
          id: string
          kind: string
          name: string
          price: number
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          commission_as_assistant?: number
          commission_solo?: number
          commission_with_assistants?: number
          cost_price?: number
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          establishment_id: string
          id?: string
          kind?: string
          name: string
          price: number
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          commission_as_assistant?: number
          commission_solo?: number
          commission_with_assistants?: number
          cost_price?: number
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          establishment_id?: string
          id?: string
          kind?: string
          name?: string
          price?: number
          stock_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          business_close_time: string
          business_open_time: string
          created_at: string
          establishment_id: string
          id: string
          inactive_days_threshold: number | null
          updated_at: string
          working_days: number[]
        }
        Insert: {
          business_close_time?: string
          business_open_time?: string
          created_at?: string
          establishment_id: string
          id?: string
          inactive_days_threshold?: number | null
          updated_at?: string
          working_days?: number[]
        }
        Update: {
          business_close_time?: string
          business_open_time?: string
          created_at?: string
          establishment_id?: string
          id?: string
          inactive_days_threshold?: number | null
          updated_at?: string
          working_days?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "settings_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          asaas_payment_id: string | null
          asaas_subscription_id: string | null
          bank_slip_url: string | null
          billing_type: string | null
          created_at: string
          due_date: string | null
          establishment_id: string
          id: string
          invoice_url: string | null
          net_value: number | null
          payment_date: string | null
          pix_qr_code: string | null
          raw: Json | null
          status: string
          subscription_id: string | null
          updated_at: string
          value: number
        }
        Insert: {
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          bank_slip_url?: string | null
          billing_type?: string | null
          created_at?: string
          due_date?: string | null
          establishment_id: string
          id?: string
          invoice_url?: string | null
          net_value?: number | null
          payment_date?: string | null
          pix_qr_code?: string | null
          raw?: Json | null
          status: string
          subscription_id?: string | null
          updated_at?: string
          value?: number
        }
        Update: {
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          bank_slip_url?: string | null
          billing_type?: string | null
          created_at?: string
          due_date?: string | null
          establishment_id?: string
          id?: string
          invoice_url?: string | null
          net_value?: number | null
          payment_date?: string | null
          pix_qr_code?: string | null
          raw?: Json | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          active: boolean
          created_at: string
          display_order: number
          features: Json
          id: string
          max_clients: number | null
          max_users: number | null
          monthly_price: number
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_order?: number
          features?: Json
          id?: string
          max_clients?: number | null
          max_users?: number | null
          monthly_price?: number
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_order?: number
          features?: Json
          id?: string
          max_clients?: number | null
          max_users?: number | null
          monthly_price?: number
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          billing_cpf_cnpj: string | null
          billing_email: string | null
          billing_name: string | null
          billing_type: string | null
          canceled_at: string | null
          created_at: string
          establishment_id: string
          id: string
          last_payment_at: string | null
          monthly_amount: number
          next_billing_at: string | null
          payment_link: string | null
          pending_plan_effective_at: string | null
          pending_plan_id: string | null
          plan_id: string | null
          started_at: string
          status: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          billing_cpf_cnpj?: string | null
          billing_email?: string | null
          billing_name?: string | null
          billing_type?: string | null
          canceled_at?: string | null
          created_at?: string
          establishment_id: string
          id?: string
          last_payment_at?: string | null
          monthly_amount?: number
          next_billing_at?: string | null
          payment_link?: string | null
          pending_plan_effective_at?: string | null
          pending_plan_id?: string | null
          plan_id?: string | null
          started_at?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          billing_cpf_cnpj?: string | null
          billing_email?: string | null
          billing_name?: string | null
          billing_type?: string | null
          canceled_at?: string | null
          created_at?: string
          establishment_id?: string
          id?: string
          last_payment_at?: string | null
          monthly_amount?: number
          next_billing_at?: string | null
          payment_link?: string | null
          pending_plan_effective_at?: string | null
          pending_plan_id?: string | null
          plan_id?: string | null
          started_at?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_pending_plan_id_fkey"
            columns: ["pending_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_public_booking: {
        Args: {
          client_name: string
          establishment: string
          notes?: string
          p_phone: string
          p_professionals: string[]
          p_services: string[]
          start_time: string
        }
        Returns: string
      }
      get_my_subscription: { Args: never; Returns: Json }
      get_public_availability: {
        Args: { day: string; establishment: string; professional: string }
        Returns: Json
      }
      get_public_catalog: { Args: { establishment: string }; Returns: Json }
      get_public_salon_by_id: { Args: { p_id: string }; Returns: Json }
      get_public_salon_by_slug: { Args: { p_slug: string }; Returns: Json }
      get_public_service_professionals: {
        Args: { establishment: string; service: string }
        Returns: Json
      }
      get_subscription_state: {
        Args: { _establishment_id: string }
        Returns: string
      }
      has_active_subscription: {
        Args: { _establishment_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_establishment_member: {
        Args: { _establishment_id: string; _user_id: string }
        Returns: boolean
      }
      slugify: { Args: { input: string }; Returns: string }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "establishment" | "super_admin"
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
      app_role: ["admin", "establishment", "super_admin"],
    },
  },
} as const
