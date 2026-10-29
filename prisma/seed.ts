/**
 * Database seed.
 *
 *   npm run db:seed                      → full DEMO dataset (wipes existing data). Development only.
 *   SEED_MODE=catalog npm run db:seed    → only settings, catalog, hours and legal pages (upserts,
 *                                          no demo people). Safe for a first production deploy.
 *
 * Everything created here is demo content: customers use @example.com addresses and
 * `isDemo = true`, and gallery/service images live in /public/images/demo. Replace it from
 * the admin dashboard (or edit this file) before launch.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type AppointmentStatus, type GalleryCategory, type QuoteStatus } from "../src/generated/prisma/client";
import { calculatePrice, calculateTotals, type PricingCatalog } from "../src/lib/pricing/engine";
import { addDaysYmd, todayYmd, weekdayOfYmd, ymdToDateOnly, zonedToUtc } from "../src/lib/time";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const MODE = process.env.SEED_MODE === "catalog" ? "catalog" : "demo";
const TZ = "America/Los_Angeles";
const $ = (dollars: number) => Math.round(dollars * 100);

// Deterministic PRNG so the demo dataset is stable between runs.
let rngState = 20261001;
function rand() {
  rngState = (rngState * 1664525 + 1013904223) % 4294967296;
  return rngState / 4294967296;
}
const pick = <T,>(items: readonly T[]) => items[Math.floor(rand() * items.length)]!;
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const code = (n: number) => Array.from({ length: n }, () => ALPHABET[Math.floor(rand() * ALPHABET.length)]).join("");

// ─── Reference content ───────────────────────────────────────────────────────

const SETTINGS = {
  businessName: "Obsidian Tint Studio",
  tagline: "Premium automotive window tint",
  phone: "(555) 010-2040",
  email: "hello@obsidiantint.example",
  addressLine1: "1200 Ember Ave, Suite 4",
  city: "Los Angeles",
  state: "CA",
  postalCode: "90021",
  country: "US",
  latitude: 34.0335,
  longitude: -118.2386,
  instagramUrl: "https://instagram.com/",
  facebookUrl: "https://facebook.com/",
  tiktokUrl: "https://tiktok.com/",
  youtubeUrl: "https://youtube.com/",
  googleReviewsUrl: "https://google.com/maps",
  timezone: TZ,
  currency: "usd",
  taxRateBps: 825,
  depositPercent: 25,
  depositMinimum: $(50),
  requireDeposit: false,
  allowPayInFull: true,
  slotIntervalMinutes: 30,
  bufferMinutes: 15,
  minNoticeHours: 12,
  maxAdvanceDays: 60,
  holdMinutes: 30,
  reminderHoursBefore: 24,
  cancellationWindowHours: 24,
  shopCapacity: 2,
  cancellationPolicy:
    "Need to change plans? Reschedule or cancel online up to 24 hours before your appointment and your deposit is refunded in full. Cancellations inside 24 hours or missed appointments forfeit the deposit, which can be applied once toward a rebooking within 30 days.",
  warrantyInfo:
    "Every film installation includes a written warranty against bubbling, peeling, delaminating, cracking and fading. Carbon and ceramic films carry a lifetime warranty for as long as you own the vehicle; dyed film is covered for 5 years. Paint protection film is covered for 10 years and ceramic coatings for the length of the package you choose.",
  yearsInBusiness: 9,
  vehiclesCompleted: 6400,
  heroHeadline: "Premium Window Tint. Built for Your Drive.",
  heroSubheadline: "Professional automotive window tinting with premium films, expert installation, and a finish that lasts.",
};

const HOURS = [
  { dayOfWeek: 0, isOpen: false, openTime: "09:00", closeTime: "16:00" },
  { dayOfWeek: 1, isOpen: true, openTime: "08:00", closeTime: "18:00" },
  { dayOfWeek: 2, isOpen: true, openTime: "08:00", closeTime: "18:00" },
  { dayOfWeek: 3, isOpen: true, openTime: "08:00", closeTime: "18:00" },
  { dayOfWeek: 4, isOpen: true, openTime: "08:00", closeTime: "18:00" },
  { dayOfWeek: 5, isOpen: true, openTime: "08:00", closeTime: "18:00" },
  { dayOfWeek: 6, isOpen: true, openTime: "09:00", closeTime: "16:00" },
];

const VEHICLE_TYPES = [
  { slug: "coupe", name: "Coupe", description: "2-door cars and convertibles" },
  { slug: "sedan", name: "Sedan", description: "4-door cars, hatchbacks and wagons" },
  { slug: "suv", name: "SUV", description: "Crossovers and SUVs" },
  { slug: "truck", name: "Truck", description: "Pickups — regular, extended and crew cab" },
  { slug: "van", name: "Van", description: "Minivans and full-size vans" },
];

const VEHICLE_SIZES = [
  { slug: "compact", name: "Compact", description: "Small cars and 2-seaters", priceAdjustPercent: -10, durationAdjustPercent: -10 },
  { slug: "standard", name: "Standard", description: "Most mid-size vehicles", priceAdjustPercent: 0, durationAdjustPercent: 0 },
  { slug: "large", name: "Large", description: "Full-size and 3-row vehicles", priceAdjustPercent: 15, durationAdjustPercent: 15 },
  { slug: "xl", name: "Extra large", description: "Oversized vans, dually and lifted trucks", priceAdjustPercent: 30, durationAdjustPercent: 25 },
];

const FILMS = [
  {
    slug: "dyed",
    name: "Dyed",
    tagline: "Classic look, everyday comfort",
    description:
      "A multi-layer dyed film that delivers a deep, non-reflective finish and great privacy at an accessible price. Ideal for daily drivers and leased vehicles.",
    heatRejection: 40,
    uvRejection: 99,
    glareReduction: 55,
    warrantyYears: 5,
    shades: [5, 15, 20, 35, 50],
    features: ["Non-reflective matte-black look", "Blocks 99% of UV rays", "Reduces glare and adds privacy", "5-year warranty"],
  },
  {
    slug: "carbon",
    name: "Carbon",
    tagline: "Better heat rejection, will never fade",
    description:
      "Carbon particles are infused into the film for a true-black finish that never turns purple. Noticeably cooler cabin than dyed film, with zero signal interference.",
    heatRejection: 60,
    uvRejection: 99,
    glareReduction: 70,
    warrantyYears: 99,
    shades: [5, 15, 20, 35, 50],
    features: ["True-black, fade-proof finish", "Up to 60% infrared heat rejection", "No phone, GPS or radio interference", "Lifetime warranty"],
  },
  {
    slug: "ceramic",
    name: "Ceramic",
    tagline: "Maximum heat rejection and clarity",
    description:
      "Nano-ceramic technology rejects up to 88% of infrared heat without darkening the glass. The best comfort, clarity and UV protection available — even in lighter shades.",
    heatRejection: 88,
    uvRejection: 99,
    glareReduction: 80,
    warrantyYears: 99,
    shades: [5, 15, 20, 35, 50, 70],
    features: ["Up to 88% infrared heat rejection", "Crystal-clear optics day and night", "Protects skin and interior from UV", "Lifetime warranty"],
  },
] as const;

type OptionSeed = { key: string; name: string; description?: string; kind?: "COVERAGE" | "ADDON"; windowCount?: number; durationMinutes?: number; price?: number };

const WINDOW_TINT_OPTIONS: OptionSeed[] = [
  { key: "full", name: "Full Tint", description: "All side windows and the rear windshield", windowCount: 7, durationMinutes: 150 },
  { key: "front", name: "Front Windows", description: "Front driver and passenger windows (match your factory rear tint)", windowCount: 2, durationMinutes: 60 },
  { key: "rear", name: "Rear Windows", description: "Rear side windows, quarter glass and back windshield", windowCount: 5, durationMinutes: 90 },
  { key: "windshield", name: "Windshield", description: "Full front windshield (clear or light ceramic recommended)", windowCount: 1, durationMinutes: 90 },
  { key: "sunstrip", name: "Sun Strip", description: "5–6 inch visor strip across the top of the windshield", windowCount: 1, durationMinutes: 30 },
  { key: "fullvehicle", name: "Full Vehicle", description: "Every window including windshield and sun strip", windowCount: 9, durationMinutes: 210 },
  { key: "sunroof", name: "Sunroof", kind: "ADDON", durationMinutes: 20, price: $(69) },
  { key: "panoramic", name: "Panoramic Roof", kind: "ADDON", durationMinutes: 45, price: $(149) },
  { key: "removal", name: "Old Tint Removal", description: "Steam removal of existing film and adhesive", kind: "ADDON", durationMinutes: 60, price: $(99) },
];

// Prices in dollars: [dyed, carbon, ceramic]
const FULL_TINT: Record<string, [number, number, number]> = {
  coupe: [199, 279, 399],
  sedan: [229, 299, 449],
  suv: [259, 349, 499],
  truck: [209, 289, 419],
  van: [299, 399, 599],
};
const FULL_VEHICLE: Record<string, [number, number, number]> = {
  coupe: [329, 449, 649],
  sedan: [359, 479, 699],
  suv: [389, 529, 749],
  truck: [339, 459, 669],
  van: [429, 579, 849],
};
const FLAT_BY_FILM: Record<string, [number, number, number]> = {
  front: [99, 129, 179],
  rear: [149, 199, 279],
  windshield: [149, 199, 279],
  sunstrip: [49, 59, 79],
};
const TYPE_MULTIPLIER: Record<string, number> = { coupe: 1, sedan: 1, suv: 1.12, truck: 1.15, van: 1.2 };

const roundTo5 = (dollars: number) => Math.round(dollars / 5) * 5;

interface ServiceSeed {
  slug: string;
  name: string;
  category: "WINDOW_TINT" | "PAINT_PROTECTION" | "COATING" | "LIGHTING";
  tagline: string;
  shortDescription: string;
  description: string;
  benefits: string[];
  features: string[];
  image: string;
  startingPrice: number;
  durationMinutes: number;
  durationLabel: string;
  warranty: string;
  usesFilm?: boolean;
  film?: "dyed" | "carbon" | "ceramic";
  parent?: string;
  depositAmount?: number;
  featured?: boolean;
  options?: OptionSeed[];
  faqs: [string, string][];
}

const SERVICES: ServiceSeed[] = [
  {
    slug: "window-tint",
    name: "Automotive Window Tint",
    category: "WINDOW_TINT",
    tagline: "Cooler, darker, more private — done right",
    shortDescription: "Precision-cut window film installed dust-free, with your choice of dyed, carbon or ceramic film.",
    description:
      "Our signature service. Every pattern is computer-cut for your exact year, make and model, then heat-shrunk and installed in a climate-controlled, dust-free bay. The result is edge-to-edge coverage with no gaps, no bubbles and a factory-clean finish.\n\nChoose the film that fits your goals and budget — dyed for a classic look, carbon for a fade-proof true black, or ceramic for maximum heat rejection — and any legal shade from 5% to 70%.",
    benefits: ["Blocks 99% of harmful UV rays", "Keeps your cabin dramatically cooler", "Reduces glare for safer driving", "Adds privacy and security", "Protects upholstery from fading", "Holds shattered glass together"],
    features: ["Computer-cut patterns for your exact vehicle", "Dust-controlled installation bay", "Micro-edge finishing on roll-down windows", "Written lifetime warranty on carbon & ceramic"],
    image: "/images/demo/service-window-tint.jpg",
    startingPrice: $(199),
    durationMinutes: 150,
    durationLabel: "2–3 hours",
    warranty: "Lifetime warranty on carbon and ceramic film; 5 years on dyed film.",
    usesFilm: true,
    featured: true,
    options: WINDOW_TINT_OPTIONS,
    faqs: [
      ["Can I match my factory rear privacy glass?", "Yes. Choose “Front Windows” and we’ll match the front doors to your factory rear glass so the whole car looks uniform."],
      ["Do you remove old tint?", "Yes — add “Old Tint Removal” and we’ll steam off the old film and adhesive before installing new film."],
    ],
  },
  {
    slug: "ceramic-window-tint",
    name: "Ceramic Window Tint",
    category: "WINDOW_TINT",
    tagline: "Our best heat rejection and clarity",
    shortDescription: "Nano-ceramic film that rejects up to 88% of infrared heat while keeping perfect visibility.",
    description:
      "Ceramic film is the premium choice for drivers who want the coolest cabin possible. Nano-ceramic particles block infrared heat without metal, so there is no signal interference and no mirror-like shine — just crystal-clear glass that keeps you comfortable.\n\nBecause ceramic rejects heat independently of shade, you can choose a lighter, legal tint and still feel a dramatic difference.",
    benefits: ["Up to 88% infrared heat rejection", "Superior clarity day and night", "No interference with phones, GPS or keyless entry", "Lifetime color stability"],
    features: ["Premium nano-ceramic film", "Available from 5% to 70%", "Lifetime warranty", "Ideal for EVs — reduces AC load"],
    image: "/images/demo/service-ceramic-tint.jpg",
    startingPrice: $(399),
    durationMinutes: 150,
    durationLabel: "2–3 hours",
    warranty: "Lifetime warranty against bubbling, peeling, cracking and fading.",
    film: "ceramic",
    parent: "window-tint",
    featured: true,
    faqs: [
      ["Is ceramic tint worth it?", "If heat is your main concern, absolutely. Ceramic film rejects far more infrared heat than dyed or carbon film, and you can feel the difference on hot days."],
      ["Will ceramic tint be very dark?", "No — ceramic performs well even at 50% or 70%, so you can stay comfortable without going dark."],
    ],
  },
  {
    slug: "carbon-window-tint",
    name: "Carbon Window Tint",
    category: "WINDOW_TINT",
    tagline: "True-black finish that never fades",
    shortDescription: "Carbon-infused film with a matte, true-black look and strong heat rejection.",
    description:
      "Carbon film offers a big step up from dyed film. Carbon particles give it a deep, true-black appearance that won’t fade to purple, and it rejects significantly more heat. It’s a great balance of looks, performance and value.",
    benefits: ["Fade-proof true-black color", "Up to 60% infrared heat rejection", "Matte, non-reflective finish", "No signal interference"],
    features: ["Carbon-infused construction", "Shades from 5% to 50%", "Lifetime warranty"],
    image: "/images/demo/service-carbon-tint.jpg",
    startingPrice: $(279),
    durationMinutes: 150,
    durationLabel: "2–3 hours",
    warranty: "Lifetime warranty against bubbling, peeling, cracking and fading.",
    film: "carbon",
    parent: "window-tint",
    featured: true,
    faqs: [["Carbon or ceramic?", "Carbon gives you the look and solid heat rejection; ceramic adds maximum heat rejection and clarity. Both carry a lifetime warranty."]],
  },
  {
    slug: "dyed-window-tint",
    name: "Dyed Window Tint",
    category: "WINDOW_TINT",
    tagline: "Classic tint at an accessible price",
    shortDescription: "Deep, non-reflective dyed film for privacy, glare reduction and UV protection.",
    description:
      "Dyed film is the classic window tint: a clean, dark, non-reflective finish that adds privacy and blocks glare. It’s an excellent choice for daily drivers, leased vehicles and anyone who wants a great look on a budget.",
    benefits: ["Great privacy and glare reduction", "Blocks 99% of UV rays", "Non-reflective finish", "Most affordable option"],
    features: ["Multi-layer dyed film", "Shades from 5% to 50%", "5-year warranty"],
    image: "/images/demo/service-dyed-tint.jpg",
    startingPrice: $(199),
    durationMinutes: 150,
    durationLabel: "2–3 hours",
    warranty: "5-year warranty against bubbling, peeling and cracking.",
    film: "dyed",
    parent: "window-tint",
    featured: true,
    faqs: [["Will dyed tint fade?", "High-quality dyed film holds its color for years. Over a long time it can lighten slightly, which is why carbon and ceramic carry longer warranties."]],
  },
  {
    slug: "windshield-tint",
    name: "Windshield Tint",
    category: "WINDOW_TINT",
    tagline: "Heat rejection through the biggest piece of glass",
    shortDescription: "Clear or light ceramic windshield film that blocks heat and UV without darkening your view.",
    description:
      "Your windshield lets in more heat than any other window. A virtually clear ceramic windshield film rejects infrared heat and UV while preserving the visibility you need — the single biggest comfort upgrade for hot climates.",
    benefits: ["Blocks heat where it matters most", "Reduces dashboard fading and cracking", "Cuts glare and eye strain", "Optically clear options"],
    features: ["Clear (70%) and light ceramic shades", "Installed without removing the glass", "Lifetime warranty on ceramic"],
    image: "/images/demo/service-windshield.jpg",
    startingPrice: $(149),
    durationMinutes: 90,
    durationLabel: "About 1.5 hours",
    warranty: "Lifetime warranty on ceramic windshield film.",
    usesFilm: true,
    featured: true,
    options: [
      { key: "windshield", name: "Full Windshield", windowCount: 1, durationMinutes: 90 },
      { key: "windshield-strip", name: "Windshield + Sun Strip", windowCount: 2, durationMinutes: 120 },
    ],
    faqs: [["Is windshield tint legal?", "Most states restrict how dark a windshield can be. We recommend clear or 70% ceramic film, which is legal in many areas — always check your local regulations."]],
  },
  {
    slug: "sun-strip",
    name: "Sun Strip",
    category: "WINDOW_TINT",
    tagline: "Cut the glare at the top of the windshield",
    shortDescription: "A clean visor strip across the top of the windshield to block sun glare.",
    description: "A precision-cut strip of film across the top of your windshield (typically to the AS-1 line) that blocks low sun glare without affecting your view of the road.",
    benefits: ["Blocks low sun glare", "Clean, factory-style line", "Quick install"],
    features: ["Cut to your windshield’s AS-1 line", "Matches your side-window film"],
    image: "/images/demo/service-sun-strip.jpg",
    startingPrice: $(49),
    durationMinutes: 30,
    durationLabel: "About 30 minutes",
    warranty: "Same warranty as the film selected.",
    usesFilm: true,
    featured: true,
    options: [{ key: "sunstrip", name: "Sun Strip", windowCount: 1, durationMinutes: 30 }],
    faqs: [["How tall is the sun strip?", "We cut it to your windshield’s AS-1 line or 5–6 inches, whichever your local law allows."]],
  },
  {
    slug: "paint-protection-film",
    name: "Paint Protection Film",
    category: "PAINT_PROTECTION",
    tagline: "Invisible armor for your paint",
    shortDescription: "Self-healing clear film that protects against rock chips, scratches and road debris.",
    description:
      "Paint protection film (PPF) is a virtually invisible urethane layer that absorbs rock chips, road rash and light scratches before they reach your paint. Our self-healing film erases swirl marks with heat and keeps a high-gloss finish for years.",
    benefits: ["Stops rock chips and road rash", "Self-heals light scratches", "Preserves resale value", "Hydrophobic, easy-clean top coat"],
    features: ["Computer-cut, wrapped edges where possible", "Gloss or matte finish", "10-year manufacturer warranty"],
    image: "/images/demo/service-ppf.jpg",
    startingPrice: $(895),
    durationMinutes: 240,
    durationLabel: "4 hours – full day",
    warranty: "10-year warranty against yellowing, cracking, staining and peeling.",
    depositAmount: $(250),
    featured: true,
    options: [
      { key: "partial", name: "Partial Front", description: "Bumper, 18–24\" of hood and fenders, mirrors", durationMinutes: 240 },
      { key: "fullfront", name: "Full Front", description: "Full bumper, hood, fenders, mirrors and headlights", durationMinutes: 360 },
      { key: "track", name: "Track Pack", description: "Full front plus rockers, A-pillars and roof edge", durationMinutes: 480 },
      { key: "fullbody", name: "Full Vehicle", description: "Every painted panel", durationMinutes: 540 },
    ],
    faqs: [["How long does PPF last?", "Quality PPF lasts 10 years or more with normal care."], ["Can PPF be removed?", "Yes — it can be removed cleanly without harming factory paint."]],
  },
  {
    slug: "ceramic-coating",
    name: "Ceramic Coating",
    category: "COATING",
    tagline: "Deep gloss and effortless cleaning",
    shortDescription: "Professional-grade ceramic coating with paint correction for lasting gloss and protection.",
    description:
      "A professional ceramic coating bonds to your paint to create a hard, glossy, hydrophobic layer. Water beads and sheets away, dirt struggles to stick, and your car stays cleaner for longer. Every package includes a decontamination wash and machine polish before coating.",
    benefits: ["Intense, candy-like gloss", "Water and dirt slide off", "Protection from UV and bird droppings", "Easier, faster washes"],
    features: ["Decontamination wash & clay", "Single-stage machine polish", "Professional-grade coating", "Annual inspection on 3- and 5-year packages"],
    image: "/images/demo/service-ceramic-coating.jpg",
    startingPrice: $(499),
    durationMinutes: 240,
    durationLabel: "4–8 hours",
    warranty: "Coverage for the life of the package selected (1, 3 or 5 years).",
    depositAmount: $(150),
    featured: true,
    options: [
      { key: "1yr", name: "Essential — 1 Year", durationMinutes: 240 },
      { key: "3yr", name: "Pro — 3 Year", durationMinutes: 360 },
      { key: "5yr", name: "Signature — 5 Year", durationMinutes: 480 },
      { key: "wheels", name: "Wheels & Calipers", kind: "ADDON", durationMinutes: 60, price: $(199) },
      { key: "glass", name: "Glass Coating", kind: "ADDON", durationMinutes: 30, price: $(99) },
      { key: "interior", name: "Interior Protection", kind: "ADDON", durationMinutes: 60, price: $(149) },
    ],
    faqs: [["Can I wash my car after coating?", "Wait 7 days before the first wash, then hand wash with a pH-neutral soap."]],
  },
  {
    slug: "headlight-tint",
    name: "Headlight Tint",
    category: "LIGHTING",
    tagline: "A smoked look that protects your lenses",
    shortDescription: "Light-smoke film for headlights and fog lights that also shields lenses from chips and yellowing.",
    description: "A light-smoke protective film that gives headlights a sleek, aggressive look while protecting the lenses from rock chips and UV yellowing. Removable at any time.",
    benefits: ["Sleek smoked appearance", "Protects lenses from chips", "Prevents UV yellowing", "Fully removable"],
    features: ["Light smoke shade for street use", "Self-healing urethane film"],
    image: "/images/demo/service-headlight.jpg",
    startingPrice: $(149),
    durationMinutes: 60,
    durationLabel: "About 1 hour",
    warranty: "3-year warranty against peeling and yellowing.",
    featured: true,
    options: [
      { key: "pair", name: "Headlights (pair)", durationMinutes: 60, price: $(149) },
      { key: "fog", name: "Headlights + Fog Lights", durationMinutes: 90, price: $(199) },
    ],
    faqs: [["Is headlight tint legal?", "Lighting laws vary. We use a light smoke film and recommend checking local regulations; the film is removable if needed."]],
  },
  {
    slug: "taillight-tint",
    name: "Taillight Tint",
    category: "LIGHTING",
    tagline: "Clean smoked taillights",
    shortDescription: "Smoked taillight film for a cohesive, blacked-out rear end.",
    description: "Smoked film for taillights and the third brake light that ties together a tinted or blacked-out look while keeping lights clearly visible.",
    benefits: ["Cohesive smoked look", "Protects lenses", "Removable"],
    features: ["Light or medium smoke", "Precision-trimmed edges"],
    image: "/images/demo/service-taillight.jpg",
    startingPrice: $(149),
    durationMinutes: 60,
    durationLabel: "About 1 hour",
    warranty: "3-year warranty against peeling and yellowing.",
    options: [
      { key: "pair", name: "Taillights (pair)", durationMinutes: 60, price: $(149) },
      { key: "third", name: "Taillights + Third Brake Light", durationMinutes: 75, price: $(179) },
    ],
    faqs: [["Will my brake lights still be visible?", "Yes — we use a light smoke designed to keep lights clearly visible."]],
  },
];

const GENERAL_FAQS: [string, string][] = [
  ["How long does tint installation take?", "Most full tint jobs take 2–3 hours. Front windows only take about an hour, and a full vehicle with windshield takes around 3.5 hours. You’re welcome to wait in our lounge or drop the car off."],
  ["How long before I can roll my windows down?", "Keep your windows up for 3–5 days so the adhesive can fully cure. In cold or humid weather, allow up to a week. You may see slight haziness or small water pockets during curing — that’s normal and disappears on its own."],
  ["What tint percentage should I choose?", "The percentage is how much visible light passes through: 5% is “limo” dark, 20% is a popular dark look, 35% is a balanced factory-plus look and 50–70% is light. Choose based on privacy, night visibility and your local laws — we’re happy to show you samples on your car."],
  ["What is ceramic tint?", "Ceramic tint uses nano-ceramic particles to block infrared heat without metal or dye. It rejects much more heat than dyed or carbon film, stays perfectly clear, and never interferes with phone, GPS or radio signals."],
  ["Does tint block UV rays?", "Yes. All of our films block 99% of UV-A and UV-B rays, protecting your skin and preventing your interior from fading and cracking."],
  ["Does tint reduce heat?", "Yes. Dyed film reduces heat moderately, carbon film noticeably, and ceramic film dramatically — up to 88% of infrared heat. Ceramic is the best choice if heat is your main concern."],
  ["How long does tint last?", "Quality film professionally installed lasts 10+ years. Our carbon and ceramic films carry a lifetime warranty against bubbling, peeling, cracking and fading."],
  ["Is tint legal?", "Window tint laws vary by state and country, and differ for front, rear and windshield glass. We’ll explain the rules where we operate, but it’s ultimately the vehicle owner’s responsibility to verify and follow local tint regulations."],
  ["Do you tint windshields?", "Yes. We install clear and light ceramic windshield films that reject heat and UV without compromising visibility, plus sun strips across the top of the windshield."],
  ["Do you offer warranties?", "Every installation includes a written warranty. Carbon and ceramic films are covered for life against bubbling, peeling, cracking and fading; dyed film for 5 years."],
  ["Can you tint SUVs and trucks?", "Absolutely — coupes, sedans, SUVs, trucks and vans. Pricing adjusts automatically for vehicle type and size in our online quote tool."],
];

const LEGAL: { slug: string; title: string; content: string }[] = [
  {
    slug: "privacy",
    title: "Privacy Policy",
    content: `This policy explains what information Obsidian Tint Studio ("we") collects and how we use it.

## Information we collect
- Contact details you provide (name, email, phone) when you book, request a quote or contact us.
- Vehicle details (year, make, model, color, optional VIN) needed to prepare your service.
- Payment information is processed by Stripe; we never see or store full card numbers.
- Basic analytics about how the website is used, if analytics are enabled.

## How we use it
- To schedule and perform your service, send confirmations and reminders, and provide receipts.
- To respond to quotes, messages and reviews.
- To improve our website and services.

## Sharing
We share information only with service providers that help us operate (payment processing, email and SMS delivery, hosting). We never sell your personal information.

## Your choices
You can update your profile or notification preferences in your account, or contact us to request access to or deletion of your data.

## Contact
Questions? Email us or call the shop — details are on our Contact page.`,
  },
  {
    slug: "terms",
    title: "Terms of Service",
    content: `By using this website or booking a service you agree to these terms.

## Quotes and pricing
Online estimates are based on the information you provide. Final pricing may change if the vehicle differs from the description (for example, existing film that must be removed).

## Appointments
Please arrive on time. Appointments may be rescheduled if you arrive more than 20 minutes late.

## Tint laws
Window tint regulations vary by location. You are responsible for choosing a film shade that complies with the laws where your vehicle is registered and driven.

## Liability
We take great care with every vehicle. Pre-existing damage (such as cracked glass or failing defroster lines) is noted before work begins and is not our responsibility.

## Changes
We may update these terms from time to time. The version on this page applies.`,
  },
  {
    slug: "cancellation",
    title: "Cancellation Policy",
    content: `## Rescheduling and cancelling
You can reschedule or cancel online from your confirmation email or account up to 24 hours before your appointment.

- More than 24 hours before: your deposit is refunded in full.
- Within 24 hours or no-show: the deposit is forfeited, but can be applied once to a new appointment within 30 days.

## Late arrivals
If you arrive more than 20 minutes late we may need to reschedule to protect other customers’ appointments.`,
  },
  {
    slug: "refund",
    title: "Refund Policy",
    content: `## Deposits
Deposits are fully refundable when you cancel at least 24 hours before your appointment. Refunds are returned to the original payment method and usually appear within 5–10 business days.

## Completed work
Because every installation is custom-cut for your vehicle, completed services are not refundable. If anything isn’t right, contact us — warranty issues are repaired or replaced at no cost.`,
  },
  {
    slug: "warranty",
    title: "Warranty Policy",
    content: `## Coverage
- Carbon and ceramic window film: lifetime warranty for as long as you own the vehicle.
- Dyed window film: 5 years.
- Paint protection film: 10 years.
- Ceramic coatings: the term of the package purchased.
- Headlight and taillight film: 3 years.

Warranty covers bubbling, peeling, delaminating, cracking and fading caused by product or installation defects.

## Not covered
Scratches, chips or damage caused by accidents, abrasive cleaning, seat belts or objects; and film installed by another shop.

## How to claim
Bring your vehicle and your booking reference to the shop. We’ll inspect it and repair or replace the affected film at no charge.`,
  },
];

const REVIEWS: { name: string; rating: number; title: string; body: string; vehicle: string; featured?: boolean }[] = [
  { name: "Marcus T.", rating: 5, title: "Flawless ceramic install", body: "Had 35% ceramic done all around plus a 70% windshield. Zero dust, perfect edges and the car is noticeably cooler in traffic. The team walked me through the cure time and checked in a few days later.", vehicle: "2024 Tesla Model Y", featured: true },
  { name: "Priya S.", rating: 5, title: "Worth every penny", body: "I compared three shops and Obsidian was the only one that computer-cuts patterns. You can tell — the film goes right to the edge of the glass. Booking and paying the deposit online took two minutes.", vehicle: "2023 BMW M340i", featured: true },
  { name: "Daniel R.", rating: 5, title: "Truck looks incredible", body: "20% carbon on my crew cab with a sun strip. Clean, true black, no purple tint like my last truck. Done in under three hours while I worked from their lounge.", vehicle: "2022 Ford F-150 Raptor", featured: true },
  { name: "Elena V.", rating: 5, title: "Professional from start to finish", body: "They explained the legal limits for our state and helped me pick a shade that looks great and won’t get me pulled over. Super clean shop and friendly staff.", vehicle: "2021 Audi Q5" },
  { name: "Chris W.", rating: 5, title: "Ceramic coating + tint combo", body: "Got the Pro ceramic coating and ceramic tint at the same visit. The gloss is unreal and water just flies off. They even sent me a care guide afterward.", vehicle: "2023 Porsche 911 Carrera", featured: true },
  { name: "Aisha K.", rating: 5, title: "Huge difference in the summer heat", body: "My kids used to complain about the sun in the back seat. Ceramic tint fixed it completely. Should have done this years ago.", vehicle: "2022 Toyota Highlander" },
  { name: "Tom H.", rating: 4, title: "Great result, busy shop", body: "Excellent quality and fair pricing. Only reason for 4 stars is I had to wait a week for a Saturday slot — they’re clearly popular.", vehicle: "2019 Honda Accord" },
  { name: "Sofia L.", rating: 5, title: "PPF saved my paint", body: "Full front PPF on a brand new car. Already took a rock on the freeway that would have chipped the paint — not a mark. Invisible edges, beautiful work.", vehicle: "2024 Mercedes-AMG GT" },
  { name: "Jamal B.", rating: 5, title: "Fast and honest", body: "They told me my factory rear glass was already dark and I only needed the fronts matched. Saved me money and it looks factory. Will be back for the windshield.", vehicle: "2023 Kia Telluride" },
  { name: "Hannah P.", rating: 5, title: "Best tint shop in town", body: "Clean install, on time, and the online quote matched the final price exactly. Love the 20% carbon look.", vehicle: "2020 Ford Mustang GT" },
  { name: "Kevin N.", rating: 5, title: "Windshield film is a game changer", body: "Clear ceramic on the windshield made my commute so much more comfortable. You can’t even tell it’s there.", vehicle: "2022 Toyota Tacoma" },
  { name: "Grace O.", rating: 5, title: "Easy online booking", body: "Picked my film, saw the price, chose a time and paid the deposit all from my phone. Reminder text the day before and the car was ready when promised.", vehicle: "2021 Volvo XC60" },
  { name: "Ryan C.", rating: 5, title: "Headlight tint looks sharp", body: "Light smoke on the headlights and taillights — subtle but makes the car look so much meaner. Great attention to detail.", vehicle: "2022 BMW M4" },
  { name: "Olivia M.", rating: 5, title: "Gorgeous on my Panamera", body: "50% ceramic for a factory-plus look. Exactly what I wanted, and the cabin stays cool even parked in the sun.", vehicle: "2021 Porsche Panamera" },
];

const GALLERY: { file: string; title: string; vehicle: string; categories: GalleryCategory[]; w: number; h: number; featured?: boolean; before?: string; caption?: string }[] = [
  { file: "lux-porsche-panamera.jpg", title: "Porsche Panamera — 35% Ceramic", vehicle: "Porsche Panamera", categories: ["LUXURY", "CERAMIC", "SEDAN"], w: 1600, h: 1067, featured: true },
  { file: "sport-amg-gt.jpg", title: "Mercedes-AMG GT — 20% Ceramic", vehicle: "Mercedes-AMG GT", categories: ["SPORTS", "LUXURY", "CERAMIC"], w: 1600, h: 2400, featured: true },
  { file: "truck-raptor.jpg", title: "Ford Raptor — Full Vehicle Carbon", vehicle: "Ford F-150 Raptor", categories: ["TRUCK", "FULL_VEHICLE"], w: 1600, h: 1200, featured: true },
  { file: "suv-model-y.jpg", title: "Tesla Model Y — Ceramic + Windshield", vehicle: "Tesla Model Y", categories: ["SUV", "CERAMIC", "WINDSHIELD"], w: 1600, h: 1068, featured: true },
  { file: "sedan-bmw-m5.jpg", title: "BMW M5 — 20% Carbon", vehicle: "BMW M5", categories: ["SEDAN", "SPORTS"], w: 1600, h: 1067, featured: true },
  { file: "sport-porsche-911.jpg", title: "Porsche 911 — Clear Ceramic Windshield", vehicle: "Porsche 911", categories: ["SPORTS", "LUXURY", "WINDSHIELD"], w: 1600, h: 1067, featured: true },
  { file: "ba-interior-after.jpg", before: "ba-interior-before.jpg", title: "Interior heat & glare — before / after", vehicle: "BMW 5 Series", categories: ["SEDAN", "CERAMIC"], w: 2000, h: 1334, caption: "Same car, same afternoon: untreated glass vs. 35% ceramic." },
  { file: "lux-audi-rs7.jpg", title: "Audi RS7 — 15% Ceramic", vehicle: "Audi RS7", categories: ["LUXURY", "SPORTS", "CERAMIC"], w: 1600, h: 2155 },
  { file: "sedan-bmw-7.jpg", title: "BMW 7 Series — 35% Ceramic", vehicle: "BMW 7 Series", categories: ["SEDAN", "LUXURY", "CERAMIC"], w: 1600, h: 1067 },
  { file: "full-mustang-black.jpg", title: "Mustang — Full Vehicle 5% Carbon", vehicle: "Ford Mustang", categories: ["FULL_VEHICLE", "SPORTS"], w: 1600, h: 900 },
  { file: "suv-expedition.jpg", title: "Ford Expedition — Full Vehicle Dyed", vehicle: "Ford Expedition", categories: ["SUV", "FULL_VEHICLE"], w: 1600, h: 1067 },
  { file: "sport-audi-r8.jpg", title: "Audi R8 — Windshield + Sun Strip", vehicle: "Audi R8", categories: ["SPORTS", "WINDSHIELD"], w: 1600, h: 1068 },
  { file: "suv-volvo-xc60.jpg", title: "Volvo XC60 — 35% Ceramic", vehicle: "Volvo XC60", categories: ["SUV", "LUXURY", "CERAMIC"], w: 1600, h: 1063 },
  { file: "truck-tacoma.jpg", title: "Toyota Tacoma — 20% Carbon", vehicle: "Toyota Tacoma", categories: ["TRUCK"], w: 1600, h: 1091 },
  { file: "sedan-tesla-model-3.jpg", title: "Tesla Model 3 — 20% Ceramic", vehicle: "Tesla Model 3", categories: ["SEDAN", "CERAMIC"], w: 1600, h: 2400 },
  { file: "sport-bmw-m4.jpg", title: "BMW M4 — Ceramic + Smoked Lights", vehicle: "BMW M4", categories: ["SPORTS", "CERAMIC"], w: 1600, h: 2000 },
  { file: "lux-mercedes-garage.jpg", title: "Mercedes S-Class — 50% Ceramic", vehicle: "Mercedes-Benz S-Class", categories: ["LUXURY", "SEDAN", "CERAMIC"], w: 1600, h: 1068 },
  { file: "suv-4runner.jpg", title: "Toyota 4Runner — 20% Carbon", vehicle: "Toyota 4Runner", categories: ["SUV"], w: 1600, h: 2000 },
  { file: "sport-camaro.jpg", title: "Chevrolet Camaro — 15% Dyed", vehicle: "Chevrolet Camaro", categories: ["SPORTS"], w: 1600, h: 945 },
  { file: "full-mustang-gt.jpg", title: "Mustang GT — Full Vehicle Ceramic", vehicle: "Ford Mustang GT", categories: ["FULL_VEHICLE", "SPORTS", "CERAMIC"], w: 1600, h: 1067 },
  { file: "suv-audi-q5.jpg", title: "Audi Q5 — 35% Carbon", vehicle: "Audi Q5", categories: ["SUV", "LUXURY"], w: 1600, h: 2000 },
  { file: "ceramic-tesla-roadster.jpg", title: "Tesla Roadster — Ceramic", vehicle: "Tesla Roadster", categories: ["CERAMIC", "SPORTS"], w: 1600, h: 1067 },
  { file: "sedan-hyundai.jpg", title: "Hyundai Sonata — 35% Dyed", vehicle: "Hyundai Sonata", categories: ["SEDAN"], w: 1600, h: 1067 },
  { file: "suv-rav4.jpg", title: "Toyota RAV4 — Front Windows Match", vehicle: "Toyota RAV4", categories: ["SUV"], w: 1600, h: 997 },
  { file: "sport-mustang.jpg", title: "Ford Mustang — 20% Carbon", vehicle: "Ford Mustang", categories: ["SPORTS"], w: 1600, h: 1067 },
  { file: "service-windshield.jpg", title: "Windshield — 70% Clear Ceramic", vehicle: "Lexus RX", categories: ["WINDSHIELD", "CERAMIC"], w: 1600, h: 2400 },
];

const FIRST = ["Jordan", "Ava", "Liam", "Mia", "Noah", "Zoe", "Ethan", "Chloe", "Lucas", "Nora", "Mateo", "Leah", "Owen", "Isla", "Caleb", "Maya", "Adrian", "Ruby", "Julian", "Elise", "Nathan", "Ivy", "Gabriel", "Lena", "Diego", "Sara"];
const LAST = ["Avery", "Brooks", "Chen", "Diaz", "Evans", "Foster", "Garcia", "Hayes", "Ito", "Jensen", "Khan", "Lopez", "Morgan", "Nguyen", "Ortiz", "Patel", "Quinn", "Reyes", "Shah", "Turner", "Usman", "Vargas", "Walsh", "Young", "Zhang", "Bishop"];
const CARS: { make: string; model: string; type: string; size: string }[] = [
  { make: "Tesla", model: "Model 3", type: "sedan", size: "standard" },
  { make: "Tesla", model: "Model Y", type: "suv", size: "standard" },
  { make: "BMW", model: "330i", type: "sedan", size: "standard" },
  { make: "Honda", model: "Civic", type: "sedan", size: "compact" },
  { make: "Toyota", model: "Camry", type: "sedan", size: "standard" },
  { make: "Ford", model: "F-150", type: "truck", size: "large" },
  { make: "Toyota", model: "Tacoma", type: "truck", size: "standard" },
  { make: "Jeep", model: "Grand Cherokee", type: "suv", size: "standard" },
  { make: "Chevrolet", model: "Tahoe", type: "suv", size: "large" },
  { make: "Ford", model: "Mustang", type: "coupe", size: "standard" },
  { make: "Porsche", model: "911", type: "coupe", size: "compact" },
  { make: "Honda", model: "Odyssey", type: "van", size: "large" },
  { make: "Audi", model: "Q5", type: "suv", size: "standard" },
  { make: "Mercedes-Benz", model: "C 300", type: "sedan", size: "standard" },
  { make: "Kia", model: "Telluride", type: "suv", size: "large" },
];
const COLORS = ["Black", "White", "Silver", "Midnight Blue", "Gray", "Red", "Pearl White"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function wipe() {
  // Order matters for foreign keys.
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.messageLog.deleteMany(),
    prisma.couponRedemption.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.review.deleteMany(),
    prisma.appointmentItem.deleteMany(),
    prisma.appointment.deleteMany(),
    prisma.quoteItem.deleteMany(),
    prisma.quote.deleteMany(),
    prisma.contactMessage.deleteMany(),
    prisma.coupon.deleteMany(),
    prisma.galleryImage.deleteMany(),
    prisma.package.deleteMany(),
    prisma.pricingRule.deleteMany(),
    prisma.faq.deleteMany(),
    prisma.serviceOption.deleteMany(),
    prisma.technicianSchedule.deleteMany(),
    prisma.technicianTimeOff.deleteMany(),
    prisma.technician.deleteMany(),
    prisma.service.deleteMany(),
    prisma.filmType.deleteMany(),
    prisma.vehicle.deleteMany(),
    prisma.vehicleType.deleteMany(),
    prisma.vehicleSize.deleteMany(),
    prisma.businessHours.deleteMany(),
    prisma.breakPeriod.deleteMany(),
    prisma.holiday.deleteMany(),
    prisma.legalPage.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.account.deleteMany(),
    prisma.customerProfile.deleteMany(),
    prisma.user.deleteMany(),
    prisma.stripeEvent.deleteMany(),
    prisma.rateLimit.deleteMany(),
    prisma.siteSettings.deleteMany(),
  ]);
}

async function seedCatalog() {
  await prisma.siteSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default", ...SETTINGS } });

  for (const h of HOURS) await prisma.businessHours.upsert({ where: { dayOfWeek: h.dayOfWeek }, update: {}, create: h });

  const year = Number(todayYmd(TZ).slice(0, 4));
  for (const [date, name] of [
    [`${year}-11-26`, "Thanksgiving"],
    [`${year}-12-25`, "Christmas Day"],
    [`${year + 1}-01-01`, "New Year’s Day"],
  ] as const) {
    await prisma.holiday.upsert({ where: { date: ymdToDateOnly(date) }, update: {}, create: { date: ymdToDateOnly(date), name, closed: true } });
  }

  const types: Record<string, string> = {};
  for (const [i, t] of VEHICLE_TYPES.entries()) {
    const row = await prisma.vehicleType.upsert({ where: { slug: t.slug }, update: {}, create: { ...t, sortOrder: i } });
    types[t.slug] = row.id;
  }
  const sizes: Record<string, string> = {};
  for (const [i, s] of VEHICLE_SIZES.entries()) {
    const row = await prisma.vehicleSize.upsert({ where: { slug: s.slug }, update: {}, create: { ...s, sortOrder: i } });
    sizes[s.slug] = row.id;
  }
  const films: Record<string, string> = {};
  for (const [i, f] of FILMS.entries()) {
    const row = await prisma.filmType.upsert({
      where: { slug: f.slug },
      update: {},
      create: { ...f, shades: [...f.shades], features: [...f.features], sortOrder: i },
    });
    films[f.slug] = row.id;
  }

  const services: Record<string, string> = {};
  const options: Record<string, Record<string, string>> = {};
  for (const [i, s] of SERVICES.entries()) {
    const existing = await prisma.service.findUnique({ where: { slug: s.slug } });
    if (existing) {
      services[s.slug] = existing.id;
      const opts = await prisma.serviceOption.findMany({ where: { serviceId: existing.id } });
      options[s.slug] = Object.fromEntries(opts.map((o) => [o.name, o.id]));
      continue;
    }
    const row = await prisma.service.create({
      data: {
        slug: s.slug,
        name: s.name,
        category: s.category,
        tagline: s.tagline,
        shortDescription: s.shortDescription,
        description: s.description,
        benefits: s.benefits,
        features: s.features,
        imageUrl: s.image,
        startingPrice: s.startingPrice,
        durationMinutes: s.durationMinutes,
        durationLabel: s.durationLabel,
        warranty: s.warranty,
        usesFilm: s.usesFilm ?? false,
        filmTypeId: s.film ? films[s.film] : null,
        parentId: s.parent ? services[s.parent] : null,
        depositAmount: s.depositAmount ?? null,
        featured: s.featured ?? false,
        sortOrder: i,
        seoTitle: `${s.name} in Los Angeles`,
        seoDescription: s.shortDescription,
      },
    });
    services[s.slug] = row.id;
    options[s.slug] = {};
    for (const [j, o] of (s.options ?? []).entries()) {
      const opt = await prisma.serviceOption.create({
        data: {
          serviceId: row.id,
          name: o.name,
          description: o.description ?? null,
          kind: o.kind ?? "COVERAGE",
          windowCount: o.windowCount ?? 0,
          durationMinutes: o.durationMinutes ?? null,
          price: o.price ?? null,
          sortOrder: j,
        },
      });
      options[s.slug][o.key] = opt.id;
    }
    for (const [j, [question, answer]] of s.faqs.entries()) {
      await prisma.faq.create({ data: { serviceId: row.id, question, answer, sortOrder: j } });
    }
  }

  const ruleCount = await prisma.pricingRule.count();
  if (ruleCount === 0) {
    const filmKeys = ["dyed", "carbon", "ceramic"] as const;
    const rules: { serviceId: string; serviceOptionId: string; filmTypeId?: string; vehicleTypeId?: string; price: number; name: string }[] = [];
    const wt = services["window-tint"];
    for (const [type, prices] of Object.entries(FULL_TINT)) {
      prices.forEach((p, fi) => rules.push({ serviceId: wt, serviceOptionId: options["window-tint"].full, filmTypeId: films[filmKeys[fi]], vehicleTypeId: types[type], price: $(p), name: `Full tint · ${type} · ${filmKeys[fi]}` }));
    }
    for (const [type, prices] of Object.entries(FULL_VEHICLE)) {
      prices.forEach((p, fi) => rules.push({ serviceId: wt, serviceOptionId: options["window-tint"].fullvehicle, filmTypeId: films[filmKeys[fi]], vehicleTypeId: types[type], price: $(p), name: `Full vehicle · ${type} · ${filmKeys[fi]}` }));
    }
    for (const [key, prices] of Object.entries(FLAT_BY_FILM)) {
      prices.forEach((p, fi) => rules.push({ serviceId: wt, serviceOptionId: options["window-tint"][key], filmTypeId: films[filmKeys[fi]], price: $(p), name: `${key} · ${filmKeys[fi]}` }));
    }
    // Vans have extra rear glass.
    FLAT_BY_FILM.rear.forEach((p, fi) => rules.push({ serviceId: wt, serviceOptionId: options["window-tint"].rear, filmTypeId: films[filmKeys[fi]], vehicleTypeId: types.van, price: $(p + 60), name: `rear · van · ${filmKeys[fi]}` }));

    const ws = services["windshield-tint"];
    FLAT_BY_FILM.windshield.forEach((p, fi) => {
      rules.push({ serviceId: ws, serviceOptionId: options["windshield-tint"].windshield, filmTypeId: films[filmKeys[fi]], price: $(p), name: `Windshield · ${filmKeys[fi]}` });
      rules.push({ serviceId: ws, serviceOptionId: options["windshield-tint"]["windshield-strip"], filmTypeId: films[filmKeys[fi]], price: $(p + FLAT_BY_FILM.sunstrip[fi] - 19), name: `Windshield + strip · ${filmKeys[fi]}` });
    });
    FLAT_BY_FILM.sunstrip.forEach((p, fi) =>
      rules.push({ serviceId: services["sun-strip"], serviceOptionId: options["sun-strip"].sunstrip, filmTypeId: films[filmKeys[fi]], price: $(p), name: `Sun strip · ${filmKeys[fi]}` }),
    );

    const multi = (serviceSlug: string, base: Record<string, number>) => {
      for (const [key, dollars] of Object.entries(base)) {
        for (const [type, m] of Object.entries(TYPE_MULTIPLIER)) {
          rules.push({ serviceId: services[serviceSlug], serviceOptionId: options[serviceSlug][key], vehicleTypeId: types[type], price: $(roundTo5(dollars * m)), name: `${serviceSlug} · ${key} · ${type}` });
        }
      }
    };
    multi("paint-protection-film", { partial: 895, fullfront: 1795, track: 2395, fullbody: 5995 });
    multi("ceramic-coating", { "1yr": 499, "3yr": 899, "5yr": 1299 });

    await prisma.pricingRule.createMany({ data: rules.map((r) => ({ ...r, filmTypeId: r.filmTypeId ?? null, vehicleTypeId: r.vehicleTypeId ?? null })) });
  }

  if ((await prisma.package.count()) === 0) {
    const wt = services["window-tint"];
    const full = options["window-tint"].full;
    await prisma.package.createMany({
      data: [
        {
          slug: "essential",
          name: "Essential",
          tagline: "Clean look, everyday comfort",
          description: "Our dyed film package for a sleek, private look at an accessible price.",
          price: $(199),
          features: ["Dyed film, 5%–50% shades", "Blocks 99% of UV rays", "Glare and privacy upgrade", "5-year warranty"],
          recommendedFor: ["Daily commuters", "Leased vehicles", "First-time tint"],
          serviceId: wt,
          serviceOptionId: full,
          filmTypeId: films.dyed,
          sortOrder: 0,
        },
        {
          slug: "premium",
          name: "Premium",
          tagline: "True black that never fades",
          description: "Carbon film with noticeably better heat rejection and a lifetime warranty.",
          price: $(279),
          features: ["Carbon film, never turns purple", "Up to 60% infrared heat rejection", "No signal interference", "Lifetime warranty"],
          recommendedFor: ["Sedans & coupes", "Trucks", "Drivers who want the look + performance"],
          serviceId: wt,
          serviceOptionId: full,
          filmTypeId: films.carbon,
          sortOrder: 1,
        },
        {
          slug: "ceramic",
          name: "Ceramic",
          tagline: "Maximum heat rejection",
          description: "Nano-ceramic film with our best heat rejection, clarity and UV protection.",
          price: $(399),
          priceSuffix: null,
          features: ["Nano-ceramic film, 5%–70% shades", "Up to 88% infrared heat rejection", "Crystal-clear night visibility", "Lifetime warranty", "Free sun strip upgrade available"],
          recommendedFor: ["EVs & luxury vehicles", "Hot climates & long commutes", "Families with kids in the back"],
          serviceId: wt,
          serviceOptionId: full,
          filmTypeId: films.ceramic,
          highlighted: true,
          sortOrder: 2,
        },
      ],
    });
  }

  if ((await prisma.faq.count({ where: { serviceId: null } })) === 0) {
    await prisma.faq.createMany({ data: GENERAL_FAQS.map(([question, answer], i) => ({ question, answer, sortOrder: i })) });
  }

  for (const page of LEGAL) await prisma.legalPage.upsert({ where: { slug: page.slug }, update: {}, create: page });

  return { types, sizes, films, services, options };
}

async function loadCatalog(): Promise<PricingCatalog> {
  const [services, options, films, vehicleTypes, vehicleSizes, rules] = await Promise.all([
    prisma.service.findMany({ where: { active: true } }),
    prisma.serviceOption.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.filmType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.vehicleType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.vehicleSize.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.pricingRule.findMany({ where: { active: true } }),
  ]);
  return { services, options, films, vehicleTypes, vehicleSizes, rules };
}

// ─── Demo data ───────────────────────────────────────────────────────────────

async function seedDemo(ids: Awaited<ReturnType<typeof seedCatalog>>) {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to create demo accounts in production.");
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || "admin@example.com").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const customerEmail = (process.env.SEED_CUSTOMER_EMAIL || "customer@example.com").toLowerCase();
  const customerPassword = process.env.SEED_CUSTOMER_PASSWORD;
  if (!adminPassword || !customerPassword) throw new Error("Set SEED_ADMIN_PASSWORD and SEED_CUSTOMER_PASSWORD in .env before seeding demo accounts.");

  const [adminHash, customerHash] = await Promise.all([bcrypt.hash(adminPassword, 12), bcrypt.hash(customerPassword, 12)]);
  const now = new Date();
  const today = todayYmd(TZ);

  // Staff accounts
  const admin = await prisma.user.create({ data: { name: "Alex Morgan", email: adminEmail, passwordHash: adminHash, role: "SUPER_ADMIN", isDemo: true, emailVerified: now, phone: "(555) 010-2041" } });
  await prisma.user.create({ data: { name: "Riley Park", email: "manager@example.com", passwordHash: adminHash, role: "ADMIN", isDemo: true, emailVerified: now } });
  const staffUser = await prisma.user.create({ data: { name: "Marcus Reyes", email: "staff@example.com", passwordHash: adminHash, role: "STAFF", isDemo: true, emailVerified: now } });

  // Technicians
  const marcus = await prisma.technician.create({
    data: { name: "Marcus Reyes", title: "Lead Installer", bio: "12 years installing film on everything from daily drivers to exotics.", color: "#f5b544", userId: staffUser.id, sortOrder: 0 },
  });
  const dana = await prisma.technician.create({
    data: {
      name: "Dana Kim",
      title: "Window Film Specialist",
      bio: "Certified installer with a obsession for micro-edges.",
      color: "#60a5fa",
      sortOrder: 1,
      services: { connect: ["window-tint", "windshield-tint", "sun-strip", "headlight-tint", "taillight-tint"].map((s) => ({ id: ids.services[s] })) },
      schedules: { create: [2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, startTime: d === 6 ? "09:00" : "09:00", endTime: d === 6 ? "16:00" : "17:00" })) },
    },
  });
  const luis = await prisma.technician.create({
    data: {
      name: "Luis Ortega",
      title: "PPF & Coating Specialist",
      bio: "Paint correction and protection specialist.",
      color: "#34d399",
      sortOrder: 2,
      services: { connect: ["window-tint", "paint-protection-film", "ceramic-coating"].map((s) => ({ id: ids.services[s] })) },
      schedules: { create: [1, 2, 3, 4, 5].map((d) => ({ dayOfWeek: d, startTime: "08:00", endTime: "16:00" })) },
    },
  });
  const techs = [marcus, dana, luis];

  // Customers
  const demoCustomer = await prisma.user.create({
    data: {
      name: "Jordan Avery",
      email: customerEmail,
      passwordHash: customerHash,
      phone: "(555) 010-3344",
      isDemo: true,
      emailVerified: now,
      createdAt: new Date(now.getTime() - 200 * 86_400_000),
      profile: { create: { city: "Los Angeles", state: "CA", preferredContact: "email", emailNotifications: true, smsOptIn: false } },
    },
  });
  const jordanTesla = await prisma.vehicle.create({
    data: { userId: demoCustomer.id, year: 2024, make: "Tesla", model: "Model Y", color: "Pearl White", vehicleTypeId: ids.types.suv, vehicleSizeId: ids.sizes.standard, notes: "Factory rear privacy glass" },
  });
  await prisma.vehicle.create({
    data: { userId: demoCustomer.id, year: 2020, make: "Ford", model: "Mustang GT", color: "Black", vin: "1FA6P8CF5L5123456", vehicleTypeId: ids.types.coupe, vehicleSizeId: ids.sizes.standard },
  });

  const customers: { id: string | null; name: string; email: string; phone: string; car: (typeof CARS)[number]; year: number; color: string }[] = [
    { id: demoCustomer.id, name: "Jordan Avery", email: customerEmail, phone: "(555) 010-3344", car: CARS[1]!, year: 2024, color: "Pearl White" },
  ];
  for (let i = 1; i < 26; i++) {
    const name = `${FIRST[i]} ${LAST[i]}`;
    const email = `${FIRST[i]!.toLowerCase()}.${LAST[i]!.toLowerCase()}@example.com`;
    const phone = `(555) 01${String(i).padStart(1, "0")}-${String(1000 + i * 37).slice(-4)}`;
    const car = pick(CARS);
    const createdAt = new Date(now.getTime() - Math.floor(rand() * 180) * 86_400_000);
    const year = 2016 + Math.floor(rand() * 9);
    const color = pick(COLORS);
    // About two thirds of customers have accounts; the rest booked as guests.
    let id: string | null = null;
    if (i % 3 !== 0) {
      const u = await prisma.user.create({
        data: { name, email, phone, isDemo: true, createdAt, profile: { create: { city: "Los Angeles", state: "CA" } }, vehicles: { create: { year, make: car.make, model: car.model, color, vehicleTypeId: ids.types[car.type], vehicleSizeId: ids.sizes[car.size] } } },
      });
      id = u.id;
    }
    customers.push({ id, name, email, phone, car, year, color });
  }

  const catalog = await loadCatalog();
  const settings = await prisma.siteSettings.findUniqueOrThrow({ where: { id: "default" } });
  const tintServices = ["ceramic-window-tint", "carbon-window-tint", "dyed-window-tint", "window-tint"];
  const coverageKeys = ["full", "full", "full", "front", "fullvehicle", "rear"];

  function job(serviceSlug?: string) {
    const slug = serviceSlug ?? (rand() < 0.78 ? pick(tintServices) : pick(["windshield-tint", "paint-protection-film", "ceramic-coating", "sun-strip", "headlight-tint"]));
    const service = catalog.services.find((s) => s.slug === slug)!;
    const baseSlug = service.parentId ? catalog.services.find((s) => s.id === service.parentId)!.slug : slug;
    const opts = catalog.options.filter((o) => o.serviceId === ids.services[baseSlug] && o.kind === "COVERAGE");
    let optionId = opts[0]?.id ?? null;
    if (baseSlug === "window-tint") optionId = ids.options["window-tint"][pick(coverageKeys)]!;
    else if (opts.length) optionId = pick(opts).id;
    const filmTypeId = service.filmTypeId ?? (service.usesFilm || baseSlug === "window-tint" ? ids.films[pick(["dyed", "carbon", "ceramic"])] : null);
    return { service, optionId, filmTypeId };
  }

  type Slot = { date: string; time: string; tech: number };
  const used = new Map<string, number[]>(); // `${date}:${tech}` → busy minutes ranges start list
  function placeOn(date: string, durationMinutes: number): Slot | null {
    const wd = weekdayOfYmd(date);
    const hours = HOURS[wd]!;
    if (!hours.isOpen) return null;
    const open = Number(hours.openTime.slice(0, 2)) * 60;
    const close = Number(hours.closeTime.slice(0, 2)) * 60;
    for (let attempt = 0; attempt < 12; attempt++) {
      const tech = Math.floor(rand() * techs.length);
      if (tech === 1 && (wd === 1 || wd === 0)) continue; // Dana: Tue–Sat
      if (tech === 2 && (wd === 0 || wd === 6)) continue; // Luis: Mon–Fri
      const step = 60;
      const latest = close - durationMinutes;
      if (latest < open) return null;
      const start = open + Math.floor(rand() * ((latest - open) / step + 1)) * step;
      const key = `${date}:${tech}`;
      const busy = used.get(key) ?? [];
      const clash = busy.some((b, idx) => idx % 2 === 0 && start < busy[idx + 1]! + 15 && b < start + durationMinutes + 15);
      if (clash) continue;
      busy.push(start, start + durationMinutes);
      used.set(key, busy);
      return { date, time: `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`, tech };
    }
    return null;
  }

  async function createDemoAppointment(opts: {
    customer: (typeof customers)[number];
    date: string;
    status: AppointmentStatus;
    serviceSlug?: string;
    vehicleId?: string | null;
    paid?: "none" | "deposit" | "full";
    createdDaysBefore?: number;
  }) {
    const { service, optionId, filmTypeId } = job(opts.serviceSlug);
    const car = opts.customer.car;
    const price = calculatePrice(catalog, { serviceId: service.id, optionId, filmTypeId, vehicleTypeId: ids.types[car.type], vehicleSizeId: ids.sizes[car.size] });
    if (!price.ok) throw new Error(`Seed pricing failed for ${service.slug}: ${price.error}`);
    const slot = placeOn(opts.date, price.durationMinutes);
    if (!slot) return null;
    const totals = calculateTotals({
      subtotal: price.subtotal,
      taxRateBps: settings.taxRateBps,
      depositPercent: settings.depositPercent,
      depositMinimum: settings.depositMinimum,
      depositOverride: service.depositAmount ?? catalog.services.find((s) => s.id === service.parentId)?.depositAmount ?? null,
    });
    const startsAt = zonedToUtc(slot.date, slot.time, TZ);
    const endsAt = new Date(startsAt.getTime() + price.durationMinutes * 60_000);
    const film = catalog.films.find((f) => f.id === filmTypeId);
    const shade = film ? pick(film.shades.filter((s) => s >= 15)) : null;
    const createdAt = new Date(startsAt.getTime() - (opts.createdDaysBefore ?? 3 + Math.floor(rand() * 10)) * 86_400_000);
    const paidMode = opts.paid ?? "none";
    const amountPaid = paidMode === "full" ? totals.total : paidMode === "deposit" ? totals.deposit : 0;

    const appointment = await prisma.appointment.create({
      data: {
        reference: `BK-${code(7)}`,
        manageToken: randomBytes(24).toString("base64url"),
        userId: opts.customer.id,
        customerName: opts.customer.name,
        customerEmail: opts.customer.email,
        customerPhone: opts.customer.phone,
        serviceId: service.id,
        serviceOptionId: price.optionId,
        filmTypeId: price.filmTypeId,
        shade,
        vehicleTypeId: ids.types[car.type],
        vehicleSizeId: ids.sizes[car.size],
        vehicleId: opts.vehicleId ?? null,
        vehicleYear: opts.customer.year,
        vehicleMake: car.make,
        vehicleModel: car.model,
        vehicleColor: opts.customer.color,
        technicianId: techs[slot.tech]!.id,
        startsAt,
        endsAt,
        status: opts.status,
        source: "WEBSITE",
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        depositAmount: totals.deposit,
        amountPaid,
        confirmedAt: opts.status === "PENDING" ? null : createdAt,
        completedAt: opts.status === "COMPLETED" ? endsAt : null,
        cancelledAt: opts.status === "CANCELLED" ? new Date(startsAt.getTime() - 2 * 86_400_000) : null,
        cancellationReason: opts.status === "CANCELLED" ? "Schedule conflict" : null,
        reminderSentAt: startsAt < now ? new Date(startsAt.getTime() - 86_400_000) : null,
        createdAt,
        items: {
          create: price.lines.map((l) => ({ kind: l.kind, label: l.label, description: l.description ?? null, serviceOptionId: l.optionId ?? null, unitPrice: l.amount, total: l.amount })),
        },
      },
    });

    const payments: { amount: number; type: "DEPOSIT" | "FULL" | "BALANCE"; paidAt: Date; provider: "STRIPE" | "MANUAL" }[] = [];
    if (paidMode === "full" && opts.status === "COMPLETED") {
      if (rand() < 0.6) {
        payments.push({ amount: totals.deposit, type: "DEPOSIT", paidAt: createdAt, provider: "STRIPE" });
        payments.push({ amount: totals.total - totals.deposit, type: "BALANCE", paidAt: endsAt, provider: rand() < 0.5 ? "MANUAL" : "STRIPE" });
      } else {
        payments.push({ amount: totals.total, type: "FULL", paidAt: createdAt, provider: "STRIPE" });
      }
    } else if (paidMode === "full") {
      payments.push({ amount: totals.total, type: "FULL", paidAt: createdAt, provider: "STRIPE" });
    } else if (paidMode === "deposit") {
      payments.push({ amount: totals.deposit, type: "DEPOSIT", paidAt: createdAt, provider: "STRIPE" });
    }
    for (const p of payments) {
      const d = p.paidAt;
      await prisma.payment.create({
        data: {
          appointmentId: appointment.id,
          userId: opts.customer.id,
          amount: p.amount,
          type: p.type,
          status: "SUCCEEDED",
          provider: p.provider,
          receiptNumber: `R-${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}-${code(5)}`,
          method: p.provider === "MANUAL" ? "Card terminal" : pick(["VISA •••• 4242", "MASTERCARD •••• 4444", "AMEX •••• 0005"]),
          billingName: opts.customer.name,
          billingEmail: opts.customer.email,
          paidAt: d,
          createdAt: d,
        },
      });
    }
    return appointment;
  }

  // Past 120 days: mostly completed jobs.
  const pastAppointments: { id: string; customer: (typeof customers)[number] }[] = [];
  for (let back = 120; back >= 1; back--) {
    const date = addDaysYmd(today, -back);
    if (!HOURS[weekdayOfYmd(date)]!.isOpen) continue;
    const count = rand() < 0.35 ? 0 : rand() < 0.6 ? 1 : 2;
    for (let k = 0; k < count; k++) {
      const customer = customers[1 + Math.floor(rand() * (customers.length - 1))]!;
      const r = rand();
      const status: AppointmentStatus = r < 0.86 ? "COMPLETED" : r < 0.94 ? "CANCELLED" : "NO_SHOW";
      const a = await createDemoAppointment({ customer, date, status, paid: status === "COMPLETED" ? "full" : status === "NO_SHOW" ? "deposit" : "none" });
      if (a && status === "COMPLETED") pastAppointments.push({ id: a.id, customer });
    }
  }

  // Jordan (the demo customer): two completed jobs, one upcoming.
  const jordan = customers[0]!;
  const j1 = await createDemoAppointment({ customer: jordan, date: addDaysYmd(today, -96), status: "COMPLETED", serviceSlug: "ceramic-window-tint", vehicleId: jordanTesla.id, paid: "full" });
  await createDemoAppointment({ customer: jordan, date: addDaysYmd(today, -41), status: "COMPLETED", serviceSlug: "windshield-tint", vehicleId: jordanTesla.id, paid: "full" });
  let jordanUpcoming = null;
  for (let d = 5; d < 12 && !jordanUpcoming; d++) {
    jordanUpcoming = await createDemoAppointment({ customer: jordan, date: addDaysYmd(today, d), status: "DEPOSIT_PAID", serviceSlug: "ceramic-coating", paid: "deposit", createdDaysBefore: 4 });
  }

  // Today and upcoming.
  for (const status of ["COMPLETED", "IN_PROGRESS", "CONFIRMED", "DEPOSIT_PAID"] as AppointmentStatus[]) {
    const customer = customers[1 + Math.floor(rand() * (customers.length - 1))]!;
    await createDemoAppointment({ customer, date: today, status, paid: status === "COMPLETED" ? "full" : status === "DEPOSIT_PAID" ? "deposit" : "none", createdDaysBefore: 5 });
  }
  for (let d = 1; d <= 21; d++) {
    const date = addDaysYmd(today, d);
    if (!HOURS[weekdayOfYmd(date)]!.isOpen) continue;
    const count = d <= 7 ? 2 : rand() < 0.5 ? 1 : 0;
    for (let k = 0; k < count; k++) {
      const customer = customers[1 + Math.floor(rand() * (customers.length - 1))]!;
      const r = rand();
      const status: AppointmentStatus = r < 0.45 ? "DEPOSIT_PAID" : r < 0.8 ? "CONFIRMED" : "PENDING";
      await createDemoAppointment({ customer, date, status, paid: status === "DEPOSIT_PAID" ? "deposit" : r > 0.7 && status === "CONFIRMED" ? "full" : "none", createdDaysBefore: 2 + Math.floor(rand() * 6) });
    }
  }

  // Reviews
  for (const [i, r] of REVIEWS.entries()) {
    const linked = pastAppointments[i];
    const createdAt = new Date(now.getTime() - (i * 6 + 2) * 86_400_000);
    await prisma.review.create({
      data: {
        ...r,
        featured: r.featured ?? false,
        status: "APPROVED",
        email: linked?.customer.email ?? null,
        userId: linked?.customer.id ?? null,
        appointmentId: linked?.id ?? null,
        publishedAt: createdAt,
        createdAt,
        adminReply: i === 6 ? "Thanks Tom! We’ve added more Saturday availability — see you next time." : null,
      },
    });
  }
  if (j1) {
    await prisma.review.create({
      data: { name: "Jordan A.", email: jordan.email, userId: jordan.id, appointmentId: j1.id, rating: 5, title: "Model Y feels like a different car", body: "Ceramic all around made a massive difference to the cabin temperature. Super professional crew and spotless install.", vehicle: "2024 Tesla Model Y", status: "APPROVED", publishedAt: new Date(now.getTime() - 90 * 86_400_000), createdAt: new Date(now.getTime() - 90 * 86_400_000) },
    });
  }
  await prisma.review.createMany({
    data: [
      { name: "Brandon F.", rating: 5, title: "Great service", body: "Quick turnaround on my sun strip and front windows. Will recommend to friends for sure.", vehicle: "2021 Honda Civic", status: "PENDING" },
      { name: "Unhappy Driver", rating: 2, body: "Had to wait 15 minutes past my appointment time before they started on my car.", vehicle: "2018 Nissan Altima", status: "PENDING" },
    ],
  });

  // Gallery
  for (const [i, g] of GALLERY.entries()) {
    await prisma.galleryImage.create({
      data: {
        title: g.title,
        caption: g.caption ?? null,
        alt: `${g.vehicle} with professional window tint`,
        imageUrl: `/images/demo/${g.file}`,
        beforeImageUrl: g.before ? `/images/demo/${g.before}` : null,
        width: g.w,
        height: g.h,
        categories: g.categories,
        vehicle: g.vehicle,
        featured: g.featured ?? false,
        sortOrder: i,
      },
    });
  }

  // Quotes
  const quoteSeeds: { status: QuoteStatus; days: number; customer: number; service: string }[] = [
    { status: "NEW", days: 0, customer: 3, service: "ceramic-window-tint" },
    { status: "NEW", days: 1, customer: 7, service: "paint-protection-film" },
    { status: "CONTACTED", days: 3, customer: 9, service: "window-tint" },
    { status: "ESTIMATE_SENT", days: 5, customer: 11, service: "ceramic-coating" },
    { status: "APPROVED", days: 8, customer: 13, service: "carbon-window-tint" },
    { status: "DECLINED", days: 15, customer: 15, service: "window-tint" },
    { status: "ESTIMATE_SENT", days: 20, customer: 0, service: "paint-protection-film" },
  ];
  for (const q of quoteSeeds) {
    const customer = customers[q.customer]!;
    const { service, optionId, filmTypeId } = job(q.service);
    const price = calculatePrice(catalog, { serviceId: service.id, optionId, filmTypeId, vehicleTypeId: ids.types[customer.car.type], vehicleSizeId: ids.sizes[customer.car.size] });
    if (!price.ok) continue;
    const film = catalog.films.find((f) => f.id === filmTypeId);
    const responded = q.status === "ESTIMATE_SENT" || q.status === "APPROVED" || q.status === "DECLINED";
    await prisma.quote.create({
      data: {
        reference: `QT-${code(7)}`,
        userId: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        vehicleYear: customer.year,
        vehicleMake: customer.car.make,
        vehicleModel: customer.car.model,
        vehicleTypeId: ids.types[customer.car.type],
        vehicleSizeId: ids.sizes[customer.car.size],
        serviceId: service.id,
        serviceOptionId: price.optionId,
        filmTypeId: price.filmTypeId,
        shade: film ? pick(film.shades) : null,
        notes: q.status === "NEW" ? "Looking to get this done in the next couple of weeks. Is Saturday possible?" : null,
        estimatedTotal: price.subtotal,
        status: q.status,
        quotedPrice: responded ? price.subtotal - $(25) : null,
        responseMessage: responded ? `Hi ${customer.name.split(" ")[0]}, thanks for reaching out! Based on your vehicle we can do this for the price below, including our written warranty. Reply or book online any time.` : null,
        respondedAt: responded ? new Date(now.getTime() - (q.days - 1) * 86_400_000) : null,
        adminNotes: q.status === "CONTACTED" ? "Left voicemail, follow up Thursday." : null,
        createdAt: new Date(now.getTime() - q.days * 86_400_000 - 3_600_000),
        items: { create: price.lines.map((l) => ({ kind: l.kind, label: l.label, description: l.description ?? null, serviceOptionId: l.optionId ?? null, unitPrice: l.amount, total: l.amount })) },
      },
    });
  }

  // Contact messages
  await prisma.contactMessage.createMany({
    data: [
      { name: "Samantha Lee", email: "samantha.lee@example.com", phone: "(555) 013-8812", vehicle: "2023 Lexus RX 350", serviceInterest: "Windshield Tint", message: "Hi! Do you install clear ceramic on windshields with a heads-up display? Want to make sure the HUD still works.", status: "NEW", createdAt: new Date(now.getTime() - 5 * 3_600_000) },
      { name: "Fleet Manager — Bright Plumbing", email: "fleet@example.com", phone: "(555) 015-2210", vehicle: "6× Ford Transit vans", serviceInterest: "Window Tint", message: "We have six Transit vans that need rear and side windows tinted. Do you offer fleet pricing and could you do two per day?", status: "NEW", createdAt: new Date(now.getTime() - 26 * 3_600_000) },
      { name: "Mike Torres", email: "mike.t@example.com", message: "What’s the darkest legal tint for front windows in California?", status: "REPLIED", adminNotes: "Replied: 70% VLT on front sides, any on rear.", createdAt: new Date(now.getTime() - 4 * 86_400_000) },
    ],
  });

  // Coupons
  const in60 = new Date(now.getTime() + 60 * 86_400_000);
  await prisma.coupon.create({ data: { code: "WELCOME10", description: "10% off your first appointment", type: "PERCENT", value: 10, maxDiscount: $(100), perCustomerLimit: 1, usageCount: 12 } });
  await prisma.coupon.create({ data: { code: "SAVE50", description: "$50 off any service over $300", type: "FIXED", value: $(50), minPurchase: $(300), expiresAt: in60, usageLimit: 100, usageCount: 23 } });
  await prisma.coupon.create({
    data: { code: "CERAMIC15", description: "15% off ceramic tint", type: "PERCENT", value: 15, expiresAt: in60, services: { connect: [{ id: ids.services["ceramic-window-tint"] }] } },
  });

  // Notifications
  await prisma.notification.createMany({
    data: [
      { audience: "ADMIN", type: "NEW_QUOTE", title: "New quote request", body: `${customers[3]!.name} requested a ceramic tint quote`, link: "/admin/quotes", createdAt: new Date(now.getTime() - 2 * 3_600_000) },
      { audience: "ADMIN", type: "NEW_CONTACT", title: "New message from Samantha Lee", body: "Do you install clear ceramic on windshields with a heads-up display?", link: "/admin/messages", createdAt: new Date(now.getTime() - 5 * 3_600_000) },
      { audience: "ADMIN", type: "NEW_REVIEW", title: "New 5★ review from Brandon F.", body: "Quick turnaround on my sun strip and front windows.", link: "/admin/reviews?status=PENDING", createdAt: new Date(now.getTime() - 20 * 3_600_000) },
      ...(jordanUpcoming
        ? [
            { userId: jordan.id!, audience: "CUSTOMER" as const, type: "BOOKING_CONFIRMED" as const, title: "Booking confirmed", body: `Your ceramic coating appointment ${jordanUpcoming.reference} is confirmed.`, link: `/dashboard/appointments/${jordanUpcoming.id}`, createdAt: new Date(now.getTime() - 4 * 86_400_000) },
            { userId: jordan.id!, audience: "CUSTOMER" as const, type: "PAYMENT_RECEIVED" as const, title: "Deposit received", body: "Thanks! We received your deposit.", link: "/dashboard/payments", createdAt: new Date(now.getTime() - 4 * 86_400_000) },
          ]
        : []),
      { userId: jordan.id!, audience: "CUSTOMER", type: "QUOTE_RESPONSE", title: "Your PPF quote is ready", body: "We’ve sent an estimate for paint protection film.", link: "/dashboard/quotes", createdAt: new Date(now.getTime() - 19 * 86_400_000), readAt: new Date(now.getTime() - 18 * 86_400_000) },
    ],
  });

  return { admin };
}

async function main() {
  console.log(`Seeding (${MODE} mode)…`);
  if (MODE === "demo") {
    if (process.env.NODE_ENV === "production") throw new Error("Demo seed is disabled in production. Use SEED_MODE=catalog.");
    await wipe();
  }
  const ids = await seedCatalog();
  if (MODE === "demo") {
    await seedDemo(ids);
    const counts = await Promise.all([prisma.appointment.count(), prisma.payment.count(), prisma.review.count(), prisma.galleryImage.count(), prisma.user.count()]);
    console.log(`Created ${counts[0]} appointments, ${counts[1]} payments, ${counts[2]} reviews, ${counts[3]} gallery images, ${counts[4]} users.`);
    console.log(`Demo admin:    ${process.env.SEED_ADMIN_EMAIL || "admin@example.com"} (SUPER_ADMIN) — also manager@example.com (ADMIN), staff@example.com (STAFF)`);
    console.log(`Demo customer: ${process.env.SEED_CUSTOMER_EMAIL || "customer@example.com"}`);
    console.log("Passwords come from SEED_ADMIN_PASSWORD / SEED_CUSTOMER_PASSWORD in .env.");
  }
  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
