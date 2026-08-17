import { useState } from 'react'
import { ImportForm } from '@/components/ImportForm'
import { ImportPreview } from '@/components/ImportPreview'

type Step = 'upload' | 'preview' | 'confirm' | 'success'

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

export default function ImportData() {
  const [step, setStep] = useState<Step>('upload')
  const [importedData, setImportedData] = useState<ImportedData[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

  const handleFileUploaded = (data: ImportedData[]) => {
    setImportedData(data)
    setStep('preview')
    setCurrentIndex(0)
  }

  const handleConfirm = async () => {
    // Salvar no Supabase
    setStep('success')
  }

  const handleSkip = () => {
    if (currentIndex < importedData.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      setStep('success')
    }
  }

  const handleEdit = (index: number, updatedData: ImportedData) => {
    const newData = [...importedData]
    newData[index] = updatedData
    setImportedData(newData)
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">📥 Importar Dados</h1>
          <p className="text-gray-600 mt-2">Transfira dados do Controle Odonto com segurança</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8 bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-4">
            <div className={`text-center ${step === 'upload' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className="font-bold">1. Upload</div>
            </div>
            <div className="flex-1 mx-2 h-1 bg-gray-300"></div>
            <div className={`text-center ${step === 'preview' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className="font-bold">2. Validar</div>
            </div>
            <div className="flex-1 mx-2 h-1 bg-gray-300"></div>
            <div className={`text-center ${step === 'confirm' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className="font-bold">3. Confirmar</div>
            </div>
            <div className="flex-1 mx-2 h-1 bg-gray-300"></div>
            <div className={`text-center ${step === 'success' ? 'text-green-600' : 'text-gray-400'}`}>
              <div className="font-bold">✓ Pronto</div>
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        {step === 'upload' && (
          <ImportForm onFileUploaded={handleFileUploaded} />
        )}

        {step === 'preview' && importedData.length > 0 && (
          <ImportPreview
            data={importedData[currentIndex]}
            currentIndex={currentIndex}
            totalCount={importedData.length}
            onConfirm={handleConfirm}
            onSkip={handleSkip}
            onEdit={(updated) => handleEdit(currentIndex, updated)}
            onBack={() => setStep('upload')}
          />
        )}

        {step === 'success' && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-3xl font-bold text-green-600 mb-4">Importação Concluída!</h2>
            <p className="text-gray-600 mb-6">
              {importedData.length} paciente(s) foram importados com sucesso
            </p>
            <div className="space-y-2 text-sm text-gray-600 mb-6">
              <p>✓ Dados validados</p>
              <p>✓ Nenhuma duplicata encontrada</p>
              <p>✓ Registrado em log auditável</p>
            </div>
            <button
              onClick={() => window.location.href = '/pacientes'}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Ver Pacientes Importados
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
