import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Appointment, Patient } from '@/lib/supabase'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface AppointmentWithPatient extends Appointment {
  patient_name?: string
  checked_in_at?: string
  in_progress_at?: string
}

type TabType = 'scheduled' | 'checked_in' | 'in_progress'

export default function ClinicFlow() {
  const [appointments, setAppointments] = useState<AppointmentWithPatient[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('scheduled')
  const [timers, setTimers] = useState<{ [key: string]: number }>({})

  useEffect(() => {
    loadAppointments()
    const interval = setInterval(() => {
      setTimers(prev => {
        const updated = { ...prev }
        Object.keys(updated).forEach(key => {
          updated[key] = updated[key] + 1
        })
        return updated
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const loadAppointments = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd')

      const [appointmentsRes, patientsRes] = await Promise.all([
        supabase
          .from('appointments')
          .select('*')
          .eq('appointment_date', today)
          .order('appointment_time', { ascending: true }),
        supabase
          .from('patients')
          .select('*')
          .order('name', { ascending: true })
      ])

      if (appointmentsRes.error) throw appointmentsRes.error
      if (patientsRes.error) throw patientsRes.error

      const appts = appointmentsRes.data || []
      const pats = patientsRes.data || []

      const withNames = appts.map(appt => ({
        ...appt,
        patient_name: pats.find(p => p.id === appt.patient_id)?.name
      }))

      setAppointments(withNames)
      setPatients(pats)
    } catch (error) {
      console.error('Erro ao carregar:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (appointmentId: string, newStatus: string) => {
    try {
      const updateData: { status: string; checked_in_at?: string; in_progress_at?: string } = {
        status: newStatus
      }

      if (newStatus === 'checked_in') {
        updateData.checked_in_at = new Date().toISOString()
        setTimers(prev => ({ ...prev, [`${appointmentId}-wait`]: 0 }))
      } else if (newStatus === 'in_progress') {
        updateData.in_progress_at = new Date().toISOString()
        setTimers(prev => {
          const updated = { ...prev }
          delete updated[`${appointmentId}-wait`]
          updated[`${appointmentId}-service`] = 0
          return updated
        })
      } else if (newStatus === 'completed') {
        setTimers(prev => {
          const updated = { ...prev }
          delete updated[`${appointmentId}-service`]
          return updated
        })
      }

      const { error } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', appointmentId)

      if (error) throw error
      loadAppointments()
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="text-gray-600">⏳ Carregando...</div></div>

  const scheduled = appointments.filter(a => a.status === 'scheduled')
  const checkedIn = appointments.filter(a => a.status === 'checked_in')
  const inProgress = appointments.filter(a => a.status === 'in_progress')
  const completed = appointments.filter(a => a.status === 'completed')

  const getDisplayAppointments = () => {
    switch (activeTab) {
      case 'scheduled':
        return scheduled
      case 'checked_in':
        return checkedIn
      case 'in_progress':
        return inProgress
      default:
        return []
    }
  }

  const displayAppointments = getDisplayAppointments()

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-gray-900">Fluxo na Clínica</h1>
          <p className="text-gray-600 mt-2">{format(new Date(), 'EEEE, d MMMM yyyy', { locale: ptBR })}</p>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-blue-600">{scheduled.length}</div>
            <div className="text-sm text-gray-600">Agendados</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-yellow-600">{checkedIn.length}</div>
            <div className="text-sm text-gray-600">Sala de Espera</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-purple-600">{inProgress.length}</div>
            <div className="text-sm text-gray-600">Em Atendimento</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-green-600">{completed.length}</div>
            <div className="text-sm text-gray-600">Finalizados</div>
          </div>
        </div>

        {/* Abas */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`flex-1 px-6 py-4 text-center font-medium transition ${
                activeTab === 'scheduled'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📅 Agendados Para Hoje ({scheduled.length})
            </button>
            <button
              onClick={() => setActiveTab('checked_in')}
              className={`flex-1 px-6 py-4 text-center font-medium transition ${
                activeTab === 'checked_in'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              ⏳ Na Sala de Espera ({checkedIn.length})
            </button>
            <button
              onClick={() => setActiveTab('in_progress')}
              className={`flex-1 px-6 py-4 text-center font-medium transition ${
                activeTab === 'in_progress'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🦷 Nos Consultórios ({inProgress.length})
            </button>
          </div>

          {/* Conteúdo das abas */}
          <div className="p-6">
            {displayAppointments.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">-</div>
                <p className="text-gray-600">Nenhum agendamento nesta etapa</p>
              </div>
            ) : (
              <div className="space-y-4">
                {displayAppointments.map(appt => (
                  <div key={appt.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-bold text-lg text-gray-900">{appt.appointment_time} - {appt.patient_name}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          <div>Procedimento: {appt.procedure}</div>
                          <div>Duração: {appt.duration_minutes} minutos</div>
                        </div>

                        {/* Cronômetros */}
                        {activeTab === 'checked_in' && (
                          <div className="mt-3 inline-block px-3 py-2 bg-yellow-100 rounded font-mono text-lg font-bold text-yellow-800">
                            ⏳ {formatTime(timers[`${appt.id}-wait`] || 0)}
                          </div>
                        )}

                        {activeTab === 'in_progress' && (
                          <div className="mt-3 inline-block px-3 py-2 bg-purple-100 rounded font-mono text-lg font-bold text-purple-800">
                            🦷 {formatTime(timers[`${appt.id}-service`] || 0)}
                          </div>
                        )}
                      </div>

                      {/* Botão Avançar */}
                      {activeTab === 'scheduled' && (
                        <button
                          onClick={() => handleStatusChange(appt.id, 'checked_in')}
                          className="ml-4 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-medium whitespace-nowrap"
                        >
                          → Chamar
                        </button>
                      )}
                      {activeTab === 'checked_in' && (
                        <button
                          onClick={() => handleStatusChange(appt.id, 'in_progress')}
                          className="ml-4 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 font-medium whitespace-nowrap"
                        >
                          → Consultório
                        </button>
                      )}
                      {activeTab === 'in_progress' && (
                        <button
                          onClick={() => handleStatusChange(appt.id, 'completed')}
                          className="ml-4 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium whitespace-nowrap"
                        >
                          ✓ Finalizar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
