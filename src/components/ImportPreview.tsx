import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface ImportedData {
  name: string
  cpf: string
  phone: string
  street: string
  number: string
  neighborhood: string
  gender: string
  birthDate?: string
  source_id?: string
  validations: {
    cpfValid: boolean
    duplicateCPF: boolean
    warnings: string[]
  }
}

interface ImportPreviewProps {
  data: ImportedData
  currentIndex: number
  totalCount: number
  onConfirm: () => void
  onSkip: () => void
  onEdit: (data: ImportedData) => void
  onBack: () => void
}

export function ImportPreview({
  data,
  currentIndex,
  totalCount,
  onConfirm,
  onSkip,
  onEdit,
  onBack
}: ImportPreviewProps) {
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState(data)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('patients')
        .insert([{
          name: editData.name,
          cpf: editData.cpf,
          phone: editData.phone,
          street: editData.street,
          number: editData.number,
          neighborhood: editData.neighborhood,
          gender: editData.gender
        }])

      if (error) throw error

      // Log da importação
      await supabase
        .from('patient_imports')
        .insert([{
          patient_name: editData.name,
          patient_cpf: editData.cpf,
          source_id: editData.source_id,
          import_type: 'cadastro',
          status: 'success'
        }])

      onEdit(editData)
      onSkip()
    } catch (error) {
      console.error('Erro ao salvar:', error)
      alert('Erro ao salvar paciente')
    } finally {
      setSaving(false)
    }
  }

  const hasWarnings = data.validations.warnings.length > 0
  const isValid = data.validations.cpfValid && !data.validations.duplicateCPF && data.name

  return (
    <div className="bg-white rounded-lg shadow p-8">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">
            Paciente {currentIndex + 1} de {totalCount}
          </h2>
          <div className="text-sm text-gray-600">
            {Math.round(((currentIndex + 1) / totalCount) * 100)}% concluído
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${((currentIndex + 1) / totalCount) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Avisos */}
      {hasWarnings && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-bold text-yellow-900 mb-2">⚠️ Avisos de Validação</h4>
          <ul className="text-sm text-yellow-800 space-y-1">
            {data.validations.warnings.map((warning, idx) => (
              <li key={idx}>• {warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Status de Validação */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className={`p-3 rounded-lg ${data.validations.cpfValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <p className="text-sm font-medium">
            {data.validations.cpfValid ? '✅' : '❌'} CPF Válido
          </p>
        </div>
        <div className={`p-3 rounded-lg ${!data.validations.duplicateCPF ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <p className="text-sm font-medium">
            {!data.validations.duplicateCPF ? '✅' : '❌'} Sem Duplicata
          </p>
        </div>
      </div>

      {/* Dados do Paciente */}
      <div className="space-y-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
          {editing ? (
            <input
              type="text"
              value={editData.name}
              onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <p className="text-lg font-semibold">{data.name}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
            {editing ? (
              <input
                type="text"
                value={editData.cpf}
                onChange={(e) => setEditData({ ...editData, cpf: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-lg font-mono">{data.cpf}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
            {editing ? (
              <input
                type="tel"
                value={editData.phone}
                onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-lg">{data.phone}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
          {editing ? (
            <input
              type="text"
              value={editData.street}
              onChange={(e) => setEditData({ ...editData, street: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <p className="text-lg">{data.street}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
            {editing ? (
              <input
                type="text"
                value={editData.number}
                onChange={(e) => setEditData({ ...editData, number: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-lg">{data.number}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
            {editing ? (
              <input
                type="text"
                value={editData.neighborhood}
                onChange={(e) => setEditData({ ...editData, neighborhood: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-lg">{data.neighborhood}</p>
            )}
          </div>
        </div>
      </div>

      {/* Botões */}
      <div className="flex gap-3">
        {!editing ? (
          <>
            <button
              onClick={() => setEditing(true)}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 font-medium"
            >
              ✏️ Editar
            </button>
            <button
              onClick={handleSave}
              disabled={!isValid || saving}
              className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              {saving ? '⏳ Salvando...' : '✅ Confirmar e Próximo'}
            </button>
            <button
              onClick={onSkip}
              className="px-4 py-3 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 font-medium"
            >
              ⏭️ Pular
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => {
                setEditing(false)
                setEditData(data)
              }}
              className="flex-1 px-4 py-3 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 font-medium"
            >
              ❌ Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {saving ? '⏳ Salvando...' : '💾 Salvar Alterações'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
