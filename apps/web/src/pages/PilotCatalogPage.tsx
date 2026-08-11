import { ArrowRight, ExternalLink, ShieldCheck } from "lucide-react";

interface PilotCatalogPageProps {
  goHome: () => void;
}

const PILOTS = [
  {
    eyebrow: "Core protocol",
    title: "Basic pilot",
    description: "Run a compact sealed round, reveal submissions, and inspect the verified receipt.",
    meta: "Soroban · Core v2",
    logo: "/sub-rosa-logo.png",
    href: "#/pilot/basic",
    className: "basic",
    status: "live",
  },
  {
    eyebrow: "Partner workflow",
    title: "The Signal",
    description: "Open a private deal room where offers stay sealed until the organizer selects a provider.",
    meta: "ReceiptOnly · deal flow",
    logo: "/pilots/the-signal/the-signal-logo.png",
    href: "#/pilot/the-signal",
    className: "signal",
    status: "live",
  },
  {
    eyebrow: "Escrow handoff",
    title: "Trustless Work",
    description: "Turn a selected sealed proposal into a real multi-release escrow on Stellar Testnet.",
    meta: "USDC · Testnet",
    logo: "/pilots/trustless-work/trustless-work-logo.webp",
    href: "#/pilot/trustless-work",
    className: "trustless",
    status: "live",
  },
  {
    eyebrow: "Sealed proposals",
    title: "Offer-Hub",
    description: "Let clients collect freelancer proposals privately and reveal them together at the deadline before selecting a provider.",
    meta: "ReceiptOnly · Marketplace",
    logo: "/pilots/offer-hub/offer-hub.jpg",
    href: "#/pilot/offer-hub",
    className: "offer-hub",
    status: "live",
  },
  {
    eyebrow: "Credential layer",
    title: "ACTA",
    description: "Gate private submissions with verified credentials, then turn verified round outcomes into portable attestations.",
    meta: "Credentials · ReceiptOnly",
    logo: "/pilots/acta/ACTA.jpg",
    href: "#/pilot/acta",
    className: "acta",
    status: "live",
  },
  {
    eyebrow: "Agent bidding",
    title: "OpenX402",
    description: "Add lightweight sealed bidding between MCP discovery and x402 payment for competitive agent requests.",
    meta: "MCP · X402",
    logo: "/pilots/openx402/openx402-logo.jpg",
    className: "openx402",
    status: "comingSoon",
  },
] as const;

const livePilotCount = PILOTS.filter((pilot) => pilot.status === "live").length;
const comingSoonPilotCount = PILOTS.length - livePilotCount;

export function PilotCatalogPage({ goHome }: PilotCatalogPageProps) {
  return (
    <main className="pilot-catalog-page">
      <nav className="pilot-catalog-nav">
        <button type="button" className="brand-link" onClick={goHome}>
          <img src="/sub-rosa-logo.png" alt="" />
          <span>Sub Rosa</span>
        </button>
        <div className="pilot-catalog-nav-actions">
          <span className="pilot-catalog-status"><ShieldCheck size={14} /> Pilot workspace</span>
          <a href="#/docs" className="secondary-action compact">Docs</a>
          <a href="https://github.com/karagozemin/Sub-Rosa" target="_blank" rel="noreferrer" className="secondary-action compact">
            GitHub <ExternalLink size={13} />
          </a>
        </div>
      </nav>

      <header className="pilot-catalog-header">
        <div>
          <span className="pilot-catalog-kicker">Choose a pilot</span>
          <h1>Partner workspaces</h1>
          <p>Pick the flow you want to run. Each pilot opens in its own workspace with the controls and evidence for that workflow.</p>
        </div>
          <span className="pilot-catalog-count">
            {livePilotCount.toString().padStart(2, "0")} live · {comingSoonPilotCount.toString().padStart(2, "0")} coming
          </span>
      </header>

      <section className="pilot-catalog-grid" aria-label="Pilot workspaces">
        {PILOTS.map((pilot, index) => (
          pilot.status === "live" ? (
            <a className={`pilot-catalog-card ${pilot.className}`} href={pilot.href} key={pilot.title}>
              <div className="pilot-catalog-card-content">
                <div className="pilot-catalog-card-topline">
                  <span className="pilot-catalog-card-index">0{index + 1}</span>
                  <span className="pilot-catalog-card-status live">Live</span>
                </div>
                <span className="pilot-catalog-card-eyebrow">{pilot.eyebrow}</span>
                <h2>{pilot.title}</h2>
                <p>{pilot.description}</p>
                <span className="pilot-catalog-card-meta">{pilot.meta}</span>
                <span className="pilot-catalog-card-action">Open workspace <ArrowRight size={17} /></span>
              </div>
              <div className="pilot-catalog-card-art" aria-hidden="true">
                <img src={pilot.logo} alt="" />
              </div>
            </a>
          ) : (
            <article className={`pilot-catalog-card ${pilot.className} coming-soon`} key={pilot.title} aria-label={`${pilot.title}, coming soon`}>
              <div className="pilot-catalog-card-content">
                <div className="pilot-catalog-card-topline">
                  <span className="pilot-catalog-card-index">0{index + 1}</span>
                  <span className="pilot-catalog-card-status coming">Coming soon</span>
                </div>
                <span className="pilot-catalog-card-eyebrow">{pilot.eyebrow}</span>
                <h2>{pilot.title}</h2>
                <p>{pilot.description}</p>
                <span className="pilot-catalog-card-meta">{pilot.meta}</span>
                <span className="pilot-catalog-card-action">Coming soon</span>
              </div>
              <div className="pilot-catalog-card-art" aria-hidden="true">
                <img src={pilot.logo} alt="" />
              </div>
            </article>
          )
        ))}
      </section>
    </main>
  );
}
