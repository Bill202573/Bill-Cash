import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { PatientForm } from '@/components/PatientForm'
import type { Patient } from '@/lib/supabase'

export default function Patients() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null)

  useEffect(() => {
    loadPatients()
  }, [])

  const loadPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setPatients(data || [])
    } catch (error) {
      console.error('Erro ao carregar pacientes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePatient = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este paciente?')) return

    try {
      const { error } = await supabase
        .from('patients')
        .delete()
        .eq('id', id)

      if (error) throw error
      loadPatients()
    } catch (error) {
      console.error('Erro ao excluir:', error)
      alert('Erro ao excluir paciente')
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="text-gray-600 text-lg">⏳ Carregando...</div></div>

  if (showForm) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => {
              setShowForm(false)
              setEditingPatient(null)
            }}
            className="mb-6 text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Voltar
          </button>
          <h1 className="text-4xl font-bold mb-8">
            {editingPatient ? '✏️ Editar Paciente' : '➕ Novo Paciente'}
          </h1>
          <div className="bg-white p-8 rounded-lg shadow-md">
            <PatientForm
              patient={editingPatient || undefined}
              onSuccess={() => {
                setShowForm(false)
                setEditingPatient(null)
                loadPatients()
              }}
              onCancel={() => {
                setShowForm(false)
                setEditingPatient(null)
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Pacientes</h1>
            <p className="text-gray-600 mt-2">{patients.length} pacientes cadastrados</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-md transition hover:shadow-lg"
          >
            ➕ Novo Paciente
          </button>
        </div>

        <div className="space-y-3">
          {patients.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-4xl mb-3">👥</p>
              <p className="text-gray-500 text-lg">Nenhum paciente cadastrado ainda</p>
              <p className="text-gray-400 mt-1">Clique em "Novo Paciente" para começar</p>
            </div>
          ) : (
            patients.map(patient => (
              <div key={patient.id} className="p-6 bg-white rounded-lg shadow hover:shadow-md transition border border-gray-200">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="font-bold text-lg text-gray-900">{patient.name}</p>
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">ID: {patient.cpf?.substring(0, 3)}</span>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p>📋 CPF: {patient.cpf}</p>
                      {patient.phone && <p>📱 Tel: {patient.phone}</p>}
                      {patient.street && (
                        <p>📍 {patient.street}, {patient.number} {patient.neighborhood && `- ${patient.neighborhood}`}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => {
                        setEditingPatient(patient)
                        setShowForm(true)
                      }}
                      className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition"
                      title="Editar paciente"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => handleDeletePatient(patient.id)}
                      className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition"
                      title="Excluir paciente"
                    >
                      🗑️ Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
