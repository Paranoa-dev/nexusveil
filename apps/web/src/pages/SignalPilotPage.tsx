import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clipboard,
  FileCheck2,
  KeyRound,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  UnlockKeyhole,
  Users,
  X,
} from "lucide-react";

import { LOGO_SRC } from "../lib/chain";

type SignalDealType = "otc" | "loan";
type SignalRole = "organizer" | "provider";
type SignalStatus = "collecting" | "ready" | "revealed" | "selected";

interface DealDraft {
  type: SignalDealType;
  title: string;
  asset: string;
  side: "buy" | "sell";
  targetAmount: string;
  settlementWindow: string;
  notes: string;
  requestedAmount: string;
  duration: string;
  purpose: string;
}

interface OtcOffer {
  rate: string;
  amount: string;
  timeline: string;
  terms: string;
  notes: string;
}

interface LoanOffer {
  interestRate: string;
  amount: string;
  duration: string;
  collateral: string;
  terms: string;
  notes: string;
}

type SignalOfferData = OtcOffer | LoanOffer;

interface SignalOffer {
  id: string;
  provider: string;
  providerMeta: string;
  submittedAt: number;
  data: SignalOfferData;
  revealed: boolean;
  source: "sample" | "demo";
}

interface PersistedRoom {
  id: string;
  draft: DealDraft;
  createdAt: number;
  deadlineAt: number;
  status: SignalStatus;
  selectedProviderId: string | null;
  revealedAt: number | null;
  mode: "ReceiptOnly";
  roundId: string | null;
}

const STORAGE_KEY = "subrosa-signal-pilot-room-v1";
const SAMPLE_ROOM_ID = "signal-otc-demo";

const DEFAULT_OTC: DealDraft = {
  type: "otc",
  title: "Buy 100,000 USDC worth of XLM",
  asset: "XLM",
  side: "buy",
  targetAmount: "100,000 USDC",
  settlementWindow: "T+1",
  notes: "Competitive OTC quote for a treasury rebalance. Best executable terms win.",
  requestedAmount: "",
  duration: "",
  purpose: "",
};

const DEFAULT_LOAN: DealDraft = {
  type: "loan",
  title: "30-day XLM working capital facility",
  asset: "USDC",
  side: "buy",
  targetAmount: "250,000 USDC",
  settlementWindow: "Within 24 hours",
  notes: "Short-duration facility for market-making inventory.",
  requestedAmount: "250,000 USDC",
  duration: "30 days",
  purpose: "Working capital for market-making inventory",
};

const SAMPLE_OTC_OFFERS: SignalOffer[] = [
  {
    id: "provider-a",
    provider: "Northstar Markets",
    providerMeta: "Institutional desk",
    submittedAt: 0,
    source: "sample",
    revealed: false,
    data: {
      rate: "0.00001342 USDC / XLM",
      amount: "100,000 USDC",
      timeline: "T+1, same-day confirmation",
      terms: "Firm quote for 15 minutes",
      notes: "Settlement through the organizer's nominated venue.",
    },
  },
  {
    id: "provider-b",
    provider: "Cedar OTC",
    providerMeta: "Digital asset liquidity",
    submittedAt: 0,
    source: "sample",
    revealed: false,
    data: {
      rate: "0.00001351 USDC / XLM",
      amount: "100,000 USDC",
      timeline: "T+1, settlement-ready",
      terms: "Quote valid until deadline + 30 minutes",
      notes: "No minimum ticket adjustment required.",
    },
  },
  {
    id: "provider-c",
    provider: "Harbor Prime",
    providerMeta: "Principal liquidity",
    submittedAt: 0,
    source: "sample",
    revealed: false,
    data: {
      rate: "0.00001347 USDC / XLM",
      amount: "100,000 USDC",
      timeline: "T+2, bank-day settlement",
      terms: "Subject to final compliance check",
      notes: "Can split settlement into two equal legs.",
    },
  },
];

