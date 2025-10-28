import { BookOpen, Compass, Layers, ShieldCheck } from 'lucide-react'

const highlights = [
  {
    icon: BookOpen,
    title: 'Terminal Basics verstehen',
    description:
      'Lerne die wichtigsten Shell-Befehle, arbeite sicher mit Dateien und nutze Pipes, um Aufgaben zu automatisieren.',
  },
  {
    icon: Compass,
    title: 'Linux-Philosophie kennenlernen',
    description:
      'Verstehe das Zusammenspiel von Kernel, Distribution, Paketverwaltung und warum Linux so flexibel einsetzbar ist.',
  },
  {
    icon: Layers,
    title: 'Praxisnahe Übungen',
    description:
      'Setze das Erlernte direkt in kleinen Projekten um – von der Benutzerverwaltung bis zum Einrichten eines Webservers.',
  },
  {
    icon: ShieldCheck,
    title: 'Sicher arbeiten',
    description:
      'Erhalte Best Practices für Benutzerrechte, sudo, SSH und weitere Sicherheitsmechanismen.',
  },
]

const Grundlagen = () => {
  return (
    <main className="min-h-screen">
      <section className="bg-gradient-to-br from-primary-600 via-primary-700 to-indigo-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm font-medium mb-6">
            <BookOpen className="w-4 h-4" />
            Grundlagenkurs
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-8 max-w-3xl">
            Starte deine Linux-Reise mit einem starken Fundament
          </h1>
          <p className="text-lg sm:text-xl text-blue-100 max-w-2xl leading-relaxed">
            In diesem Grundlagenbereich begleiten wir dich von den allerersten Schritten im Terminal bis hin zu
            sicheren Arbeitsabläufen. Nach diesem Kurs bewegst du dich selbstbewusst in der Linux-Welt.
          </p>
        </div>
      </section>

      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="mb-16 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Was dich erwartet</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Ob du bereits erste Schritte gemacht hast oder komplett neu einsteigst – diese Module vermitteln dir
              das notwendige Wissen, um Linux produktiv und sicher zu nutzen.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {highlights.map((item) => (
              <div
                key={item.title}
                className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-8 shadow-sm transition-transform duration-300 hover:-translate-y-2 hover:shadow-xl"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary-500/0 via-primary-500/5 to-primary-600/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                <div className="relative flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-lg">
                    <item.icon className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{item.title}</h3>
                    <p className="text-gray-600 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gray-50 border-t border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Module im Grundlagenkurs</h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              Unsere Tutorials bauen logisch aufeinander auf. Jedes Modul enthält praxisnahe Beispiele, Schritt-für-Schritt
              Anleitungen und kleine Wissenschecks, damit du deinen Fortschritt direkt sehen kannst.
            </p>
            <ul className="mt-8 space-y-4 text-gray-700">
              <li className="flex gap-3">
                <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-sm font-semibold">
                  1
                </span>
                Einstieg in die Shell: Navigation, grundlegende Befehle, Dateiverwaltung
              </li>
              <li className="flex gap-3">
                <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-sm font-semibold">
                  2
                </span>
                Linux-Systemaufbau: Kernel, Distributionen, Paketmanager verstehen und nutzen
              </li>
              <li className="flex gap-3">
                <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-sm font-semibold">
                  3
                </span>
                Benutzer & Rechte: Arbeiten mit sudo, Gruppen und Dateiberechtigungen
              </li>
              <li className="flex gap-3">
                <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-sm font-semibold">
                  4
                </span>
                Wichtige Tools: SSH, einfache Netzwerkanalyse und nützliche Utilities für den Alltag
              </li>
            </ul>
          </div>
          <div className="relative rounded-3xl bg-white p-8 shadow-xl">
            <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-primary-500/10 via-primary-500/5 to-primary-500/20 blur-3xl"></div>
            <h3 className="text-2xl font-semibold text-gray-900 mb-4">Dein Lernpfad</h3>
            <p className="text-gray-600 leading-relaxed mb-6">
              Der Grundlagenkurs ist der erste Schritt unseres kompletten Linux-Lernpfads. Sobald du dich sicher fühlst,
              kannst du in die Bereiche "Befehle", "Praxis" und "Advanced" wechseln, um dein Wissen zu vertiefen.
            </p>
            <div className="space-y-3 text-gray-700">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-3 w-3 rounded-full bg-primary-500"></span>
                Über 40 praxisnahe Lessons
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-3 w-3 rounded-full bg-primary-500"></span>
                Schritt-für-Schritt Guides mit Screenshots & Code-Beispielen
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-3 w-3 rounded-full bg-primary-500"></span>
                Übungen und Checklisten zum Selbstüberprüfen
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">Bereit für den nächsten Schritt?</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-10">
            Wechsel zur Startseite und wähle das Modul, das am besten zu dir passt, oder tauche direkt in die Praxis- und
            Advanced-Themen ein, sobald du die Grundlagen sicher beherrschst.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
            >
              Zur Startseite
            </a>
            <a
              href="/admin"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl border border-primary-600 text-primary-700 font-semibold transition-all duration-300 hover:bg-primary-50"
            >
              Tutorials verwalten
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}

export default Grundlagen
