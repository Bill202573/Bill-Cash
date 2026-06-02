import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-blue-900 mb-2">
            Dashboard
          </h1>
          <p className="text-lg text-blue-700">
            Bem-vindo ao Sistema de Gestão da Stelle Odontologia
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Link
            to="/pacientes"
            className="p-8 bg-white rounded-lg shadow-lg hover:shadow-2xl transition-all duration-300 text-center border-t-4 border-blue-600 hover:-translate-y-1"
          >
            <div className="text-5xl mb-4">👥</div>
            <h2 className="text-2xl font-bold text-blue-900 mb-2">
              Pacientes
            </h2>
            <p className="text-gray-600 mb-4">
              Gerenciar cadastro de pacientes
            </p>
            <span className="inline-block text-blue-600 text-sm font-medium">Ir para →</span>
          </Link>

          <Link
            to="/agendamentos"
            className="p-8 bg-white rounded-lg shadow-lg hover:shadow-2xl transition-all duration-300 text-center border-t-4 border-green-600 hover:-translate-y-1"
          >
            <div className="text-5xl mb-4">📅</div>
            <h2 className="text-2xl font-bold text-blue-900 mb-2">
              Agendamentos
            </h2>
            <p className="text-gray-600 mb-4">
              Calendário com slots de 15 min
            </p>
            <span className="inline-block text-blue-600 text-sm font-medium">Ir para →</span>
          </Link>

          <Link
            to="/fluxo"
            className="p-8 bg-white rounded-lg shadow-lg hover:shadow-2xl transition-all duration-300 text-center border-t-4 border-purple-600 hover:-translate-y-1"
          >
            <div className="text-5xl mb-4">⏱️</div>
            <h2 className="text-2xl font-bold text-blue-900 mb-2">
              Fluxo na Clínica
            </h2>
            <p className="text-gray-600 mb-4">
              Gerenciar fluxo com cronômetros
            </p>
            <span className="inline-block text-blue-600 text-sm font-medium">Ir para →</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-8 bg-white rounded-lg shadow-md border-l-4 border-green-500">
            <h3 className="text-lg font-bold text-gray-900 mb-4">✅ Status do Sistema</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p className="flex items-center gap-2"><span className="text-green-500">●</span> Supabase conectado</p>
              <p className="flex items-center gap-2"><span className="text-green-500">●</span> Domínio configurado</p>
              <p className="flex items-center gap-2"><span className="text-green-500">●</span> Deploy ao vivo</p>
            </div>
          </div>

          <div className="p-8 bg-white rounded-lg shadow-md border-l-4 border-blue-500">
            <h3 className="text-lg font-bold text-gray-900 mb-4">ℹ️ Recursos</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>🔐 Autenticação segura com Supabase</p>
              <p>📱 Interface responsiva mobile-first</p>
              <p>⚡ Deploy automático em cada push</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
