import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronRight } from 'lucide-react'

const LandingHero = ({ content }) => {
    const navigate = useNavigate()
    const heroContent = content || {}

    return (
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
    )
}

export default LandingHero
