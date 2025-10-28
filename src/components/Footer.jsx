import { Terminal, Github, Mail, Heart } from 'lucide-react'

const Footer = () => {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-gray-900 text-gray-300 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-gradient-to-r from-primary-600 to-primary-800 p-2 rounded-lg">
                <Terminal className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Linux Tutorial</span>
            </div>
            <p className="text-gray-400">
              Dein umfassendes Tutorial für Linux - von den Basics bis zu Advanced Techniken.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <button 
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="hover:text-primary-400 transition-colors duration-200"
                >
                  Grundlagen
                </button>
              </li>
              <li>
                <button 
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="hover:text-primary-400 transition-colors duration-200"
                >
                  Befehle
                </button>
              </li>
              <li>
                <button 
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="hover:text-primary-400 transition-colors duration-200"
                >
                  Praxis
                </button>
              </li>
              <li>
                <button 
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="hover:text-primary-400 transition-colors duration-200"
                >
                  Advanced
                </button>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-semibold mb-4">Kontakt</h4>
            <div className="space-y-3">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 hover:text-primary-400 transition-colors duration-200"
              >
                <Github className="w-5 h-5" />
                <span>GitHub</span>
              </a>
              <a
                href="mailto:info@example.com"
                className="flex items-center space-x-2 hover:text-primary-400 transition-colors duration-200"
              >
                <Mail className="w-5 h-5" />
                <span>E-Mail</span>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-400 text-sm mb-4 md:mb-0">
            © {currentYear} Linux Tutorial. Alle Rechte vorbehalten.
          </p>
          <div className="flex items-center space-x-1 text-sm">
            <span className="text-gray-400">Gemacht mit</span>
            <Heart className="w-4 h-4 text-red-500 fill-red-500" />
            <span className="text-gray-400">für die Linux Community</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
