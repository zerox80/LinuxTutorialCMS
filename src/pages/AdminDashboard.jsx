import { useState } from 'react'
import {
  LayoutDashboard,
  Paintbrush,
  FileText,
  RefreshCw,
} from 'lucide-react'
import { useContent } from '../context/ContentContext'
import SiteContentEditor from '../components/SiteContentEditor'
import PageManager from '../components/page-manager'
import AdminHeader from '../components/admin/AdminHeader'
import TutorialManagement from '../components/admin/TutorialManagement'

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('tutorials')
  const { loading: contentLoading } = useContent()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100">
      <AdminHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs Navigation */}
        <div className="mb-8 flex flex-col gap-3 border-b border-gray-200 pb-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            {/* Tutorials Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('tutorials')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${activeTab === 'tutorials'
                ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/20'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Blog Beiträge
            </button>
            {/* Content Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('content')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${activeTab === 'content'
                ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/20'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                }`}
            >
              <Paintbrush className="h-4 w-4" />
              Seiteninhalte
            </button>
            {/* Pages Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('pages')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${activeTab === 'pages'
                ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/20'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                }`}
            >
              <FileText className="h-4 w-4" />
              Seiten & Beiträge
            </button>
          </div>
        </div>

        {/* Tab Content: Tutorials */}
        {activeTab === 'tutorials' && <TutorialManagement />}

        {/* Tab Content: Site Content */}
        {activeTab === 'content' && (
          <div className="space-y-6">
            {contentLoading && (
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Inhalte werden geladen…
              </div>
            )}
            <SiteContentEditor />
          </div>
        )}

        {/* Tab Content: Pages */}
        {activeTab === 'pages' && <PageManager />}
      </main>
    </div>
  )
}

export default AdminDashboard
