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
          benefit_credit_id: string | null
          benefit_type: string | null
          created_at: string
          establishment_id: string
          id: string
          price_source: string
          service_id: string
          unit_price: number
        }
        Insert: {
          appointment_id: string
          benefit_credit_id?: string | null
          benefit_type?: string | null
          created_at?: string
          establishment_id: string
          id?: string
          price_source?: string
          service_id: string
          unit_price?: number
        }
        Update: {
          appointment_id?: string
          benefit_credit_id?: string | null
          benefit_type?: string | null
          created_at?: string
          establishment_id?: string
          id?: string
          price_source?: string
          service_id?: string
          unit_price?: number
        }
        Relationships: []
      }
      appointments: {
        Row: {
          appointment_date: string
          client_id: string
          created_at: string
          deposit_amount: number
          deposit_payment_method: string | null
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
          deposit_amount?: number
          deposit_payment_method?: string | null
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
          deposit_amount?: number
          deposit_payment_method?: string | null
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
      asaas_sync_logs: {
        Row: {
          asaas_customer_id: string | null
          asaas_payment_id: string | null
          asaas_subscription_id: string | null
          changed: boolean
          created_at: string
          details: Json
          duration_ms: number
          error: string | null
          establishment_id: string | null
          id: string
          new_status: string | null
          payment_status: string | null
          plan_id: string | null
          previous_status: string | null
          source: string
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          changed?: boolean
          created_at?: string
          details?: Json
          duration_ms?: number
          error?: string | null
          establishment_id?: string | null
          id?: string
          new_status?: string | null
          payment_status?: string | null
          plan_id?: string | null
          previous_status?: string | null
          source: string
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          changed?: boolean
          created_at?: string
          details?: Json
          duration_ms?: number
          error?: string | null
          establishment_id?: string | null
          id?: string
          new_status?: string | null
          payment_status?: string | null
          plan_id?: string | null
          previous_status?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "asaas_sync_logs_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_sync_logs_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
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
          deleted_at: string | null
          description: string
          entry_date: string
          entry_type: string
          establishment_id: string
          id: string
          notes: string | null
          occurrence_date: string | null
          payment_method: string | null
          recurring_plan_id: string | null
          source: string
          source_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          deleted_at?: string | null
          description: string
          entry_date?: string
          entry_type: string
          establishment_id: string
          id?: string
          notes?: string | null
          occurrence_date?: string | null
          payment_method?: string | null
          recurring_plan_id?: string | null
          source?: string
          source_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string
          entry_date?: string
          entry_type?: string
          establishment_id?: string
          id?: string
          notes?: string | null
          occurrence_date?: string | null
          payment_method?: string | null
          recurring_plan_id?: string | null
          source?: string
          source_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_flow_entries_recurring_plan_id_fkey"
            columns: ["recurring_plan_id"]
            isOneToOne: false
            referencedRelation: "financial_recurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      client_benefit_uses: {
        Row: {
          appointment_id: string | null
          benefit_id: string
          client_id: string
          created_at: string
          establishment_id: string
          id: string
          item_name: string
          service_id: string | null
          updated_at: string
          used_at: string
        }
        Insert: {
          appointment_id?: string | null
          benefit_id: string
          client_id: string
          created_at?: string
          establishment_id: string
          id?: string
          item_name: string
          service_id?: string | null
          updated_at?: string
          used_at?: string
        }
        Update: {
          appointment_id?: string | null
          benefit_id?: string
          client_id?: string
          created_at?: string
          establishment_id?: string
          id?: string
          item_name?: string
          service_id?: string | null
          updated_at?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_benefit_uses_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_benefit_uses_benefit_id_fkey"
            columns: ["benefit_id"]
            isOneToOne: false
            referencedRelation: "client_benefits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_benefit_uses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_benefit_uses_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_benefit_uses_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      client_benefits: {
        Row: {
          billing_period: string | null
          client_id: string
          created_at: string
          ended_at: string | null
          establishment_id: string
          expires_at: string | null
          id: string
          items: Json
          kind: string
          name: string
          next_billing_at: string | null
          price: number
          purchased_at: string
          status: string
          updated_at: string
        }
        Insert: {
          billing_period?: string | null
          client_id: string
          created_at?: string
          ended_at?: string | null
          establishment_id: string
          expires_at?: string | null
          id?: string
          items?: Json
          kind: string
          name: string
          next_billing_at?: string | null
          price?: number
          purchased_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          billing_period?: string | null
          client_id?: string
          created_at?: string
          ended_at?: string | null
          establishment_id?: string
          expires_at?: string | null
          id?: string
          items?: Json
          kind?: string
          name?: string
          next_billing_at?: string | null
          price?: number
          purchased_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_benefits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_benefits_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_credit_transactions: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          created_by: string | null
          description: string | null
          establishment_id: string
          id: string
          origin: string
          payment_method: string | null
          source: string | null
          source_id: string | null
          type: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          establishment_id: string
          id?: string
          origin?: string
          payment_method?: string | null
          source?: string | null
          source_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          establishment_id?: string
          id?: string
          origin?: string
          payment_method?: string | null
          source?: string | null
          source_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_credit_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_credit_transactions_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          acquisition_source: string | null
          address: string | null
          balance: number
          birth_date: string | null
          birth_day: number | null
          birth_month: number | null
          cpf: string | null
          created_at: string
          credit_balance: number
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
          phone: string | null
          total_spent: number | null
          updated_at: string
          visit_count: number | null
          whatsapp: string | null
        }
        Insert: {
          acquisition_source?: string | null
          address?: string | null
          balance?: number
          birth_date?: string | null
          birth_day?: number | null
          birth_month?: number | null
          cpf?: string | null
          created_at?: string
          credit_balance?: number
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
          phone?: string | null
          total_spent?: number | null
          updated_at?: string
          visit_count?: number | null
          whatsapp?: string | null
        }
        Update: {
          acquisition_source?: string | null
          address?: string | null
          balance?: number
          birth_date?: string | null
          birth_day?: number | null
          birth_month?: number | null
          cpf?: string | null
          created_at?: string
          credit_balance?: number
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
          phone?: string | null
          total_spent?: number | null
          updated_at?: string
          visit_count?: number | null
          whatsapp?: string | null
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
          benefit_consumption_id: string | null
          comanda_id: string
          commission_amount: number
          commission_percentage: number
          created_at: string
          establishment_id: string
          id: string
          kind: string
          name: string
          payment_source: string
          professional_id: string | null
          qty: number
          reference_unit_price: number | null
          service_id: string | null
          total: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          benefit_consumption_id?: string | null
          comanda_id: string
          commission_amount?: number
          commission_percentage?: number
          created_at?: string
          establishment_id: string
          id?: string
          kind?: string
          name: string
          payment_source?: string
          professional_id?: string | null
          qty?: number
          reference_unit_price?: number | null
          service_id?: string | null
          total?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          benefit_consumption_id?: string | null
          comanda_id?: string
          commission_amount?: number
          commission_percentage?: number
          created_at?: string
          establishment_id?: string
          id?: string
          kind?: string
          name?: string
          payment_source?: string
          professional_id?: string | null
          qty?: number
          reference_unit_price?: number | null
          service_id?: string | null
          total?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comanda_items_benefit_consumption_id_fkey"
            columns: ["benefit_consumption_id"]
            isOneToOne: false
            referencedRelation: "service_benefit_consumptions"
            referencedColumns: ["id"]
          },
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
      customer_package_credits: {
        Row: {
          contracted: number
          customer_package_id: string
          establishment_id: string
          id: string
          service_id: string
          used: number
        }
        Insert: {
          contracted: number
          customer_package_id: string
          establishment_id: string
          id?: string
          service_id: string
          used?: number
        }
        Update: {
          contracted?: number
          customer_package_id?: string
          establishment_id?: string
          id?: string
          service_id?: string
          used?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_package_credits_customer_package_id_fkey"
            columns: ["customer_package_id"]
            isOneToOne: false
            referencedRelation: "customer_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_package_credits_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_package_credits_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_packages: {
        Row: {
          amount_paid: number
          client_id: string
          created_at: string
          created_by: string | null
          establishment_id: string
          expires_at: string
          id: string
          package_id: string
          purchased_at: string
          sale_id: string | null
          starts_at: string
          status: string
        }
        Insert: {
          amount_paid: number
          client_id: string
          created_at?: string
          created_by?: string | null
          establishment_id: string
          expires_at: string
          id?: string
          package_id: string
          purchased_at?: string
          sale_id?: string | null
          starts_at?: string
          status?: string
        }
        Update: {
          amount_paid?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          establishment_id?: string
          expires_at?: string
          id?: string
          package_id?: string
          purchased_at?: string
          sale_id?: string | null
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_packages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_packages_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_packages_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "service_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_packages_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_service_subscriptions: {
        Row: {
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          billing_reference: string | null
          cancelled_at: string | null
          client_id: string
          created_at: string
          created_by: string | null
          establishment_id: string
          id: string
          next_renewal_at: string | null
          plan_id: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          billing_reference?: string | null
          cancelled_at?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          establishment_id: string
          id?: string
          next_renewal_at?: string | null
          plan_id: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          billing_reference?: string | null
          cancelled_at?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          establishment_id?: string
          id?: string
          next_renewal_at?: string | null
          plan_id?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_service_subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_service_subscriptions_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_service_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "customer_subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_subscription_credits: {
        Row: {
          contracted: number
          cycle_id: string
          establishment_id: string
          id: string
          service_id: string
          used: number
        }
        Insert: {
          contracted: number
          cycle_id: string
          establishment_id: string
          id?: string
          service_id: string
          used?: number
        }
        Update: {
          contracted?: number
          cycle_id?: string
          establishment_id?: string
          id?: string
          service_id?: string
          used?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_subscription_credits_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "customer_subscription_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_subscription_credits_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_subscription_credits_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_subscription_cycles: {
        Row: {
          asaas_payment_id: string | null
          created_at: string
          ends_at: string
          establishment_id: string
          id: string
          paid_at: string | null
          starts_at: string
          status: string
          subscription_id: string
        }
        Insert: {
          asaas_payment_id?: string | null
          created_at?: string
          ends_at: string
          establishment_id: string
          id?: string
          paid_at?: string | null
          starts_at: string
          status?: string
          subscription_id: string
        }
        Update: {
          asaas_payment_id?: string | null
          created_at?: string
          ends_at?: string
          establishment_id?: string
          id?: string
          paid_at?: string | null
          starts_at?: string
          status?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_subscription_cycles_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_subscription_cycles_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "customer_service_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_subscription_plan_items: {
        Row: {
          establishment_id: string
          id: string
          plan_id: string
          quantity: number
          service_id: string
        }
        Insert: {
          establishment_id: string
          id?: string
          plan_id: string
          quantity: number
          service_id: string
        }
        Update: {
          establishment_id?: string
          id?: string
          plan_id?: string
          quantity?: number
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_subscription_plan_items_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_subscription_plan_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "customer_subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_subscription_plan_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_subscription_plans: {
        Row: {
          created_at: string
          description: string | null
          establishment_id: string
          id: string
          name: string
          periodicity: string
          price: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          establishment_id: string
          id?: string
          name: string
          periodicity?: string
          price: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          establishment_id?: string
          id?: string
          name?: string
          periodicity?: string
          price?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_subscription_plans_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      establishment_users: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
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
          email?: string | null
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
          email?: string | null
          establishment_id?: string
          id?: string
          professional_id?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expense_audit_logs: {
        Row: {
          created_at: string
          establishment_id: string
          expense_id: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          operation: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          establishment_id: string
          expense_id?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          operation: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          establishment_id?: string
          expense_id?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          operation?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_audit_logs_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          discount: number
          establishment_id: string
          expense_id: string
          final_amount: number | null
          financial_account: string | null
          fine: number
          id: string
          interest: number
          notes: string | null
          payment_date: string
          payment_method: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          discount?: number
          establishment_id: string
          expense_id: string
          final_amount?: number | null
          financial_account?: string | null
          fine?: number
          id?: string
          interest?: number
          notes?: string | null
          payment_date: string
          payment_method?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          discount?: number
          establishment_id?: string
          expense_id?: string
          final_amount?: number | null
          financial_account?: string | null
          fine?: number
          id?: string
          interest?: number
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_payments_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_payments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          cancelled_at: string | null
          category: string | null
          competence_date: string | null
          cost_center: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string
          due_date: string
          establishment_id: string
          expense_date: string
          id: string
          installment_count: number | null
          installment_group_id: string | null
          installment_number: number | null
          notes: string | null
          occurrence_date: string | null
          paid_amount: number
          paid_at: string | null
          paid_by: string | null
          recurring_plan_id: string | null
          status: string
          supplier: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          cancelled_at?: string | null
          category?: string | null
          competence_date?: string | null
          cost_center?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description: string
          due_date?: string
          establishment_id: string
          expense_date?: string
          id?: string
          installment_count?: number | null
          installment_group_id?: string | null
          installment_number?: number | null
          notes?: string | null
          occurrence_date?: string | null
          paid_amount?: number
          paid_at?: string | null
          paid_by?: string | null
          recurring_plan_id?: string | null
          status?: string
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          cancelled_at?: string | null
          category?: string | null
          competence_date?: string | null
          cost_center?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string
          due_date?: string
          establishment_id?: string
          expense_date?: string
          id?: string
          installment_count?: number | null
          installment_group_id?: string | null
          installment_number?: number | null
          notes?: string | null
          occurrence_date?: string | null
          paid_amount?: number
          paid_at?: string | null
          paid_by?: string | null
          recurring_plan_id?: string | null
          status?: string
          supplier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_recurring_plan_id_fkey"
            columns: ["recurring_plan_id"]
            isOneToOne: false
            referencedRelation: "financial_recurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_recurrences: {
        Row: {
          active: boolean
          created_at: string
          end_date: string | null
          frequency: string
          id: string
          interval_count: number
          last_generated_date: string | null
          max_occurrences: number | null
          start_date: string
          template: Json
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          end_date?: string | null
          frequency: string
          id?: string
          interval_count?: number
          last_generated_date?: string | null
          max_occurrences?: number | null
          start_date: string
          template?: Json
          tenant_id: string
          tipo: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          end_date?: string | null
          frequency?: string
          id?: string
          interval_count?: number
          last_generated_date?: string | null
          max_occurrences?: number | null
          start_date?: string
          template?: Json
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_recurrences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          calendar_color: string
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
          calendar_color: string
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
          calendar_color?: string
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
          agendor_deal_id: number | null
          agendor_organization_id: number | null
          agendor_sync_error: string | null
          agendor_synced_at: string | null
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
          agendor_deal_id?: number | null
          agendor_organization_id?: number | null
          agendor_sync_error?: string | null
          agendor_synced_at?: string | null
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
          agendor_deal_id?: number | null
          agendor_organization_id?: number | null
          agendor_sync_error?: string | null
          agendor_synced_at?: string | null
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
          created_by_user_id: string | null
          credit_used: number
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          establishment_id: string
          fee_amount: number
          gross_amount: number | null
          id: string
          installments: number | null
          net_amount: number | null
          notes: string | null
          paid_now: number | null
          payment_method: string | null
          professional_id: string | null
          sale_date: string
          service_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          card_machine_id?: string | null
          client_id: string
          created_at?: string
          created_by_user_id?: string | null
          credit_used?: number
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          establishment_id: string
          fee_amount?: number
          gross_amount?: number | null
          id?: string
          installments?: number | null
          net_amount?: number | null
          notes?: string | null
          paid_now?: number | null
          payment_method?: string | null
          professional_id?: string | null
          sale_date?: string
          service_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          card_machine_id?: string | null
          client_id?: string
          created_at?: string
          created_by_user_id?: string | null
          credit_used?: number
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          establishment_id?: string
          fee_amount?: number
          gross_amount?: number | null
          id?: string
          installments?: number | null
          net_amount?: number | null
          notes?: string | null
          paid_now?: number | null
          payment_method?: string | null
          professional_id?: string | null
          sale_date?: string
          service_id?: string
          updated_at?: string
          updated_by?: string | null
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
      service_benefit_consumptions: {
        Row: {
          appointment_id: string | null
          benefit_type: string
          client_id: string
          comanda_id: string | null
          consumed_at: string
          consumed_by: string | null
          establishment_id: string
          id: string
          package_credit_id: string | null
          professional_id: string | null
          reference_value: number
          reversed_at: string | null
          reversed_by: string | null
          service_id: string
          subscription_credit_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          benefit_type: string
          client_id: string
          comanda_id?: string | null
          consumed_at?: string
          consumed_by?: string | null
          establishment_id: string
          id?: string
          package_credit_id?: string | null
          professional_id?: string | null
          reference_value: number
          reversed_at?: string | null
          reversed_by?: string | null
          service_id: string
          subscription_credit_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          benefit_type?: string
          client_id?: string
          comanda_id?: string | null
          consumed_at?: string
          consumed_by?: string | null
          establishment_id?: string
          id?: string
          package_credit_id?: string | null
          professional_id?: string | null
          reference_value?: number
          reversed_at?: string | null
          reversed_by?: string | null
          service_id?: string
          subscription_credit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_benefit_consumptions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_benefit_consumptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_benefit_consumptions_comanda_id_fkey"
            columns: ["comanda_id"]
            isOneToOne: false
            referencedRelation: "comandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_benefit_consumptions_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_benefit_consumptions_package_credit_id_fkey"
            columns: ["package_credit_id"]
            isOneToOne: false
            referencedRelation: "customer_package_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_benefit_consumptions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_benefit_consumptions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_benefit_consumptions_subscription_credit_id_fkey"
            columns: ["subscription_credit_id"]
            isOneToOne: false
            referencedRelation: "customer_subscription_credits"
            referencedColumns: ["id"]
          },
        ]
      }
      service_package_items: {
        Row: {
          created_at: string
          establishment_id: string
          id: string
          package_id: string
          quantity: number
          service_id: string
        }
        Insert: {
          created_at?: string
          establishment_id: string
          id?: string
          package_id: string
          quantity: number
          service_id: string
        }
        Update: {
          created_at?: string
          establishment_id?: string
          id?: string
          package_id?: string
          quantity?: number
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_package_items_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_package_items_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "service_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_package_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_packages: {
        Row: {
          created_at: string
          description: string | null
          establishment_id: string
          id: string
          name: string
          price: number
          status: string
          updated_at: string
          validity_days: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          establishment_id: string
          id?: string
          name: string
          price: number
          status?: string
          updated_at?: string
          validity_days: number
        }
        Update: {
          created_at?: string
          description?: string | null
          establishment_id?: string
          id?: string
          name?: string
          price?: number
          status?: string
          updated_at?: string
          validity_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_packages_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          available_online: boolean
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
          available_online?: boolean
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
          available_online?: boolean
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
          client_fields: Json
          created_at: string
          establishment_id: string
          id: string
          inactive_days_threshold: number | null
          updated_at: string
          weekly_hours: Json | null
          working_days: number[]
        }
        Insert: {
          business_close_time?: string
          business_open_time?: string
          client_fields?: Json
          created_at?: string
          establishment_id: string
          id?: string
          inactive_days_threshold?: number | null
          updated_at?: string
          weekly_hours?: Json | null
          working_days?: number[]
        }
        Update: {
          business_close_time?: string
          business_open_time?: string
          client_fields?: Json
          created_at?: string
          establishment_id?: string
          id?: string
          inactive_days_threshold?: number | null
          updated_at?: string
          weekly_hours?: Json | null
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
          grace_cycle_key: string | null
          grace_ends_at: string | null
          grace_started_at: string | null
          id: string
          last_payment_at: string | null
          manual_blocked_at: string | null
          manual_blocked_reason: string | null
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
          grace_cycle_key?: string | null
          grace_ends_at?: string | null
          grace_started_at?: string | null
          id?: string
          last_payment_at?: string | null
          manual_blocked_at?: string | null
          manual_blocked_reason?: string | null
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
          grace_cycle_key?: string | null
          grace_ends_at?: string | null
          grace_started_at?: string | null
          id?: string
          last_payment_at?: string | null
          manual_blocked_at?: string | null
          manual_blocked_reason?: string | null
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
      add_client_credit: {
        Args: {
          _amount: number
          _client_id: string
          _description?: string
          _origin?: string
          _payment_method?: string
          _source?: string
          _source_id?: string
        }
        Returns: string
      }
      admin_soft_delete_sale: {
        Args: { _reason?: string; _sale_id: string }
        Returns: undefined
      }
      admin_update_sale: {
        Args: { _patch: Json; _sale_id: string }
        Returns: {
          amount: number
          appointment_id: string | null
          card_machine_id: string | null
          client_id: string
          created_at: string
          created_by_user_id: string | null
          credit_used: number
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          establishment_id: string
          fee_amount: number
          gross_amount: number | null
          id: string
          installments: number | null
          net_amount: number | null
          notes: string | null
          paid_now: number | null
          payment_method: string | null
          professional_id: string | null
          sale_date: string
          service_id: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "sales"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assert_payable_manager: {
        Args: { p_establishment: string }
        Returns: undefined
      }
      consume_service_benefit: {
        Args: {
          p_appointment_id?: string
          p_benefit_type: string
          p_client_id: string
          p_comanda_id?: string
          p_credit_id: string
          p_professional_id?: string
          p_reference_value?: number
          p_service_id: string
        }
        Returns: string
      }
      contact_email_error: {
        Args: { p_email: string; p_required?: boolean }
        Returns: string
      }
      contact_phone_error: {
        Args: { p_phone: string; p_required?: boolean }
        Returns: string
      }
      create_financial_recurrence: {
        Args: {
          p_end_date?: string
          p_frequency: string
          p_generate_until?: string
          p_max_occurrences?: number
          p_start_date: string
          p_template?: Json
          p_tenant_id: string
          p_tipo: string
        }
        Returns: string
      }
      create_payables: {
        Args: { p_data: Json; p_establishment: string; p_installments?: number }
        Returns: {
          amount: number
          cancelled_at: string | null
          category: string | null
          competence_date: string | null
          cost_center: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string
          due_date: string
          establishment_id: string
          expense_date: string
          id: string
          installment_count: number | null
          installment_group_id: string | null
          installment_number: number | null
          notes: string | null
          occurrence_date: string | null
          paid_amount: number
          paid_at: string | null
          paid_by: string | null
          recurring_plan_id: string | null
          status: string
          supplier: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "expenses"
          isOneToOne: false
          isSetofReturn: true
        }
      }
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
      delete_payable: { Args: { p_id: string }; Returns: undefined }
      financial_recurrence_step: {
        Args: { freq: string; mult?: number }
        Returns: string
      }
      generate_financial_recurrence: {
        Args: { p_recurrence_id: string; p_until?: string }
        Returns: number
      }
      get_my_employee_agenda: {
        Args: { _end: string; _start: string }
        Returns: Json
      }
      get_my_employee_attendances: { Args: never; Returns: Json }
      get_my_employee_context: { Args: never; Returns: Json }
      get_my_establishment_profile: { Args: never; Returns: Json }
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
      is_establishment_admin: {
        Args: { _establishment_id: string; _user_id: string }
        Returns: boolean
      }
      is_establishment_member: {
        Args: { _establishment_id: string; _user_id: string }
        Returns: boolean
      }
      normalize_br_phone: { Args: { p_phone: string }; Returns: string }
      open_customer_subscription_cycle: {
        Args: {
          p_asaas_payment_id?: string
          p_ends_at: string
          p_starts_at: string
          p_subscription_id: string
        }
        Returns: string
      }
      pay_expense: {
        Args: {
          p_account: string
          p_amount: number
          p_discount?: number
          p_fine?: number
          p_id: string
          p_interest?: number
          p_method: string
          p_notes?: string
          p_payment_date: string
        }
        Returns: {
          amount: number
          cancelled_at: string | null
          category: string | null
          competence_date: string | null
          cost_center: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string
          due_date: string
          establishment_id: string
          expense_date: string
          id: string
          installment_count: number | null
          installment_group_id: string | null
          installment_number: number | null
          notes: string | null
          occurrence_date: string | null
          paid_amount: number
          paid_at: string | null
          paid_by: string | null
          recurring_plan_id: string | null
          status: string
          supplier: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "expenses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      recalculate_sale_commissions: {
        Args: { _establishment_id?: string }
        Returns: {
          rows_updated: number
          sales_affected: number
        }[]
      }
      refund_client_credit: {
        Args: { _source: string; _source_id: string }
        Returns: undefined
      }
      register_appointment_deposit: {
        Args: {
          _amount: number
          _appointment_id: string
          _note?: string
          _payment_method?: string
        }
        Returns: undefined
      }
      request_grace_unlock: { Args: never; Returns: Json }
      sell_service_package: {
        Args: {
          p_amount_paid?: number
          p_client_id: string
          p_package_id: string
          p_sale_id?: string
          p_starts_at?: string
        }
        Returns: string
      }
      slugify: { Args: { input: string }; Returns: string }
      staff_owns_appointment: {
        Args: { p_appointment_id: string; p_establishment_id: string }
        Returns: boolean
      }
      staff_owns_comanda: {
        Args: { p_comanda_id: string; p_establishment_id: string }
        Returns: boolean
      }
      unaccent: { Args: { "": string }; Returns: string }
      update_payable: {
        Args: { p_changes: Json; p_id: string }
        Returns: {
          amount: number
          cancelled_at: string | null
          category: string | null
          competence_date: string | null
          cost_center: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string
          due_date: string
          establishment_id: string
          expense_date: string
          id: string
          installment_count: number | null
          installment_group_id: string | null
          installment_number: number | null
          notes: string | null
          occurrence_date: string | null
          paid_amount: number
          paid_at: string | null
          paid_by: string | null
          recurring_plan_id: string | null
          status: string
          supplier: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "expenses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      use_client_credit: {
        Args: {
          _amount: number
          _client_id: string
          _description?: string
          _origin?: string
          _source?: string
          _source_id?: string
        }
        Returns: string
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