const SAMPLE_LOAN_OFFERS: SignalOffer[] = [
  {
    id: "lender-a",
    provider: "Northstar Credit",
    providerMeta: "Structured lender",
    submittedAt: 0,
    source: "sample",
    revealed: false,
    data: {
      interestRate: "8.4% APR",
      amount: "250,000 USDC",
      duration: "30 days",
      collateral: "120% XLM collateral",
      terms: "Daily margin monitoring",
      notes: "Drawdown within one business day.",
    },
  },
  {
    id: "lender-b",
    provider: "Cedar Capital",
    providerMeta: "Treasury lender",
    submittedAt: 0,
    source: "sample",
    revealed: false,
    data: {
      interestRate: "8.9% APR",
      amount: "250,000 USDC",
      duration: "30 days",
      collateral: "110% XLM collateral",
      terms: "Weekly margin monitoring",
      notes: "Flexible prepayment with no penalty.",
    },
  },
  {
    id: "lender-c",
    provider: "Harbor Finance",
    providerMeta: "Alternative credit",
    submittedAt: 0,
    source: "sample",
    revealed: false,
    data: {
      interestRate: "9.2% APR",
      amount: "300,000 USDC",
      duration: "45 days",
      collateral: "100% XLM collateral",
      terms: "Borrower can resize after 15 days",
      notes: "Longer tenor available if required.",
    },
  },
];

const EMPTY_OTC_OFFER: OtcOffer = {
  rate: "",
  amount: "",
  timeline: "",
  terms: "",
  notes: "",
};

const EMPTY_LOAN_OFFER: LoanOffer = {
  interestRate: "",
  amount: "",
  duration: "",
  collateral: "",
  terms: "",
  notes: "",
};

function cloneOffers(type: SignalDealType): SignalOffer[] {
  const source = type === "otc" ? SAMPLE_OTC_OFFERS : SAMPLE_LOAN_OFFERS;
  return source.map((offer) => ({
    ...offer,
    submittedAt: Date.now(),
    data: { ...offer.data },
  }));
}

function createRoom(draft: DealDraft): PersistedRoom {
  return {
    id: SAMPLE_ROOM_ID,
    draft,
    createdAt: Date.now(),
    deadlineAt: Date.now() + 15 * 60 * 1000,
    status: "collecting",
    selectedProviderId: null,
    revealedAt: null,
    mode: "ReceiptOnly",
    roundId: null,
  };
}

function loadRoom(): PersistedRoom {
  if (typeof window === "undefined") return createRoom(DEFAULT_OTC);
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as PersistedRoom | null;
    if (
      value &&
      value.id &&
      value.draft &&
      (value.draft.type === "otc" || value.draft.type === "loan") &&
      ["collecting", "ready", "revealed", "selected"].includes(value.status)
    ) {
      return value;
    }
  } catch {
    // A malformed demo record should never block the pilot from opening.
  }
  return createRoom(DEFAULT_OTC);
}

function persistRoom(room: PersistedRoom): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(room));
}

function initialOffers(): SignalOffer[] {
  const saved = loadRoom();
  if (saved.id !== SAMPLE_ROOM_ID) return [];
  const revealed = saved.status === "revealed" || saved.status === "selected";
  return cloneOffers(saved.draft.type).map((offer) => ({ ...offer, revealed }));
}

