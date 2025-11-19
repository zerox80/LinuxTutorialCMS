import React from 'react'

const LandingStats = ({ stats }) => {
    return (
        <section className="py-20 border-y border-white/5 bg-white/2 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
                    {stats.map((stat, i) => (
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
    )
}

export default LandingStats
