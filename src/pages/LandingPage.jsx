import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { useContent } from '../context/ContentContext'
import { getIconComponent } from '../utils/iconMap'

const LandingPage = () => {
    const navigate = useNavigate()
    const { getSection } = useContent()
    const heroContent = getSection('hero') || {}
    const features = Array.isArray(heroContent.features) ? heroContent.features : []

    // Helper to resolve icons dynamically
    const resolveIcon = (iconName) => {
        return getIconComponent(iconName, 'Terminal')
    }

    const statsContent = getSection('stats') || {}
    const statsItems = Array.isArray(statsContent.items) ? statsContent.items : []

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-primary-500/30">
            <Header />

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 overflow-hidden">
                {/* Background Effects */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
                    <div className="absolute top-20 left-20 w-72 h-72 bg-primary-600/20 rounded-full blur-[100px]" />
                    <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-600/20 rounded-full blur-[100px]" />
                </div>

                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    {heroContent.badgeText && (
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/50 border border-slate-800 backdrop-blur-sm mb-8 animate-fade-in-up">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            <span className="text-sm font-medium text-slate-300">{heroContent.badgeText}</span>
                        </div>
                    )}

                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 bg-gradient-to-b from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                        {heroContent.title?.line1 || 'Meistere die digitale'} <br />
                        <span className="bg-gradient-to-r from-primary-400 to-purple-400 bg-clip-text text-transparent">
                            {heroContent.title?.line2 || 'Zukunft'}
                        </span>
                    </h1>

                    <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed">
                        {heroContent.subtitle || 'Dein Einstieg in die Welt der IT.'}
                        {heroContent.subline && <span className="block mt-2 text-slate-500">{heroContent.subline}</span>}
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button
                            onClick={() => navigate('/tutorials')}
                            className="group relative px-8 py-4 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-primary-600/20 hover:shadow-primary-600/40 flex items-center gap-2"
                        >
                            {heroContent.primaryCta?.label || 'Jetzt starten'}
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                        <button
                            onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
                            className="px-8 py-4 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl font-semibold transition-all duration-200 border border-slate-800 hover:border-slate-700"
                        >
                            {heroContent.secondaryCta?.label || 'Mehr erfahren'}
                        </button>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section id="features" className="py-24 bg-slate-900/50 relative">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {features.map((feature, index) => {
                            const FeatureIcon = resolveIcon(feature.icon)
                            return (
                                <div
                                    key={index}
                                    className="group p-8 rounded-2xl bg-slate-950 border border-slate-800 hover:border-primary-500/30 transition-all duration-300 hover:-translate-y-1"
                                >
                                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color || 'from-primary-500/20 to-primary-600/5'} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                                        <FeatureIcon className="w-7 h-7 text-primary-400" />
                                    </div>
                                    <h3 className="text-2xl font-bold mb-4 text-slate-100">{feature.title}</h3>
                                    <p className="text-slate-400 leading-relaxed">
                                        {feature.description}
                                    </p>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </section>

            {/* Stats / Trust Section */}
            <section className="py-20 border-y border-slate-800/50 bg-slate-950">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                        {statsItems.map((stat, i) => (
                            <div key={i}>
                                <div className="text-4xl font-bold text-white mb-2">{stat.value}</div>
                                <div className="text-slate-500 font-medium">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900 to-slate-950" />
                <div className="relative max-w-4xl mx-auto px-4 text-center">
                    <h2 className="text-4xl font-bold mb-6 text-white">Wissen teilen & erweitern</h2>
                    <p className="text-xl text-slate-400 mb-10">
                        Bleib auf dem Laufenden mit den neuesten Entwicklungen in der IT-Welt.
                    </p>
                </div>
            </section>

            <Footer />
        </div>
    )
}

export default LandingPage
