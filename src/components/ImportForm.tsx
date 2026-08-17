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

interface ImportFormProps {
  onFileUploaded: (data: ImportedData[]) => void
}

export function ImportForm({ onFileUploaded }: ImportFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const validateCPF = (cpf: string): boolean => {
    const cleaned = cpf.replace(/\D/g, '')
    if (cleaned.length !== 11) return false
    if (/^(\d)\1{10}$/.test(cleaned)) return false

    let sum = 0
    let remainder

    for (let i = 1; i <= 9; i++) {
      sum += parseInt(cleaned.substring(i - 1, i)) * (11 - i)
    }

    remainder = (sum * 10) % 11
    if (remainder === 10 || remainder === 11) remainder = 0
    if (remainder !== parseInt(cleaned.substring(9, 10))) return false

    sum = 0
    for (let i = 1; i <= 10; i++) {
      sum += parseInt(cleaned.substring(i - 1, i)) * (12 - i)
    }

    remainder = (sum * 10) % 11
    if (remainder === 10 || remainder === 11) remainder = 0
    if (remainder !== parseInt(cleaned.substring(10, 11))) return false

    return true
  }

  const validatePhone = (phone: string): boolean => {
    const cleaned = phone.replace(/\D/g, '')
    return cleaned.length >= 10 && cleaned.length <= 11
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError('')

    try {
      const XLSX = (await import('xlsx')).default

      const reader = new FileReader()
      reader.onload = async (event) => {
        const data = event.target?.result
        const workbook = XLSX.read(data, { type: 'array' })
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(worksheet)

        // Validar e mapear dados
        const validatedData: ImportedData[] = []
        const existingCPFs = new Set<string>()

        // Buscar CPFs existentes no BD
        const { data: existingPatients } = await supabase
          .from('patients')
          .select('cpf')

        existingPatients?.forEach(p => {
          if (p.cpf) existingCPFs.add(p.cpf.replace(/\D/g, ''))
        })

        // Processar cada linha
        rows.forEach((row: any, index: number) => {
          const warnings: string[] = []
          const cleanCPF = row['CPF']?.replace(/\D/g, '') || ''
          const cpfValid = validateCPF(row['CPF'] || '')

          // Validações
          if (!row['Nome Completo']) {
            warnings.push('Nome completo não encontrado')
          }

          if (!cpfValid) {
            warnings.push('CPF inválido')
          }

          if (existingCPFs.has(cleanCPF)) {
            warnings.push('CPF já existe no sistema')
          }

          if (!validatePhone(row['Celulares'] || row['Telefones'] || '')) {
            warnings.push('Telefone inválido ou ausente')
          }

          validatedData.push({
            name: row['Nome Completo'] || '',
            cpf: row['CPF'] || '',
            phone: row['Celulares'] || row['Telefones'] || '',
            street: row['Endereço'] || '',
            number: row['Número'] || '',
            neighborhood: row['Bairro'] || '',
            gender: row['Sexo']?.toUpperCase() === 'M' ? 'M' : 'F',
            birthDate: row['Data Nascimento'],
            source_id: row['N° Prontuário'],
            validations: {
              cpfValid,
              duplicateCPF: existingCPFs.has(cleanCPF),
              warnings
            }
          })
        })

        onFileUploaded(validatedData)
      }

      reader.readAsArrayBuffer(file)
    } catch (err) {
      setError('Erro ao processar arquivo: ' + (err instanceof Error ? err.message : 'Desconhecido'))
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-8">
      <div className="max-w-2xl mx-auto">
        <div className="border-4 border-dashed border-blue-300 rounded-lg p-12 text-center hover:border-blue-500 transition cursor-pointer">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            disabled={loading}
            className="hidden"
            id="file-input"
          />
          <label htmlFor="file-input" className="cursor-pointer">
            <div className="text-5xl mb-4">📁</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              Selecione o arquivo Excel
            </h3>
            <p className="text-gray-600 mb-4">
              Arraste o arquivo do Controle Odonto aqui ou clique para selecionar
            </p>
            <p className="text-sm text-gray-500">
              Formatos aceitos: .xlsx, .xls, .csv
            </p>
          </label>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">❌ {error}</p>
          </div>
        )}

        {loading && (
          <div className="mt-6 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Processando arquivo...</p>
          </div>
        )}

        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-bold text-blue-900 mb-2">ℹ️ Informações Importantes</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>✓ Dados de saúde - máxima segurança</li>
            <li>✓ Validação de CPF e duplicatas</li>
            <li>✓ Preview antes de confirmar</li>
            <li>✓ Log auditável de todas as importações</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
