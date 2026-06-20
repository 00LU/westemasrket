import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  Coins,
  Factory,
  Gauge,
  Monitor,
  PackageCheck,
  ScanSearch,
  Scale,
  ShieldCheck,
  Truck,
  Users,
  Zap,
} from 'lucide-react';

const problemCards = [
  {
    icon: AlertTriangle,
    title: 'Difficolta operative',
    text: 'Identificare codici CER e impianti adeguati e un processo complesso e dispersivo.',
  },
  {
    icon: Coins,
    title: 'Costi elevati',
    text: 'Gli oneri di smaltimento incidono pesantemente sul bilancio e riducono i margini.',
  },
  {
    icon: Gauge,
    title: 'Inefficienza',
    text: 'Gli impianti operano in logica push, generando ritardi e minore saturazione.',
  },
];

const solutionCards = [
  {
    icon: ScanSearch,
    title: 'Smaltimento rapido',
    text: 'Identifica il codice CER e trova lo smaltitore giusto in pochi click.',
  },
  {
    icon: Zap,
    title: 'Prezzi competitivi',
    text: 'Asta a ribasso per ottenere rapidamente il prezzo migliore sul mercato.',
  },
  {
    icon: Factory,
    title: 'Maggiore efficienza',
    text: 'Logica pull che ottimizza impianti, tratte e pianificazione operativa.',
  },
];

const flowSteps = [
  {
    icon: Building2,
    color: '#8B0000',
    label: 'Produttore',
    title: 'Pubblica la richiesta',
    description: 'Inserisce codice CER, quantita e scadenza per avviare il processo di smaltimento.',
  },
  {
    icon: Monitor,
    color: '#4A4A4A',
    label: 'Piattaforma',
    title: 'Trova i partner compatibili',
    description: 'Notifica automaticamente trasportatori e destinatari idonei nella zona.',
  },
  {
    icon: Scale,
    color: '#8B0000',
    label: 'Asta',
    title: 'Asta a ribasso in tempo reale',
    description: 'Trasportatori e destinatari inviano offerte competitive. La piattaforma calcola il pacchetto migliore (trasporto + trattamento).',
  },
  {
    icon: CheckCircle2,
    color: '#2E7D32',
    label: 'Produttore sceglie',
    title: "Accetta l'offerta migliore",
    description: 'Confronta le combinazioni e sceglie il prezzo piu conveniente.',
  },
  {
    icon: PackageCheck,
    color: '#8B0000',
    label: 'Completamento',
    title: 'Ritiro e conferimento',
    description: "Il trasportatore ritira il rifiuto e lo porta all'impianto destinatario. Documenti generati automaticamente.",
  },
];