function formatDeadline(timestamp: number, now: number): string {
  if (timestamp <= now) return "Deadline passed";
  const remaining = Math.max(0, Math.ceil((timestamp - now) / 1000));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s remaining`;
}

function shortId(value: string): string {
  return value.length > 22 ? `${value.slice(0, 10)}...${value.slice(-8)}` : value;
}

function offerFieldRows(offer: SignalOffer, type: SignalDealType): Array<[string, string]> {
  if (type === "otc") {
    const data = offer.data as OtcOffer;
    return [
      ["Rate", data.rate],
      ["Available amount", data.amount],
      ["Settlement", data.timeline],
      ["Terms", data.terms],
      ["Notes", data.notes],
    ];
  }
  const data = offer.data as LoanOffer;
  return [
    ["Interest rate", data.interestRate],
    ["Available amount", data.amount],
    ["Duration", data.duration],
    ["Collateral", data.collateral],
    ["Terms", data.terms],
    ["Notes", data.notes],
  ];
}

function dealRows(draft: DealDraft): Array<[string, string]> {
  if (draft.type === "otc") {
    return [
      ["Side", draft.side === "buy" ? "Buy" : "Sell"],
      ["Asset", draft.asset],
      ["Target", draft.targetAmount],
      ["Settlement window", draft.settlementWindow],
    ];
  }
  return [
    ["Requested amount", draft.requestedAmount],
    ["Asset", draft.asset],
    ["Duration", draft.duration],
    ["Purpose", draft.purpose],
  ];
}

export function SignalPilotPage({ goHome }: { goHome: () => void }) {
  const [room, setRoom] = useState<PersistedRoom>(() => loadRoom());
  const [offers, setOffers] = useState<SignalOffer[]>(initialOffers);
  const [draft, setDraft] = useState<DealDraft>(() => loadRoom().draft);
  const [role, setRole] = useState<SignalRole>("organizer");
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const [providerName, setProviderName] = useState("Your desk");
  const [providerMeta, setProviderMeta] = useState("Invited provider");
  const [offer, setOffer] = useState<SignalOfferData>(() => ({ ...EMPTY_OTC_OFFER }));

  const deadlinePassed = room.status !== "collecting" || room.deadlineAt <= now;
  const revealed = room.status === "revealed" || room.status === "selected";
  const selectedOffer = offers.find((entry) => entry.id === room.selectedProviderId);
  const visibleOffers = revealed ? offers.filter((entry) => entry.revealed) : [];

  useEffect(() => {
    persistRoom(room);
  }, [room]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (room.status === "collecting" && room.deadlineAt <= now) {
      setRoom((current) => ({ ...current, status: "ready" }));
    }
  }, [now, room]);

  function switchType(type: SignalDealType) {
    const nextDraft = type === "otc" ? { ...DEFAULT_OTC } : { ...DEFAULT_LOAN };
    setDraft(nextDraft);
    setOffer(type === "otc" ? { ...EMPTY_OTC_OFFER } : { ...EMPTY_LOAN_OFFER });
  }

  function updateDraft<K extends keyof DealDraft>(key: K, value: DealDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateOffer(key: string, value: string) {
    setOffer((current) => ({ ...current, [key]: value } as SignalOfferData));
  }

  function resetRoom() {
    const nextDraft = draft.type === "otc" ? { ...DEFAULT_OTC } : { ...DEFAULT_LOAN };
    const nextRoom = createRoom(nextDraft);
    setDraft(nextDraft);
    setRoom(nextRoom);
    setOffers(cloneOffers(nextDraft.type));
    setRole("organizer");
    setOffer(nextDraft.type === "otc" ? { ...EMPTY_OTC_OFFER } : { ...EMPTY_LOAN_OFFER });
  }

  function createDeal() {
    const nextRoom = {
      ...createRoom({ ...draft }),
      id: `signal-${draft.type}-${Date.now().toString(36)}`,
    };
    setRoom(nextRoom);
    setOffers([]);
    setRole("organizer");
  }

  function simulateDeadline() {
    setRoom((current) => ({
      ...current,
      deadlineAt: Date.now() - 1000,
      status: "ready",
    }));
    setNow(Date.now());
  }

  function revealOffers() {
    if (!deadlinePassed || room.status === "selected") return;
    setOffers((current) => current.map((entry) => ({ ...entry, revealed: true })));
    setRoom((current) => ({
      ...current,
      status: "revealed",
      revealedAt: Date.now(),
    }));
  }

  function submitOffer() {
    if (!providerName.trim()) return;
    const newOffer: SignalOffer = {
      id: `provider-${Date.now().toString(36)}`,
      provider: providerName.trim(),
      providerMeta: providerMeta.trim() || "Invited provider",
      submittedAt: Date.now(),
      source: "demo",
      revealed: false,
      data: { ...offer } as SignalOfferData,
    };
    setOffers((current) => [...current, newOffer]);
    setRole("provider");
  }

  function selectProvider(providerId: string) {
    setRoom((current) => ({
      ...current,
      selectedProviderId: providerId,
      status: "selected",
    }));
  }

  async function copyRoomLink() {
    const url = `${window.location.origin}${window.location.pathname}#/pilot/the-signal`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  const statusLabel = {
    collecting: "Collecting offers",
    ready: "Deadline reached",
    revealed: "Offers revealed",
    selected: "Provider selected",
  }[room.status];

  const progress = [
    { label: "Create deal", done: true },
    { label: "Private offers", done: offers.length > 0 },
    { label: "Deadline", done: deadlinePassed },
    { label: "Reveal", done: revealed },
    { label: "Select", done: room.status === "selected" },
  ];

  return (
    <main className="signal-pilot-page">
      <nav className="signal-pilot-nav">
        <button type="button" className="brand-link" onClick={goHome}>
          <img src={LOGO_SRC} alt="" />
          <span>Sub Rosa</span>
        </button>
        <div className="signal-pilot-nav-actions">
          <span className="signal-pilot-network">Standalone pilot environment</span>
          <a href="#/docs" className="secondary-action compact">Docs</a>
          <a href="#/pilot" className="secondary-action compact">Live ReceiptOnly workspace</a>
        </div>
      </nav>

      <section className="signal-pilot-hero">
        <div>
          <span className="signal-pilot-kicker"><ShieldCheck size={15} /> The Signal-style deal flow</span>
          <h1>Confidential offers.<br /><em>Clear decisions.</em></h1>
          <p>Run a simple OTC or loan deal room with private provider offers, a shared deadline, and an organizer-owned selection.</p>
          <div className="signal-pilot-boundary"><KeyRound size={15} /> Demo-layer state · ReceiptOnly pattern · no escrow · no The Signal production integration</div>
        </div>
        <div className="signal-pilot-hero-actions">
          <button type="button" className="primary-action" onClick={() => setRole("organizer")}><Users size={16} />Open organizer view</button>
          <button type="button" className="secondary-action" onClick={() => setRole("provider")}><LockKeyhole size={16} />Submit as provider</button>
        </div>
      </section>

      <section className="signal-pilot-flow" aria-label="Deal flow">
        {progress.map((step, index) => (
          <div className={step.done ? "done" : ""} key={step.label}>
            <span>{step.done ? <CheckCircle2 size={15} /> : index + 1}</span>
            <strong>{step.label}</strong>
            {index < progress.length - 1 && <ArrowRight size={15} aria-hidden="true" />}
          </div>
        ))}
      </section>

      <section className="signal-pilot-layout">
        <div className="signal-pilot-primary">
          <section className="signal-panel signal-deal-panel">
            <div className="signal-panel-heading">
              <div><span>Organizer request</span><h2>Deal room setup</h2></div>
              <div className="signal-template-switch" role="tablist" aria-label="Deal type">
                <button type="button" className={draft.type === "otc" ? "active" : ""} onClick={() => switchType("otc")}>OTC deal</button>
                <button type="button" className={draft.type === "loan" ? "active" : ""} onClick={() => switchType("loan")}>Loan deal</button>
              </div>
            </div>
            <div className="signal-form">
              <label>Deal title<input value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} /></label>
              {draft.type === "otc" ? (
                <div className="signal-form-grid">
                  <label>Side<select value={draft.side} onChange={(event) => updateDraft("side", event.target.value as DealDraft["side"])}><option value="buy">Buy</option><option value="sell">Sell</option></select></label>
                  <label>Asset<input value={draft.asset} onChange={(event) => updateDraft("asset", event.target.value)} /></label>
                  <label>Target amount<input value={draft.targetAmount} onChange={(event) => updateDraft("targetAmount", event.target.value)} /></label>
                  <label>Settlement window<input value={draft.settlementWindow} onChange={(event) => updateDraft("settlementWindow", event.target.value)} /></label>
                </div>
              ) : (
                <div className="signal-form-grid">
                  <label>Requested amount<input value={draft.requestedAmount} onChange={(event) => updateDraft("requestedAmount", event.target.value)} /></label>
                  <label>Asset<input value={draft.asset} onChange={(event) => updateDraft("asset", event.target.value)} /></label>
                  <label>Duration<input value={draft.duration} onChange={(event) => updateDraft("duration", event.target.value)} /></label>
                  <label>Purpose<input value={draft.purpose} onChange={(event) => updateDraft("purpose", event.target.value)} /></label>
                </div>
              )}
              <label>Organizer notes<textarea value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} rows={3} /></label>
              <div className="signal-form-actions"><button type="button" className="primary-action" onClick={createDeal}><FileCheck2 size={16} />Create deal room</button><button type="button" className="secondary-action" onClick={resetRoom}><RotateCcw size={16} />Reset sample</button></div>
              <p className="signal-helper">Application metadata is stored locally for this pilot. Confidential offer fields are kept out of the organizer view until reveal.</p>
            </div>
          </section>

          <section className="signal-panel signal-request-panel">
            <div className="signal-panel-heading"><div><span>Deal room</span><h2>{draft.title}</h2></div><span className={`signal-status ${room.status}`}>{statusLabel}</span></div>
            <div className="signal-request-body">
              <div className="signal-request-summary"><dl>{dealRows(draft).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "Not set"}</dd></div>)}</dl><p>{draft.notes}</p></div>
              <div className="signal-room-meta"><div><span>Room</span><code>{shortId(room.id)}</code></div><div><span>Deadline</span><strong>{formatDeadline(room.deadlineAt, now)}</strong></div><div><span>Mode</span><strong>ReceiptOnly</strong></div><div><span>Escrow</span><strong>None</strong></div><button type="button" className="secondary-action compact" onClick={copyRoomLink}><Clipboard size={15} />{copied ? "Copied" : "Copy room link"}</button></div>
            </div>
          </section>
        </div>

        <aside className="signal-pilot-sidebar">
          <section className="signal-panel signal-role-panel">
            <div className="signal-panel-heading"><div><span>Deal room role</span><h2>{role === "organizer" ? "Organizer view" : "Provider view"}</h2></div><span className="signal-demo-badge">SAMPLE MODE</span></div>
            <div className="signal-role-switch"><button type="button" className={role === "organizer" ? "active" : ""} onClick={() => setRole("organizer")}>Organizer</button><button type="button" className={role === "provider" ? "active" : ""} onClick={() => setRole("provider")}>Provider</button></div>
            {role === "organizer" ? (
              <div className="signal-organizer-view">
                <div className="signal-stat-row"><div><span>Providers submitted</span><strong>{offers.length}</strong></div><div><span>Offers visible</span><strong>{revealed ? visibleOffers.length : "Hidden"}</strong></div></div>
                <div className="signal-private-state"><LockKeyhole size={18} /><div><strong>{revealed ? "Offers are now visible" : "Offers stay private until the deadline"}</strong><p>{revealed ? "Every valid offer opened together. Selection remains an organizer decision." : "Provider names and submission count are public. Rate, amount, timeline, and terms are not."}</p></div></div>
                <div className="signal-provider-list">{offers.map((entry) => <div key={entry.id}><span className="signal-provider-dot" /> <div><strong>{entry.provider}</strong><span>{entry.providerMeta}</span></div><code>{entry.revealed ? "revealed" : "sealed"}</code></div>)}</div>
                <div className="signal-organizer-actions">{!deadlinePassed && <button type="button" className="secondary-action" onClick={simulateDeadline}><UnlockKeyhole size={16} />Simulate deadline</button>}{deadlinePassed && !revealed && <button type="button" className="primary-action" onClick={revealOffers}><UnlockKeyhole size={16} />Reveal offers</button>}{revealed && <span className="signal-reveal-note"><CheckCircle2 size={15} />All offers opened together</span>}</div>
              </div>
            ) : (
              <div className="signal-provider-view">
                <div className="signal-provider-callout"><LockKeyhole size={18} /><p>Only your offer is visible in this view. The organizer sees a sealed submission until the deadline.</p></div>
                <div className="signal-form">
                  <label>Provider name<input value={providerName} onChange={(event) => setProviderName(event.target.value)} /></label>
                  <label>Desk or provider type<input value={providerMeta} onChange={(event) => setProviderMeta(event.target.value)} /></label>
                  {draft.type === "otc" ? (
                    <>
                      <label>Price / rate<input placeholder="0.00001350 USDC / XLM" value={(offer as OtcOffer).rate} onChange={(event) => updateOffer("rate", event.target.value)} /></label>
                      <label>Available amount<input placeholder="100,000 USDC" value={(offer as OtcOffer).amount} onChange={(event) => updateOffer("amount", event.target.value)} /></label>
                      <label>Settlement timeline<input placeholder="T+1" value={(offer as OtcOffer).timeline} onChange={(event) => updateOffer("timeline", event.target.value)} /></label>
                      <label>Terms<textarea placeholder="Quote validity, venue, conditions" value={(offer as OtcOffer).terms} onChange={(event) => updateOffer("terms", event.target.value)} rows={2} /></label>
                      <label>Notes<textarea placeholder="Optional private notes" value={(offer as OtcOffer).notes} onChange={(event) => updateOffer("notes", event.target.value)} rows={2} /></label>
                    </>
                  ) : (
                    <>
                      <label>Interest rate<input placeholder="8.5% APR" value={(offer as LoanOffer).interestRate} onChange={(event) => updateOffer("interestRate", event.target.value)} /></label>
                      <label>Available amount<input placeholder="250,000 USDC" value={(offer as LoanOffer).amount} onChange={(event) => updateOffer("amount", event.target.value)} /></label>
                      <label>Duration<input placeholder="30 days" value={(offer as LoanOffer).duration} onChange={(event) => updateOffer("duration", event.target.value)} /></label>
                      <label>Collateral requirements<textarea placeholder="Collateral and monitoring terms" value={(offer as LoanOffer).collateral} onChange={(event) => updateOffer("collateral", event.target.value)} rows={2} /></label>
                      <label>Terms<textarea placeholder="Optional offer terms" value={(offer as LoanOffer).terms} onChange={(event) => updateOffer("terms", event.target.value)} rows={2} /></label>
                      <label>Notes<textarea placeholder="Optional private notes" value={(offer as LoanOffer).notes} onChange={(event) => updateOffer("notes", event.target.value)} rows={2} /></label>
                    </>
                  )}
                  <button type="button" className="primary-action" onClick={submitOffer} disabled={deadlinePassed}><LockKeyhole size={16} />Submit private offer</button>
                </div>
                <p className="signal-helper">Sample mode records a demo-layer sealed offer. It does not claim an on-chain transaction.</p>
              </div>
            )}
          </section>
        </aside>

        {revealed && (
          <section className="signal-panel signal-offers-panel">
            <div className="signal-panel-heading"><div><span>After the deadline</span><h2>Compare revealed offers</h2></div><span className="signal-reveal-note"><UnlockKeyhole size={15} />Permissionless reveal</span></div>
            <div className="signal-offer-grid">
              {visibleOffers.map((entry) => (
                <article className={`signal-offer ${room.selectedProviderId === entry.id ? "selected" : ""}`} key={entry.id}>
                  <div className="signal-offer-heading"><div><span>{entry.providerMeta}</span><h3>{entry.provider}</h3></div>{room.selectedProviderId === entry.id && <span className="signal-selected-badge"><CheckCircle2 size={14} />Selected</span>}</div>
                  <dl>{offerFieldRows(entry, draft.type).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
                  <button type="button" className={room.selectedProviderId === entry.id ? "secondary-action compact" : "primary-action compact"} onClick={() => selectProvider(entry.id)} disabled={room.status === "selected" && room.selectedProviderId !== entry.id}>{room.selectedProviderId === entry.id ? "Selected provider" : "Select provider"}<ArrowRight size={15} /></button>
                </article>
              ))}
            </div>
            <p className="signal-selection-note"><ShieldCheck size={15} />The protocol reveals the submitted set. The organizer's provider selection is an off-chain business decision.</p>
          </section>
        )}

        {revealed && (
          <section className="signal-panel signal-receipt-panel">
            <div className="signal-panel-heading"><div><span>Verifiable record</span><h2>Pilot receipt</h2></div><FileCheck2 size={20} /></div>
            <div className="signal-receipt-grid"><dl><div><dt>Deal type</dt><dd>{draft.type === "otc" ? "OTC" : "Loan"}</dd></div><div><dt>Room ID</dt><dd><code>{room.id}</code></dd></div><div><dt>Protocol mode</dt><dd>ReceiptOnly</dd></div><div><dt>Submissions</dt><dd>{offers.length}</dd></div></dl><dl><div><dt>Reveal status</dt><dd>{room.revealedAt ? `Revealed ${new Date(room.revealedAt).toLocaleString()}` : "Revealed"}</dd></div><div><dt>Selected provider</dt><dd>{selectedOffer?.provider ?? "Not selected"}</dd></div><div><dt>On-chain round</dt><dd>{room.roundId ?? "Not created in sample mode"}</dd></div><div><dt>Stellar transactions</dt><dd>{room.roundId ? "Available from live ReceiptOnly round" : "None claimed"}</dd></div></dl></div>
            <div className="signal-receipt-footer"><p>This sample room is a standalone validation surface for the workflow. For real ReceiptOnly commits, reveal, and transaction-backed receipts, open the existing live workspace.</p><a href="#/pilot" className="secondary-action compact">Open live ReceiptOnly workspace<ArrowRight size={15} /></a></div>
          </section>
        )}
      </section>

      <footer className="signal-pilot-footer"><span><KeyRound size={14} />Standalone pilot environment</span><span>This mimics a confidential deal-flow workflow and does not require integration with The Signal's production systems.</span><a href="#/docs">Read the integration docs<X size={13} /></a></footer>
    </main>
  );
}
