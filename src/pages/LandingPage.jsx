import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronRight } from 'lucide-react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { useContent } from '../context/ContentContext'
import { getIconComponent } from '../utils/iconMap'

const LandingPage = () => {
    const navigate = useNavigate()
    const { getSection } = useContent()
    const heroContent = getSection('hero') || {}
    const features = Array.isArray(heroContent.features) ? heroContent.features : []
    const statsContent = getSection('stats') || {}
    const statsItems = Array.isArray(statsContent.items) ? statsContent.items : []

    // Helper to resolve icons dynamically
    const resolveIcon = (iconName) => {
        return getIconComponent(iconName, 'Terminal')
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-primary-500/30 overflow-x-hidden">
            <Header />

            {/* Hero Section with Aurora Effect */}
            <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
                {/* Dynamic Background */}
                <div className="absolute inset-0 aurora-bg opacity-30 pointer-events-none" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay pointer-events-none"></div>

                {/* Floating Elements */}
                <div className="absolute top-1/4 left-10 w-72 h-72 bg-primary-500/20 rounded-full blur-[100px] animate-float pointer-events-none" />
                <div className="absolute bottom-1/4 right-10 w-96 h-96 bg-purple-500/20 rounded-full blur-[100px] animate-float-delayed-2s pointer-events-none" />

                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center z-10">
                    {/* Badge */}
                    <div className="animate-slide-down opacity-0" style={{ animationFillMode: 'forwards' }}>
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8 hover:bg-white/10 transition-colors cursor-default">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
                            </span>
                            <span className="text-sm font-medium text-primary-200 tracking-wide uppercase text-xs">
                                {heroContent.badgeText || 'Next Gen Learning'}
                            </span>
                        </div>
                    </div>

                    {/* Main Title */}
                    <h1 className="text-6xl md:text-8xl font-bold tracking-tight mb-8 animate-slide-up opacity-0" style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}>
                        <span className="bg-gradient-to-b from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                            {heroContent.title?.line1 || 'Master the'}
                        </span>
                        <br />
                        <span className="bg-gradient-to-r from-primary-400 via-purple-400 to-primary-400 bg-clip-text text-transparent animate-gradient bg-[length:200%_auto]">
                            {heroContent.title?.line2 || 'Digital Future'}
                        </span>
                    </h1>

                    {/* Subtitle */}
                    <p className="text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto mb-12 leading-relaxed animate-slide-up opacity-0" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
                        {heroContent.subtitle || 'Your gateway to elite IT knowledge. Learn, build, and scale with our comprehensive tutorials and guides.'}
                    </p>

                    {/* CTA Buttons */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 animate-slide-up opacity-0" style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>
                        <button
                            onClick={() => navigate('/blog')}
                            className="group relative px-8 py-4 bg-white text-slate-950 rounded-full font-bold text-lg transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] flex items-center gap-2"
                        >
                            {heroContent.primaryCta?.label || 'Start Learning'}
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                        <button
                            onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
                            className="group px-8 py-4 bg-white/5 text-white rounded-full font-bold text-lg transition-all duration-300 hover:bg-white/10 border border-white/10 backdrop-blur-sm flex items-center gap-2"
                        >
                            {heroContent.secondaryCta?.label || 'Explore Features'}
                            <ChevronRight className="w-5 h-5 opacity-50 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>


                </div>
            </section>

            {/* Features Grid with Glassmorphism */}
            <section id="features" className="py-32 relative">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-20">
                        <h2 className="text-3xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                            Why Choose Us?
                        </h2>
                        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                            Experience a learning platform designed for the modern developer.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {features.map((feature, index) => {
                            const FeatureIcon = resolveIcon(feature.icon)
                            return (
                                <div
                                    key={index}
                                    className="group glass-card-premium p-8 rounded-3xl hover:-translate-y-2 transition-all duration-500 relative overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.color || 'from-primary-500/20 to-primary-600/5'} flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500 border border-white/5`}>
                                        <FeatureIcon className="w-8 h-8 text-primary-400" />
                                    </div>

                                    <h3 className="text-2xl font-bold mb-4 text-white relative z-10">{feature.title}</h3>
                                    <p className="text-slate-400 leading-relaxed relative z-10">
                                        {feature.description}
                                    </p>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section className="py-20 border-y border-white/5 bg-white/2 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
                        {statsItems.map((stat, i) => (
                            <div key={i} className="group">
                                <div className="text-5xl md:text-6xl font-bold text-white mb-2 bg-gradient-to-b from-white to-slate-500 bg-clip-text text-transparent group-hover:scale-110 transition-transform duration-300">
                                    {stat.value}
                                </div>
                                <div className="text-primary-400 font-medium tracking-wider uppercase text-sm">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-32 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950 to-primary-950/30" />
                <div className="absolute inset-0 aurora-bg opacity-20" />

                <div className="relative max-w-5xl mx-auto px-4 text-center">
                    <h2 className="text-5xl md:text-7xl font-bold mb-8 text-white tracking-tight">
                        {getSection('cta_section')?.title || 'Ready to Start?'}
                    </h2>
                    <p className="text-xl md:text-2xl text-slate-300 mb-12 max-w-3xl mx-auto">
                        {getSection('cta_section')?.description || 'Join thousands of developers mastering Linux and Modern Web Development today.'}
                    </p>
                    <button
                        onClick={() => navigate('/blog')}
                        className="px-12 py-6 bg-white text-slate-950 rounded-full font-bold text-xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_60px_-15px_rgba(255,255,255,0.4)]"
                    >
                        Get Started Now
                    </button>
                </div>
            </section>

            <Footer />
        </div>
    )
}

export default LandingPage