const actors = [
  {
    icon: Users,
    title: 'Produttore',
    text: 'Chi genera rifiuti e cerca smaltimento sicuro, conforme e conveniente.',
    responsibilities: [
      'Classificare correttamente il rifiuto e indicare codice CER, quantita e tempistiche.',
      'Pubblicare la richiesta e confrontare offerte su prezzo, tempi e affidabilita.',
      'Selezionare il partner migliore e mantenere tracciabilita operativa del processo.',
    ],
    benefits: [
      'Riduce tempi amministrativi con un flusso unico e guidato.',
      'Ottiene condizioni economiche migliori grazie alla competizione tra operatori.',
      'Ha visibilita end-to-end su stato richiesta, trasporto e conferimento.',
    ],
  },
  {
    icon: Truck,
    title: 'Trasportatore',
    text: 'Chi sposta i rifiuti da un luogo all altro con tracciabilita e puntualita.',
    responsibilities: [
      'Valutare richieste compatibili con flotte, autorizzazioni e finestre operative.',
      'Presentare offerte competitive con tempi di ritiro e consegna chiari.',
      'Eseguire il servizio rispettando SLA, sicurezza e documentazione prevista.',
    ],
    benefits: [
      'Riceve lead qualificati invece di cercare opportunita in modo frammentato.',
      'Migliora saturazione dei mezzi riducendo tratte vuote e tempi morti.',
      'Consolida reputazione grazie a performance tracciate e feedback trasparenti.',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Destinatario',
    text: 'Chi riceve e gestisce i rifiuti con capacita e processi certificati.',
    responsibilities: [
      'Pubblicare disponibilita per CER, capacita impianto e fasce temporali.',
      'Valutare richieste in ingresso e formulare offerte con parametri chiari.',
      'Pianificare conferimenti ottimizzando linee, slot e risorse impiantistiche.',
    ],
    benefits: [
      'Aumenta utilizzo impianto con logica pull su domanda reale.',
      'Riduce inefficienze di pianificazione con richieste ordinate e comparabili.',
      'Migliora marginalita con pricing dinamico e maggiore continuita operativa.',
    ],
  },
];

function RevealSection({ children, className = '', ...props }) {
  return (
    <section
      {...props}
      data-reveal
      className={`translate-y-5 opacity-0 transition-all duration-700 ease-out ${className}`}
    >
      {children}
    </section>
  );
}

export default function LandingPage() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.remove('opacity-0', 'translate-y-5');
            entry.target.classList.add('opacity-100', 'translate-y-0');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    const elements = document.querySelectorAll('[data-reveal]');
    elements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-[#8B0000] text-white">
        <div className="pointer-events-none absolute -left-16 top-10 h-64 w-64 rounded-full bg-[#8B0000]/30 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-slate-500/20 blur-3xl" />

        <header className="relative z-20 border-b border-white/10 bg-black/20 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 sm:px-10">
            <p className="font-display text-2xl font-bold tracking-tight text-white">WasteMarket</p>
            <nav className="hidden items-center gap-6 text-sm font-medium text-slate-200 md:flex">
              <a href="#problema" className="transition hover:text-white">Problema</a>
              <a href="#soluzione" className="transition hover:text-white">Soluzione</a>
              <a href="#come-funziona" className="transition hover:text-white">Come funziona</a>
              <a href="#attori" className="transition hover:text-white">Attori</a>
            </nav>
            <div className="flex items-center gap-2">
              <Link
                to="/auth/login"
                className="rounded-lg border border-white/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-white/10"
              >
                Accedi
              </Link>
              <Link
                to="/auth/register"
                className="rounded-lg bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#8B0000] transition hover:-translate-y-0.5"
              >
                Registrati
              </Link>
            </div>
          </div>
        </header>

        <div className="relative mx-auto flex max-w-7xl flex-col gap-10 px-6 pb-20 pt-16 sm:px-10 lg:flex-row lg:items-center lg:justify-between lg:gap-14 lg:pt-20">
          <div className="max-w-3xl space-y-6">
            <p className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-100">
              B2B Waste Exchange Platform
            </p>
            <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
              Il marketplace dei rifiuti speciali
            </h1>
            <p className="max-w-2xl text-base text-slate-200 sm:text-lg">
              Connetti produttori, trasportatori e destinatari in modo diretto, veloce e trasparente.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                to="/auth/register"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-[#8B0000] transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                Registrati
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/auth/login"
                className="rounded-xl border border-white/40 bg-transparent px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/10"
              >
                Accedi
              </Link>
            </div>
          </div>
          <div className="w-full max-w-lg rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur">
            <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-200">Market Snapshot</p>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-xl bg-black/20 px-4 py-3">
                <span>Richieste attive</span>
                <strong className="text-lg">142</strong>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-black/20 px-4 py-3">
                <span>Aste concluse oggi</span>
                <strong className="text-lg">37</strong>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-black/20 px-4 py-3">
                <span>Tempo medio di matching</span>
                <strong className="text-lg">12 min</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 border-t border-white/10 bg-black/25">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-200 sm:grid-cols-3 sm:px-10">
            <p>Compliance-ready workflows</p>
            <p>Matching in tempo reale</p>
            <p>Riduzione tempi e costi operativi</p>
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-7xl flex-col gap-16 px-6 py-16 sm:px-10 lg:gap-20 lg:py-20">
        <RevealSection className="scroll-mt-24" id="problema">
          <header className="mb-8 flex items-end justify-between gap-4">
            <h2 className="font-display text-3xl font-bold text-slate-900 sm:text-4xl">Il mercato attuale e obsoleto</h2>
          </header>
          <div className="grid gap-4 md:grid-cols-3">
            {problemCards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <Icon className="mb-4 h-8 w-8 text-[#8B0000]" />
                  <h3 className="mb-2 font-display text-xl font-semibold text-slate-900">{card.title}</h3>
                  <p className="text-sm leading-6 text-slate-600">{card.text}</p>
                </article>
              );
            })}
          </div>
        </RevealSection>

        <RevealSection className="scroll-mt-24" id="soluzione">
          <header className="mb-8">
            <h2 className="font-display text-3xl font-bold text-slate-900 sm:text-4xl">WasteMarket semplifica tutto</h2>
          </header>
          <div className="grid gap-4 md:grid-cols-3">
            {solutionCards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <Icon className="mb-4 h-8 w-8 text-[#8B0000]" />
                  <h3 className="mb-2 font-display text-xl font-semibold text-slate-900">{card.title}</h3>
                  <p className="text-sm leading-6 text-slate-600">{card.text}</p>
                </article>
              );
            })}
          </div>
        </RevealSection>

        <RevealSection className="rounded-3xl border border-[#8B0000]/20 bg-gradient-to-r from-[#8B0000] to-red-900 p-8 text-white sm:p-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-red-100">Call To Action</p>
              <h3 className="font-display text-2xl font-bold sm:text-3xl">Riduci i costi di smaltimento gia dal prossimo carico</h3>
              <p className="mt-2 text-sm text-red-100">Attiva il tuo account e inizia a ricevere offerte competitive in pochi minuti.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/auth/register" className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#8B0000] transition hover:-translate-y-0.5">Inizia ora</Link>
              <Link to="/auth/login" className="rounded-xl border border-white/40 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10">Ho gia un account</Link>
            </div>
          </div>
        </RevealSection>
      </div>

      {/* ── Come funziona: full-width gray section ── */}
      <style>{`
        @keyframes flowDown {
          0%   { opacity: 0.25; transform: translateY(-6px); }
          50%  { opacity: 1;    transform: translateY(4px); }
          100% { opacity: 0.25; transform: translateY(-6px); }
        }
        .arrow-animated { animation: flowDown 1.6s ease-in-out infinite; }
      `}</style>

      <section id="come-funziona" className="scroll-mt-16 bg-[#F5F5F5] py-16 sm:py-20">
        <div className="mx-auto max-w-2xl px-6 sm:px-10">
          <header className="mb-12 text-center" data-reveal>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#8B0000]">Processo</p>
            <h2 className="font-display text-3xl font-bold text-slate-900 sm:text-4xl">Come funziona</h2>
            <p className="mt-3 text-slate-600">Dal rifiuto al conferimento, tutto in una piattaforma.</p>
          </header>

          <div>
            {flowSteps.map((step, idx) => {
              const Icon = step.icon;
              const isLast = idx === flowSteps.length - 1;
              return (
                <div key={step.title} data-reveal className="translate-y-5 opacity-0 transition-all duration-700 ease-out">
                  <div className="flex items-start gap-5">
                    {/* Timeline column */}
                    <div className="flex flex-col items-center">
                      <div
                        className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-white shadow-lg"
                        style={{ backgroundColor: step.color }}
                      >
                        <Icon size={24} />
                      </div>
                      {!isLast && (
                        <div className="flex flex-col items-center">
                          <div className="w-0.5 flex-1 bg-gradient-to-b from-slate-300 to-slate-200" style={{ height: '28px' }} />
                          <ChevronDown className="arrow-animated" size={22} style={{ color: step.color }} />
                          <div className="w-0.5 flex-1 bg-gradient-to-b from-slate-200 to-transparent" style={{ height: '28px' }} />
                        </div>
                      )}
                    </div>

                    {/* Card */}
                    <div className="mb-4 flex-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <p
                        className="mb-1 text-xs font-bold uppercase tracking-wide"
                        style={{ color: step.color }}
                      >
                        {step.label}
                      </p>
                      <h3 className="font-display text-lg font-bold text-slate-900">{step.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-7xl flex-col gap-16 px-6 py-16 sm:px-10 lg:gap-20 lg:py-20">
        <RevealSection className="scroll-mt-24" id="attori">
          <header className="mb-8">
            <h2 className="font-display text-3xl font-bold text-slate-900 sm:text-4xl">Per chi e WasteMarket</h2>
          </header>
          <div className="grid gap-5 md:grid-cols-3">
            {actors.map((actor) => {
              const Icon = actor.icon;
              return (
                <article key={actor.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <Icon className="mb-4 h-8 w-8 text-[#8B0000]" />
                  <h3 className="mb-2 font-display text-xl font-semibold text-slate-900">{actor.title}</h3>
                  <p className="mb-4 text-sm leading-6 text-slate-600">{actor.text}</p>

                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-700">Cosa deve fare</p>
                      <ul className="space-y-2 text-sm text-slate-600">
                        {actor.responsibilities.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#8B0000]" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-xl border border-[#8B0000]/20 bg-[#8B0000]/5 p-4">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#8B0000]">Perche la piattaforma aiuta</p>
                      <ul className="space-y-2 text-sm text-slate-700">
                        {actor.benefits.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#8B0000]" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </RevealSection>
      </div>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10 sm:px-10 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-display text-2xl font-bold text-[#8B0000]">WasteMarket</p>
            <p className="mt-1 text-sm text-slate-600">Piattaforma digitale per la gestione dei rifiuti speciali</p>
          </div>
          <nav className="flex flex-wrap gap-5 text-sm font-medium text-slate-600">
            <a href="#" className="transition hover:text-[#8B0000]">Chi siamo</a>
            <a href="#" className="transition hover:text-[#8B0000]">Contatti</a>
            <a href="#" className="transition hover:text-[#8B0000]">Privacy</a>
          </nav>
        </div>
        <div className="border-t border-slate-200 px-6 py-4 text-center text-xs text-slate-500 sm:px-10">
          WasteMarket - B2B platform per la filiera dei rifiuti speciali
        </div>
      </footer>
    </main>
  );
}
