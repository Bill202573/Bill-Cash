import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AppointmentForm } from '@/components/AppointmentForm'
import type { Appointment, Patient } from '@/lib/supabase'
import { addDays, startOfWeek, format, isSameDay, parse } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function Appointments() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; time: string } | null>(null)

  useEffect(() => {
    loadData()
  }, [currentDate])

  const loadData = async () => {
    try {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
      const weekEnd = addDays(weekStart, 6)

      const startStr = format(weekStart, 'yyyy-MM-dd')
      const endStr = format(weekEnd, 'yyyy-MM-dd')

      const [appointmentsRes, patientsRes] = await Promise.all([
        supabase
          .from('appointments')
          .select('*')
          .gte('appointment_date', startStr)
          .lte('appointment_date', endStr)
          .order('appointment_date', { ascending: true })
          .order('appointment_time', { ascending: true }),
        supabase
          .from('patients')
          .select('*')
          .order('name', { ascending: true })
      ])

      if (appointmentsRes.error) throw appointmentsRes.error
      if (patientsRes.error) throw patientsRes.error

      setAppointments(appointmentsRes.data || [])
      setPatients(patientsRes.data || [])
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  const getWeekDays = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
    return Array.from({ length: 6 }, (_, i) => addDays(weekStart, i))
  }

  const get15MinSlots = () => {
    const slots = []
    for (let h = 8; h < 18; h++) {
      for (let m = 0; m < 60; m += 15) {
        slots.push(format(new Date().setHours(h, m), 'HH:mm'))
      }
    }
    return slots
  }

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-500'
      case 'checked_in': return 'bg-yellow-500'
      case 'in_progress': return 'bg-purple-500'
      case 'completed': return 'bg-green-500'
      case 'cancelled': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getAppointmentsForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return appointments.filter(appt => appt.appointment_date === dateStr)
  }

  const getSlotRowspan = (durationMinutes: number) => {
    return durationMinutes / 15
  }

  const isSlotOccupied = (date: Date, time: string, appointments: Appointment[]) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return appointments.some(appt => {
      const apptStart = parse(appt.appointment_time, 'HH:mm', new Date())
      const apptEnd = new Date(apptStart.getTime() + appt.duration_minutes * 60000)
      const slotTime = parse(time, 'HH:mm', new Date())

      return appt.appointment_date === dateStr &&
             slotTime >= apptStart &&
             slotTime < apptEnd
    })
  }

  const getAppointmentAtSlot = (date: Date, time: string) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return appointments.find(appt => {
      if (appt.appointment_date !== dateStr) return false
      return appt.appointment_time === time
    })
  }

  const weekDays = getWeekDays()
  const timeSlots = get15MinSlots()
  const dayAppointments = weekDays.map(day => getAppointmentsForDay(day))

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-600">⏳ Carregando...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-full">
        {/* Header com navegação */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentDate(addDays(currentDate, -7))}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                title="Semana anterior"
              >
                ←
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium text-gray-700"
              >
                Hoje
              </button>
              <button
                onClick={() => setCurrentDate(addDays(currentDate, 7))}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                title="Próxima semana"
              >
                →
              </button>
              <span className="ml-4 text-sm font-medium text-gray-600">
                {format(weekDays[0], 'dd MMM', { locale: ptBR })} - {format(weekDays[5], 'dd MMM yyyy', { locale: ptBR })}
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedSlot(null)
                setShowForm(true)
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
            >
              + Novo Agendamento
            </button>
          </div>
        </div>

        {/* Timeline de datas */}
        <div className="bg-white rounded-lg shadow-sm p-2 mb-4 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {Array.from({ length: 14 }, (_, i) => {
              const date = addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), i - 3)
              const isCurrentWeek = weekDays.some(d => isSameDay(d, date))
              const isToday = isSameDay(date, new Date())

              return (
                <button
                  key={date.toISOString()}
                  onClick={() => setCurrentDate(date)}
                  className={`flex flex-col items-center px-3 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition ${
                    isToday
                      ? 'bg-blue-600 text-white'
                      : isCurrentWeek
                      ? 'bg-orange-100 text-orange-700 border border-orange-300'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <div className="text-xs uppercase">{format(date, 'EEE', { locale: ptBR })}</div>
                  <div className="text-lg">{format(date, 'dd')}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Modal Novo Agendamento */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-xl">
                  📝
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Novo Agendamento</h2>
                  {selectedSlot && (
                    <p className="text-sm text-gray-500">
                      {format(selectedSlot.date, 'EEEE, dd MMM', { locale: ptBR })} às {selectedSlot.time}
                    </p>
                  )}
                </div>
              </div>
              <AppointmentForm
                date={selectedSlot?.date || new Date()}
                time={selectedSlot?.time || '08:00'}
                patients={patients}
                onSuccess={() => {
                  setShowForm(false)
                  setSelectedSlot(null)
                  loadData()
                }}
                onCancel={() => {
                  setShowForm(false)
                  setSelectedSlot(null)
                }}
              />
            </div>
          </div>
        )}

        {/* Grid Calendário com slots de 15 min */}
        <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="bg-gray-50 p-2 w-16 text-center font-bold text-xs text-gray-700 border-r border-gray-300">
                  Hora
                </th>
                {weekDays.map(day => (
                  <th
                    key={day.toISOString()}
                    className="bg-blue-600 text-white p-3 text-center font-bold border-r border-blue-700"
                    style={{ width: '160px' }}
                  >
                    <div className="text-xs uppercase">{format(day, 'EEE', { locale: ptBR })}</div>
                    <div className="text-xl font-bold">{format(day, 'dd')}</div>
                    <div className="text-xs opacity-90">{format(day, 'MMM', { locale: ptBR })}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((time, timeIdx) => (
                <tr key={`row-${timeIdx}`} className="border-b border-gray-200" style={{ height: '32px' }}>
                  <td
                    className={`bg-gray-50 p-1 text-center border-r border-gray-300 text-gray-700 ${
                      timeIdx % 4 === 0 ? 'font-bold text-xs' : 'text-xs text-gray-400'
                    }`}
                    style={{ height: '32px' }}
                  >
                    {timeIdx % 4 === 0 ? <div>{time}</div> : ''}
                  </td>

                  {weekDays.map((day, dayIdx) => {
                    const appt = getAppointmentAtSlot(day, time)
                    const patient = appt ? patients.find(p => p.id === appt.patient_id) : null
                    const rowSpan = appt ? getSlotRowspan(appt.duration_minutes) : undefined
                    const isOccupied = isSlotOccupied(day, time, dayAppointments[dayIdx])

                    if (isOccupied && !appt) {
                      return null
                    }

                    return (
                      <td
                        key={`${day.toISOString()}-${time}`}
                        className={`border-r border-gray-200 cursor-pointer transition ${
                          appt ? 'p-0' : 'p-0 bg-white hover:bg-gray-50'
                        }`}
                        rowSpan={rowSpan}
                        style={{ height: appt ? `${rowSpan ? rowSpan * 32 : 32}px` : '32px' }}
                        onClick={() => {
                          if (!appt) {
                            setSelectedSlot({ date: day, time })
                            setShowForm(true)
                          }
                        }}
                      >
                        {appt && (
                          <div
                            className={`${getStatusBgColor(appt.status)} text-white rounded-sm m-0.5 p-1 h-full flex flex-col justify-between text-xs overflow-hidden`}
                          >
                            <div className="leading-tight">
                              <div className="font-bold truncate text-sm">
                                {patient?.name.split(' ')[0]}
                              </div>
                              <div className="truncate opacity-90 text-xs">
                                {appt.procedure}
                              </div>
                            </div>
                            {rowSpan && rowSpan > 1 && (
                              <div className="opacity-75 font-medium text-xs text-center">
                                {appt.duration_minutes}m
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          💡 Clique em qualquer célula vazia para criar um novo agendamento
        </div>
      </div>
    </div>
  )
}
