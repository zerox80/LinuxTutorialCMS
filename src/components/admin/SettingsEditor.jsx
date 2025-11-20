import { useState, useEffect } from 'react'
import { Save, Loader2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const SettingsEditor = () => {
    const { token } = useAuth()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [settings, setSettings] = useState({
        pdfEnabled: true
    })
    const [message, setMessage] = useState(null)

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        try {
            const response = await fetch('/api/content/settings')
            if (response.ok) {
                const data = await response.json()
                // Merge with defaults in case new settings are added later
                setSettings(prev => ({ ...prev, ...data.content }))
            } else if (response.status === 404) {
                // If settings don't exist yet, use defaults
                console.log('Settings not found, using defaults')
            } else {
                console.error('Failed to fetch settings')
            }
        } catch (error) {
            console.error('Error fetching settings:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        setMessage(null)
        try {
            const response = await fetch('/api/content/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ content: settings })
            })

            if (response.ok) {
                setMessage({ type: 'success', text: 'Einstellungen erfolgreich gespeichert' })
            } else {
                throw new Error('Failed to save settings')
            }
        } catch (error) {
            console.error('Error saving settings:', error)
            setMessage({ type: 'error', text: 'Fehler beim Speichern der Einstellungen' })
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow p-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-6">
                    Globale Einstellungen
                </h2>

                <div className="space-y-6">
                    {/* PDF Settings */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-medium text-gray-900 dark:text-white">
                                PDF Download
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Erlaubt Benutzern das Herunterladen von Tutorials als PDF.
                            </p>
                        </div>
                        <button
                            onClick={() => setSettings(prev => ({ ...prev, pdfEnabled: !prev.pdfEnabled }))}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${settings.pdfEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                                }`}
                            role="switch"
                            aria-checked={settings.pdfEnabled}
                        >
                            <span
                                aria-hidden="true"
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.pdfEnabled ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                            />
                        </button>
                    </div>
                </div>

                <div className="mt-8 flex items-center justify-end gap-4">
                    {message && (
                        <span className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'
                            }`}>
                            {message.text}
                        </span>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Speichern...
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4" />
                                Speichern
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default SettingsEditor
