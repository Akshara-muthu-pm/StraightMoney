"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

// Startup Example Cases Data
interface StartupMilestone {
  step: string;
  name: string;
  amount: string;
  vendor: string;
  vendorEmail: string;
  evidence: string;
  status: "completed" | "in_review" | "locked";
}

interface StartupCase {
  id: string;
  title: string;
  tagline: string;
  sector: string;
  sectorColor: string;
  team: string;
  goal: string;
  funded: string;
  percent: number;
  image: string;
  problem: string;
  solution: string;
  milestones: StartupMilestone[];
}

const startupCases: StartupCase[] = [
  {
    id: "aerodrone",
    title: "AeroDrone Ag",
    tagline: "Autonomous Precision Crop Spraying & Health Drone",
    sector: "AgTech & Robotics",
    sectorColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    team: "AeroSky BioSystems Lab",
    goal: "$12,500.00",
    funded: "$8,300.00",
    percent: 66,
    image: "/images/hero-growing.jpg",
    problem:
      "Conventional drone startups burn 80% of angel capital before airframes and motor ESC units are even tested, leading to high failure rates.",
    solution:
      "Capital is locked in PayPal Sandbox balance. Funds disburse in tranches only after airframe dimensional test reports and motor bench test photos pass AI and human review.",
    milestones: [
      {
        step: "Milestone 1",
        name: "Carbon-Fiber Airframe & Folding Arm Machining",
        amount: "$3,500.00",
        vendor: "AeroFab Machining Co.",
        vendorEmail: "aerofab@example.com",
        evidence: "Dimensional calibration test sheet + photo of machined carbon-fiber arms on weighing scale.",
        status: "completed",
      },
      {
        step: "Milestone 2",
        name: "High-Torque Brushless Motors & 80A ESC Units",
        amount: "$4,800.00",
        vendor: "TorqueDrive Dynamics",
        vendorEmail: "motors@example.com",
        evidence: "Bench thrust dynamometer test readout + unboxing photo of all 8 motor sets with serial numbers.",
        status: "in_review",
      },
      {
        step: "Milestone 3",
        name: "Multispectral Crop Health Sensor & Telemetry Pack",
        amount: "$4,200.00",
        vendor: "SpectraVision Labs",
        vendorEmail: "spectravision@example.com",
        evidence: "Camera calibration certificate + sample NDVI infrared crop imagery captured on test flight.",
        status: "locked",
      },
    ],
  },
  {
    id: "solarihydro",
    title: "SolariHydro",
    tagline: "Decentralized Solar-Powered Water Purification",
    sector: "CleanTech & IoT",
    sectorColor: "bg-blue-100 text-[#003087] dark:bg-blue-950 dark:text-blue-300",
    team: "AquaPure Dynamics",
    goal: "$8,000.00",
    funded: "$8,000.00",
    percent: 100,
    image: "/images/hero-planning.jpg",
    problem:
      "Off-grid water projects frequently fail when organizers buy cheap commercial filters instead of laboratory-grade nanofiltration membranes.",
    solution:
      "Earmarked line items ensure funds disburse directly to verified ceramic membrane suppliers and certified electronics fabricators upon proof.",
    milestones: [
      {
        step: "Milestone 1",
        name: "Custom Solar MPPT & Water Flow Sensor PCB Batch",
        amount: "$2,200.00",
        vendor: "CircuitCore Fabrication",
        vendorEmail: "pcb@example.com",
        evidence: "SMT automated optical inspection (AOI) report + photo of packaged microcontroller boards.",
        status: "completed",
      },
      {
        step: "Milestone 2",
        name: "Nanofiltration Ceramic Cartridge Batch (50 Units)",
        amount: "$3,400.00",
        vendor: "AquaMembrane Supplies",
        vendorEmail: "filters@example.com",
        evidence: "Bacterial log-reduction laboratory cert + photo of 50 sealed ceramic cartridges.",
        status: "completed",
      },
      {
        step: "Milestone 3",
        name: "Weatherproof IP67 Solar Enclosure Tooling & Molds",
        amount: "$2,400.00",
        vendor: "RapidMold Enclosures",
        vendorEmail: "enclosures@example.com",
        evidence: "Submersion waterproof test video + photo of molded solar top-shell housing.",
        status: "completed",
      },
    ],
  },
  {
    id: "neuroglove",
    title: "NeuroGlove",
    tagline: "Tactile Haptic Rehabilitation Glove for Stroke Patients",
    sector: "MedTech & Bio",
    sectorColor: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
    team: "NeuroRehab Innovations Lab",
    goal: "$15,000.00",
    funded: "$5,200.00",
    percent: 35,
    image: "/images/impact-together.jpg",
    problem:
      "Wearable medical startups often burn software R&D budgets before biocompatible textiles and haptic micro-actuators are physically delivered.",
    solution:
      "StraightMoney pays fabric mills and micro-actuator suppliers directly via PayPal Payouts, leaving zero risk of diverted funds.",
    milestones: [
      {
        step: "Milestone 1",
        name: "Micro-Linear Haptic Actuator Modules (Batch of 20)",
        amount: "$5,200.00",
        vendor: "HapticPrecision Corp",
        vendorEmail: "haptics@example.com",
        evidence: "Force-displacement measurement test data + photo of precision micro-actuator array.",
        status: "completed",
      },
      {
        step: "Milestone 2",
        name: "Conductive Smart Fabric & Ergonomic Glove Weaves",
        amount: "$3,800.00",
        vendor: "BioTex Smart Weaves",
        vendorEmail: "textiles@example.com",
        evidence: "Skin-contact biocompatibility test report + photo of tailored conductive textile prototypes.",
        status: "in_review",
      },
      {
        step: "Milestone 3",
        name: "Ultra-Low Latency IMU Tracking Sensor Boards",
        amount: "$6,000.00",
        vendor: "Apex MicroSystems",
        vendorEmail: "apex@example.com",
        evidence: "Bluetooth 5.4 packet latency test + photo of assembled 9-axis sensor boards.",
        status: "locked",
      },
    ],
  },
  {
    id: "mycofoam",
    title: "MycoFoam",
    tagline: "100% Biodegradable Mycelium Packaging & Thermal Insulation",
    sector: "Circular Economy",
    sectorColor: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    team: "MycoCycle BioWorks",
    goal: "$6,500.00",
    funded: "$2,800.00",
    percent: 43,
    image: "/images/idea-community.jpg",
    problem:
      "Green packaging companies face high mold fabrication tooling costs. Backers worry founders will fail to produce durable industrial molds.",
    solution:
      "Milestone 1 funds only the mold tooling shop; milestone 2 unlocks organic substrate only when molds physically arrive.",
    milestones: [
      {
        step: "Milestone 1",
        name: "Aluminum Thermal Compression Molds (Set of 4)",
        amount: "$2,800.00",
        vendor: "AluMold Precision Tooling",
        vendorEmail: "tooling@example.com",
        evidence: "CNC coordinate measuring inspection + photo of aluminum molds with engraved lot numbers.",
        status: "completed",
      },
      {
        step: "Milestone 2",
        name: "Organic Agricultural Byproduct Substrate (2 Tons)",
        amount: "$1,900.00",
        vendor: "BioResidue Supply Co.",
        vendorEmail: "biomass@example.com",
        evidence: "Agricultural grain delivery bill of lading + warehouse receipt photo of packaged substrate.",
        status: "in_review",
      },
      {
        step: "Milestone 3",
        name: "ASTM C518 Thermal Testing & Lab Biodegradation Cert",
        amount: "$1,800.00",
        vendor: "InterCert Testing Labs",
        vendorEmail: "testing@example.com",
        evidence: "Certified ASTM R-value insulation report + soil biodegradation analysis sheet.",
        status: "locked",
      },
    ],
  },
];

