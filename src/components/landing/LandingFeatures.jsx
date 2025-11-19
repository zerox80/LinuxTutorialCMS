import React from 'react'
import { getIconComponent } from '../../utils/iconMap'

const LandingFeatures = ({ features }) => {
    const resolveIcon = (iconName) => {
        return getIconComponent(iconName, 'Terminal')
    }

    return (
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
    )
}

export default LandingFeatures
