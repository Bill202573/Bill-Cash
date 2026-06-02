import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Type definitions for our database schema
export interface Patient {
  id: string
  name: string
  cpf: string
  gender: 'M' | 'F'
  marital_status?: string
  profession?: string
  street?: string
  number?: string
  complement?: string
  neighborhood?: string
  phone?: string
  created_at: string
}

export interface Appointment {
  id: string
  patient_id: string
  professional_id: string
  appointment_date: string
  appointment_time: string
  duration_minutes: number
  procedure: string
  status: 'scheduled' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled'
  observations?: string
  whatsapp_confirmed: boolean
  created_at: string
}