export default function StartupsPage() {
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [selectedCase, setSelectedCase] = useState<StartupCase>(startupCases[0]);
  const [activeSector, setActiveSector] = useState<string>("All");
  const [simulatedMilestone, setSimulatedMilestone] = useState<string | null>(null);

  // Proposal Builder State
  const [founderIdea, setFounderIdea] = useState("");
  const [founderGoal, setFounderGoal] = useState("10000");
  const [proposalSubmitted, setProposalSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (waitlistEmail.trim()) {
      setSubscribed(true);
    }
  };

  const handleSimulateVerification = (stepName: string) => {
    setSimulatedMilestone(stepName);
    setTimeout(() => {
      setSimulatedMilestone(null);
    }, 4000);
  };

  const filteredCases = activeSector === "All"
    ? startupCases
    : startupCases.filter((c) => c.sector.toLowerCase().includes(activeSector.toLowerCase()));

  return (
    <main id="main-content" tabIndex={-1} className="page-width py-8 sm:py-12 space-y-12">
      {/* 1. Navigation Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/explore"
          className="group inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-xs font-bold text-slate-700 shadow-xs transition hover:border-blue-200 hover:bg-white hover:text-[#003087] dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <span className="transition duration-200 group-hover:-translate-x-0.5">&larr;</span>
          <span>Back to Explore Options</span>
        </Link>

        <Link
          href="/explore/public-causes"
          className="text-xs font-bold text-[#003087] hover:text-[#0070BA] dark:text-blue-400 underline underline-offset-4"
        >
          Browse active public causes instead &rarr;
        </Link>
      </div>

      {/* 2. Hero Section */}
      <section
        className="overflow-hidden rounded-[2.5rem] border border-white/80 bg-gradient-to-br from-[#001435] via-[#002B66] to-[#00457C] p-8 text-white shadow-2xl dark:border-slate-800 sm:p-14"
        aria-labelledby="startups-hero-title"
      >
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-black tracking-wider text-[#BAE0FC] backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-[#FFC439]" aria-hidden="true" />
              STARTUP MILESTONE ESCROW &middot; EXAMPLE CASES
            </div>

            <h1
              id="startups-hero-title"
              className="display-heading mt-6 text-3xl sm:text-4xl lg:text-5xl text-white font-extrabold tracking-tight leading-tight"
            >
              Milestone escrow for hardware &amp; venture builders.
            </h1>

            <p className="mt-5 text-base leading-relaxed text-blue-100 sm:text-lg">
              StraightMoney eliminates the lump-sum risk in venture crowdfunding. Backers pledge into PayPal Sandbox escrow; capital is paid directly to prototyping labs, component suppliers, and fabricators only when verifiable deliverables pass AI and policy checks.
            </p>

            {/* Startup Backer Actions */}
            <div className="mt-8 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/campaigns/2#donate"
                  className="button-gold rounded-full px-6 py-3.5 text-xs font-black shadow-lg shadow-[#FFC439]/30 transition hover:scale-105 inline-flex items-center gap-2"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  <span>Donate via PayPal &rarr; Back AeroDrone Ag ($25+)</span>
                </Link>
                <Link
                  href="/campaigns/2"
                  className="rounded-full border border-white/30 bg-white/10 px-5 py-3.5 text-xs font-bold text-white backdrop-blur-md transition hover:bg-white/20"
                >
                  View Active Campaign
                </Link>
              </div>

              {/* Waitlist Subscription Box */}
              <div className="max-w-md pt-2">
                {subscribed ? (
                  <div className="rounded-2xl border border-emerald-400/50 bg-emerald-950/70 p-3.5 text-emerald-200 backdrop-blur-md">
                    <p className="text-xs font-black uppercase tracking-wider text-emerald-400">
                      ✓ You&apos;re on the early-access backer list!
                    </p>
                    <p className="mt-1 text-xs text-emerald-100/90">
                      We&apos;ll notify you at <strong className="text-white">{waitlistEmail}</strong> when new startup milestone escrow rounds open.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 sm:flex-row">
                    <input
                      type="email"
                      required
                      value={waitlistEmail}
                      onChange={(e) => setWaitlistEmail(e.target.value)}
                      placeholder="Enter email for backer alerts..."
                      className="flex-1 rounded-full border border-white/30 bg-white/15 px-4 py-3 text-xs text-white placeholder:text-blue-200 focus:border-[#FFC439] focus:bg-white/20 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="rounded-full border border-white/30 bg-white/15 px-5 py-3 text-xs font-bold text-white transition hover:bg-white/25"
                    >
                      Get Alerts
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>

          {/* Hero Visual Card */}
          <div className="relative min-h-[300px] overflow-hidden rounded-3xl border border-white/15 shadow-inner sm:min-h-[400px]">
            <Image
              src="/images/hero-planning.jpg"
              alt="Hardware engineers and venture founders collaborating around component prototypes"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#001435]/90 via-[#001435]/30 to-transparent" />
            
            <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/20 bg-[#001435]/85 p-4 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#FFC439]">
                  Zero Lump-Sum Disbursals
                </span>
                <span className="text-[10px] font-bold text-emerald-400">
                  PayPal Payouts Protected
                </span>
              </div>
              <p className="mt-1 text-xs font-medium text-blue-100">
                Founders never hold pooled cash. Only verified invoices and test reports trigger milestone payouts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Interactive Startup Example Cases Gallery */}
      <section className="space-y-6" aria-labelledby="example-cases-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Real-World Case Studies</p>
            <h2 id="example-cases-heading" className="display-heading mt-2 text-3xl sm:text-4xl text-[#001435] dark:text-white">
              Example Startup Campaigns
            </h2>
          </div>

          {/* Sector Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filter by startup sector">
            {["All", "Robotics", "CleanTech", "MedTech", "Circular"].map((sector) => (
              <button
                key={sector}
                type="button"
                onClick={() => setActiveSector(sector)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                  activeSector === sector
                    ? "bg-[#003087] text-white shadow-xs dark:bg-[#0070BA]"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {sector}
              </button>
            ))}
          </div>
        </div>

        {/* 4 Example Cases Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {filteredCases.map((c) => {
            const isSelected = selectedCase.id === c.id;
            return (
              <article
                key={c.id}
                onClick={() => setSelectedCase(c)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedCase(c);
                  }
                }}
                className={`surface-card group cursor-pointer overflow-hidden rounded-[2rem] border transition duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 ${
                  isSelected
                    ? "ring-2 ring-[#0070BA] border-blue-300 dark:border-blue-500"
                    : "border-white/80"
                }`}
              >
                <div className="relative h-44 w-full bg-slate-100">
                  <Image
                    src={c.image}
                    alt={c.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 25vw"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#001435]/70 via-transparent to-transparent" />
                  
                  <div className="absolute left-3 top-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${c.sectorColor}`}>
                      {c.sector}
                    </span>
                  </div>

                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <p className="text-[10px] font-bold text-blue-200">{c.team}</p>
                    <h3 className="text-lg font-black">{c.title}</h3>
                  </div>
                </div>

                <div className="p-5 flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 line-clamp-2">
                      {c.tagline}
                    </p>

                    <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="font-black text-[#001435] dark:text-white">{c.funded}</span>
                        <span className="text-[10px] text-slate-500">Goal {c.goal}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                        <div
                          className="h-full bg-gradient-to-r from-[#003087] to-[#0070BA]"
                          style={{ width: `${c.percent}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{c.milestones.length} Milestones</span>
                      <span className="font-bold text-[#0070BA] dark:text-blue-400">
                        {isSelected ? "Selected ✓" : "Inspect →"}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Deep-Dive Interactive Milestone Inspector for Selected Case */}
        {selectedCase && (
          <div className="surface-card overflow-hidden rounded-[2.5rem] border border-blue-200/80 bg-white/90 p-6 sm:p-10 shadow-xl dark:border-slate-800 dark:bg-slate-900/90">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-6 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-extrabold uppercase ${selectedCase.sectorColor}`}>
                    {selectedCase.sector}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    Organized by <strong className="text-slate-800 dark:text-slate-200">{selectedCase.team}</strong>
                  </span>
                </div>
                <h3 className="mt-3 text-2xl font-extrabold text-[#001435] dark:text-white sm:text-3xl">
                  {selectedCase.title}: {selectedCase.tagline}
                </h3>
              </div>

              <div className="flex flex-col items-end gap-2.5">
                <div className="rounded-2xl border border-slate-200/90 bg-slate-50 p-4 text-right dark:border-slate-700 dark:bg-slate-800">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Target Escrow Cap
                  </span>
                  <p className="text-2xl font-black text-[#001435] dark:text-white">{selectedCase.goal}</p>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {selectedCase.percent}% Backed in Sandbox
                  </span>
                </div>
                <Link
                  href="/campaigns/2#donate"
                  className="button-gold rounded-full px-5 py-2.5 text-xs font-black shadow-md shadow-[#FFC439]/30 transition hover:scale-105 inline-flex items-center gap-1.5"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  <span>Donate via PayPal &rarr; Back Case</span>
                </Link>
              </div>
            </div>

            {/* Problem & Zero-Theft Architecture Solution */}
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
                <h4 className="text-xs font-black uppercase tracking-wider text-rose-900 dark:text-rose-300">
                  The Startup Risk Being Solved:
                </h4>
                <p className="mt-1.5 text-xs leading-relaxed text-rose-900/80 dark:text-rose-200/80">
                  {selectedCase.problem}
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                  The StraightMoney Escrow Solution:
                </h4>
                <p className="mt-1.5 text-xs leading-relaxed text-emerald-900/80 dark:text-emerald-200/80">
                  {selectedCase.solution}
                </p>
              </div>
            </div>

            {/* Interactive Milestone Escrow Roadmap */}
            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold uppercase tracking-widest text-[#003087] dark:text-[#38bdf8]">
                  Milestone Escrow Tranche Roadmap ({selectedCase.milestones.length} Tranches)
                </h4>
                <span className="text-[11px] text-slate-400">
                  PayPal Payouts Disbursed Directly to Suppliers
                </span>
              </div>

              <div className="space-y-3">
                {selectedCase.milestones.map((m) => {
                  const isSimulating = simulatedMilestone === m.step;

                  return (
                    <div
                      key={m.step}
                      className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-800/80"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                              m.status === "completed"
                                ? "bg-emerald-500 text-white"
                                : m.status === "in_review"
                                ? "bg-amber-400 text-slate-900"
                                : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {m.status === "completed" ? "✓" : m.status === "in_review" ? "⏳" : "🔒"}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                                {m.step}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.2 text-[9px] font-extrabold uppercase ${
                                  m.status === "completed"
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                    : m.status === "in_review"
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                    : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                                }`}
                              >
                                {m.status === "completed"
                                  ? "Paid to Supplier"
                                  : m.status === "in_review"
                                  ? "Evidence In Review"
                                  : "Locked in Escrow"}
                              </span>
                            </div>
                            <h5 className="text-sm font-bold text-[#001435] dark:text-white">{m.name}</h5>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-base font-black text-[#0070BA] dark:text-[#38bdf8]">{m.amount}</span>
                          <span className="block text-[10px] text-slate-400">Earmarked Tranche</span>
                        </div>
                      </div>

                      {/* Supplier & Verification Details */}
                      <div className="mt-3.5 grid gap-2 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-900/60 sm:grid-cols-2">
                        <div>
                          <span className="font-bold text-slate-600 dark:text-slate-400">Assigned Supplier:</span>{" "}
                          <strong className="text-[#001435] dark:text-white">{m.vendor}</strong>
                          <span className="block text-[10px] text-slate-400">
                            Registered PayPal Payout Email: <code className="text-[#003087] dark:text-blue-300">{m.vendorEmail}</code>
                          </span>
                        </div>

                        <div>
                          <span className="font-bold text-slate-600 dark:text-slate-400">Required Deliverable Evidence:</span>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300">{m.evidence}</p>
                        </div>
                      </div>

                      {/* Interactive Simulation Action Button */}
                      {m.status === "in_review" && (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
                          <p className="text-[11px] text-amber-800 dark:text-amber-300">
                            Supplier submitted invoice &amp; evidence. Gemini OCR + 8 Python checks passed.
                          </p>
                          <button
                            type="button"
                            onClick={() => handleSimulateVerification(m.step)}
                            disabled={isSimulating}
                            className="rounded-full bg-[#003087] px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#00457C] transition disabled:opacity-50 dark:bg-[#0070BA]"
                          >
                            {isSimulating ? "Processing PayPal Payout..." : "Simulate Verifier Approval →"}
                          </button>
                        </div>
                      )}

                      {/* Simulation Toast */}
                      {isSimulating && (
                        <div className="mt-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-900 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200">
                          <strong className="font-bold">✓ Simulation Successful:</strong> Gemini verified invoice matches {m.vendorEmail}. Human verifier signed. PayPal Sandbox Payout of {m.amount} disbursed to {m.vendor}!
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 4. Interactive Proposal Builder for Early-Stage Founders */}
      <section className="overflow-hidden rounded-[2.5rem] border border-white/80 bg-white/70 p-8 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/60 sm:p-12">
        <div className="text-center max-w-2xl mx-auto">
          <p className="eyebrow">Are You Building a Startup?</p>
          <h2 className="display-heading mt-2 text-3xl sm:text-4xl text-[#001435] dark:text-white">
            Draft Your Milestone Escrow Budget
          </h2>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            See how your venture can raise capital without asking backers for blind faith. Split your target budget into three verifiable supplier deliverables.
          </p>
        </div>

        <div className="mt-8 max-w-xl mx-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800">
          {proposalSubmitted ? (
            <div className="text-center p-6 space-y-3">
              <span className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-xl font-bold">
                ✓
              </span>
              <h3 className="text-lg font-bold text-[#001435] dark:text-white">
                Milestone Escrow Draft Created!
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Your proposal for <strong>{founderIdea || "Your Venture"}</strong> with a target of <strong>${Number(founderGoal).toLocaleString()}</strong> has been drafted. Once reviewed by our sandbox verifiers, your campaign will be eligible for backer pledges.
              </p>
              <button
                type="button"
                onClick={() => setProposalSubmitted(false)}
                className="button-secondary text-xs mt-3"
              >
                Edit Proposal Draft
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setProposalSubmitted(true);
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Venture / Prototype Name:
                </label>
                <input
                  type="text"
                  required
                  value={founderIdea}
                  onChange={(e) => setFounderIdea(e.target.value)}
                  placeholder="e.g. BioSensor IoT, MicroWind Turbine, Smart Prosthetic"
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs font-medium dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Target Prototyping Budget ($):
                </label>
                <input
                  type="number"
                  required
                  min="500"
                  max="100000"
                  value={founderGoal}
                  onChange={(e) => setFounderGoal(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs font-medium dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div className="rounded-xl bg-blue-50/70 p-3 text-[11px] text-[#003087] dark:bg-slate-900 dark:text-blue-300">
                <p className="font-bold">Automated Milestone Escrow Split:</p>
                <ul className="mt-1 space-y-1">
                  <li>• Milestone 1 (Prototyping Labs &amp; Materials): <strong>${Math.round(Number(founderGoal) * 0.35).toLocaleString()}</strong></li>
                  <li>• Milestone 2 (Sensor Assemblies &amp; Tooling): <strong>${Math.round(Number(founderGoal) * 0.40).toLocaleString()}</strong></li>
                  <li>• Milestone 3 (Testing &amp; Compliance Certification): <strong>${Math.round(Number(founderGoal) * 0.25).toLocaleString()}</strong></li>
                </ul>
              </div>

              <button
                type="submit"
                className="button-gold w-full py-3 text-xs font-black shadow-md shadow-[#FFC439]/30"
              >
                Draft Milestone Escrow Campaign &rarr;
              </button>
            </form>
          )}
        </div>
      </section>

      {/* 5. Bottom Switcher CTA to Public Causes */}
      <section className="text-center rounded-3xl border border-white/80 bg-white/70 p-8 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/60">
        <h3 className="text-xl font-bold text-[#001435] dark:text-white">
          Want to experience live transparent fundraising today?
        </h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Our public causes flow is running live with the School Library Corner campaign on PayPal Sandbox.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/explore/public-causes" className="button-gold text-xs font-black px-6 py-3 shadow-md shadow-[#FFC439]/30">
            Browse Live Public Causes &rarr;
          </Link>
          <Link href="/#how-it-works" className="button-primary text-xs px-6 py-3">
            See how payments work
          </Link>
        </div>
      </section>
    </main>
  );
}
