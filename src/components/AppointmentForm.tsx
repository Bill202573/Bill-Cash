import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Patient } from '@/lib/supabase'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface AppointmentFormProps {
  date: Date
  time: string
  patients: Patient[]
  onSuccess: () => void
  onCancel: () => void
}

export function AppointmentForm({
  date,
  time,
  patients,
  onSuccess,
  onCancel
}: AppointmentFormProps) {
  const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [step, setStep] = useState<'patient' | 'details'>('patient')
  const [formData, setFormData] = useState({
    procedure: '',
    duration_minutes: '30',
    observations: ''
  })

  const procedureOptions = [
    'Consulta',
    'Limpeza',
    'Avaliação Cirurgia',
    'Avaliação Clínico',
    'Obturação',
    'Canal',
    'Extração',
    'Prótese',
    'Implante'
  ]

  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(searchInput.toLowerCase()) ||
    p.cpf?.includes(searchInput)
  )

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient)
    setSearchInput(patient.name)
    setShowDropdown(false)
    setStep('details')
  }

  const handleCreatePatient = () => {
    if (searchInput.trim()) {
      setSelectedPatient({
        id: 'temp-' + Date.now(),
        name: searchInput.trim(),
        cpf: '',
        gender: 'M',
        created_at: new Date().toISOString()
      })
      setStep('details')
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedPatient || !formData.procedure) {
      alert('Preencha todos os campos')
      return
    }

    setLoading(true)

    try {
      const dateStr = format(date, 'yyyy-MM-dd')
      let patientId = selectedPatient.id

      // Se o paciente é novo (temp), criar no banco
      if (selectedPatient.id.startsWith('temp-')) {
        const { data, error } = await supabase
          .from('patients')
          .insert([{
            name: selectedPatient.name,
            cpf: '',
            gender: 'M',
            created_at: new Date().toISOString()
          }])
          .select('id')
          .single()

        if (error) {
          console.error('Erro ao criar paciente:', error)
          throw new Error(`Erro ao criar paciente: ${error.message}`)
        }
        patientId = data.id
      }

      const { error } = await supabase
        .from('appointments')
        .insert([{
          patient_id: patientId,
          appointment_date: dateStr,
          appointment_time: time,
          duration_minutes: parseInt(formData.duration_minutes),
          procedure: formData.procedure,
          status: 'scheduled',
          observations: formData.observations,
          professional_id: '00000000-0000-0000-0000-000000000000',
          whatsapp_confirmed: false
        }])

      if (error) throw error
      onSuccess()
    } catch (error: any) {
      console.error('Erro ao criar agendamento:', error)
      const errorMsg = error?.message || error?.details || 'Erro desconhecido'
      alert(`Erro ao criar agendamento:\n\n${errorMsg}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Data e Hora */}
      <div>
        <label className="block text-sm font-bold text-gray-900 mb-2">Data e Hora</label>
        <div className="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg">
          <p className="text-gray-900 font-semibold">
            {format(date, 'EEEE, dd MMM yyyy', { locale: ptBR })} às <span className="text-blue-600 font-bold text-lg">{time}</span>
          </p>
        </div>
      </div>

      {/* Step 1: Seleção de Paciente */}
      {step === 'patient' && (
        <div>
          <label className="block text-sm font-bold text-gray-900 mb-2">Paciente</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Procurar paciente ou digitar nome..."
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value)
                setShowDropdown(true)
              }}
              onFocus={() => setShowDropdown(true)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-gray-900 placeholder-gray-500"
            />

            {showDropdown && searchInput && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-gray-300 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                {filteredPatients.length > 0 ? (
                  <>
                    {filteredPatients.map(patient => (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() => handleSelectPatient(patient)}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition"
                      >
                        <div className="font-semibold text-gray-900">{patient.name}</div>
                        <div className="text-sm text-gray-600">
                          CPF: {patient.cpf || '—'} • Tel: {patient.phone || '—'}
                        </div>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={handleCreatePatient}
                      className="w-full text-left px-4 py-3 text-blue-600 hover:bg-blue-50 font-semibold border-t-2 border-gray-200"
                    >
                      ➕ Criar novo: "{searchInput}"
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreatePatient}
                    className="w-full text-left px-4 py-3 text-blue-600 hover:bg-blue-50 font-semibold"
                  >
                    ➕ Criar novo paciente: "{searchInput}"
                  </button>
                )}
              </div>
            )}
          </div>

          {selectedPatient && (
            <div className="mt-3 p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-gray-900 text-lg">{selectedPatient.name}</h4>
                  {selectedPatient.cpf && (
                    <p className="text-sm text-gray-700">CPF: {selectedPatient.cpf}</p>
                  )}
                  {selectedPatient.phone && (
                    <p className="text-sm text-gray-700">Tel: {selectedPatient.phone}</p>
                  )}
                  {selectedPatient.id.startsWith('temp-') && (
                    <p className="text-sm text-yellow-700 font-semibold mt-2">
                      📋 Será cadastrado quando chegar na consulta
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPatient(null)
                    setSearchInput('')
                  }}
                  className="text-gray-500 hover:text-gray-700 text-lg"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {selectedPatient && (
            <button
              type="button"
              onClick={() => setStep('details')}
              className="w-full mt-4 px-4 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition"
            >
              Próximo →
            </button>
          )}
        </div>
      )}

      {/* Step 2: Detalhes do Agendamento */}
      {step === 'details' && selectedPatient && (
        <>
          {/* Procedimento */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">Tipo de Atendimento</label>
            <select
              name="procedure"
              value={formData.procedure}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-gray-900"
            >
              <option value="" className="text-gray-500">Selecione...</option>
              {procedureOptions.map(proc => (
                <option key={proc} value={proc} className="text-gray-900">{proc}</option>
              ))}
            </select>
          </div>

          {/* Duração */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">Duração</label>
            <select
              name="duration_minutes"
              value={formData.duration_minutes}
              onChange={handleChange}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-gray-900"
            >
              <option value="15" className="text-gray-900">15 minutos</option>
              <option value="30" className="text-gray-900">30 minutos</option>
              <option value="45" className="text-gray-900">45 minutos</option>
              <option value="60" className="text-gray-900">1 hora</option>
              <option value="90" className="text-gray-900">1h 30min</option>
              <option value="120" className="text-gray-900">2 horas</option>
            </select>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">Observações</label>
            <textarea
              name="observations"
              value={formData.observations}
              onChange={handleChange}
              placeholder="Notas adicionais..."
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-gray-900 placeholder-gray-500 resize-none"
            />
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-4 border-t-2 border-gray-200">
            <button
              type="button"
              onClick={() => setStep('patient')}
              className="flex-1 px-4 py-3 bg-gray-300 text-gray-900 font-bold rounded-lg hover:bg-gray-400 transition"
            >
              ← Voltar
            </button>
            <button
              type="submit"
              disabled={loading || !formData.procedure}
              className="flex-1 px-4 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {loading ? '⏳ Salvando...' : '✓ Salvar Agendamento'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-3 bg-gray-300 text-gray-900 font-bold rounded-lg hover:bg-gray-400 transition"
            >
              Cancelar
            </button>
          </div>
        </>
      )}

      {/* Fallback para cancelar */}
      {!selectedPatient && step === 'patient' && !searchInput && (
        <button
          type="button"
          onClick={onCancel}
          className="w-full px-4 py-3 bg-gray-300 text-gray-900 font-bold rounded-lg hover:bg-gray-400 transition"
        >
          Cancelar
        </button>
      )}
    </form>
  )
}
