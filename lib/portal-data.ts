import type {
  ActivityItem,
  Coupon,
  PackageName,
  PortalNotification,
  PricingSettings,
  Project,
  RequirementData,
  TeamMember,
} from "./portal-types";

export const PAGE_CATEGORIES: Record<string, string[]> = {
  "Business Pages": [
    "Home",
    "About Us",
    "Our Team",
    "Our Story",
    "Mission & Vision",
    "Careers",
    "Partners",
    "Certifications",
    "Awards",
  ],
  "Services Pages": [
    "Services",
    "Individual Service Pages",
    "Service Categories",
    "Industries We Serve",
    "Solutions",
    "Consultation",
    "Pricing",
    "Booking",
  ],
  "Product Pages": [
    "Products",
    "Product Categories",
    "Individual Product Details",
    "Product Catalogue",
    "Product Comparison",
    "Product Enquiry",
  ],
  "E-commerce Pages": [
    "Shop",
    "Product Listing",
    "Product Details",
    "Shopping Cart",
    "Checkout",
    "My Account",
    "Login / Registration",
    "Order Tracking",
    "Wishlist",
    "Payment Success",
    "Payment Failure",
    "Return & Refund",
  ],
  "Content Pages": [
    "Blog",
    "Blog Categories",
    "Individual Blog Posts",
    "News",
    "News Details",
    "Resources",
    "Downloads",
    "Case Studies",
    "Portfolio",
    "Projects",
  ],
  "Customer Interaction Pages": [
    "Contact Us",
    "FAQ",
    "Testimonials",
    "Reviews",
    "Gallery",
    "Enquiry",
    "Request a Quote",
    "Get a Callback",
    "Appointment Booking",
    "Support",
  ],
  "Legal Pages": [
    "Privacy Policy",
    "Terms & Conditions",
    "Disclaimer",
    "Refund Policy",
    "Shipping Policy",
    "Cookie Policy",
  ],
  "Location & Other Pages": [
    "Locations",
    "Individual Location Pages",
    "Branches",
    "Sitemap",
    "Thank You",
    "Custom Landing Pages",
    "404 Error Page",
  ],
};

export const WEBSITE_PURPOSES = [
  "Generate enquiries / leads",
  "Sell products online",
  "Showcase services and portfolio",
  "Share information / content",
  "Customer portal / business platform",
  "Other",
];

export const REQUIREMENT_SECTIONS: Array<{
  id: string;
  title: string;
  questions: string[];
}> = [
  {
    id: "overview_goals",
    title: "Project Overview & Goals",
    questions: [
      "What are the top three goals for this website?",
      "How will you measure success?",
      "Do you have a preferred launch date?",
    ],
  },
  {
    id: "business_info",
    title: "Business Information",
    questions: [
      "What are your main products or services?",
      "Which locations or markets do you serve?",
      "Who are your main competitors?",
    ],
  },
  {
    id: "design_branding",
    title: "Design & Branding",
    questions: [
      "Do you have an existing brand identity?",
      "Share preferred colours, fonts or visual direction.",
      "List websites you like and explain why.",
    ],
  },
  {
    id: "functional",
    title: "Functional Requirements",
    questions: [
      "What should visitors be able to do on the website?",
      "Do you need forms, search, filters or user accounts?",
      "Describe any special workflows or automation.",
    ],
  },
  {
    id: "seo_marketing",
    title: "SEO & Digital Marketing",
    questions: [
      "Which search terms or services should the website target?",
      "Which locations should SEO focus on?",
      "Do you need analytics or conversion tracking?",
    ],
  },
  {
    id: "content_assets",
    title: "Content & Assets",
    questions: [
      "Who will provide website copy and images?",
      "Do you need copywriting or photography support?",
      "List any content that must be migrated.",
    ],
  },
  {
    id: "hosting_technical",
    title: "Hosting & Technical Requirements",
    questions: [
      "Do you have a domain name?",
      "Do you have a preferred hosting provider?",
      "Any technical, performance or accessibility requirements?",
    ],
  },
  {
    id: "integrations",
    title: "Integrations",
    questions: [
      "Which third-party tools should connect to the website?",
      "Do you need CRM, ERP, email or payment integrations?",
    ],
  },
  {
    id: "legal_compliance",
    title: "Legal & Compliance",
    questions: [
      "Which legal policies or compliance requirements apply?",
      "Do you collect personal or payment information?",
    ],
  },
  {
    id: "maintenance_support",
    title: "Maintenance & Support",
    questions: [
      "Do you need ongoing maintenance?",
      "What support response expectations do you have?",
    ],
  },
  {
    id: "timeline_expectations",
    title: "Timeline & Expectations",
    questions: [
      "What is your expected project start date?",
      "Are there important milestones or dependencies?",
      "Who will provide feedback and how quickly?",
    ],
  },
];

export const PACKAGE_FEATURES: Record<PackageName, string[]> = {
  Launch: [
    "Contact form",
    "WhatsApp integration",
    "Google Maps",
    "Image gallery",
    "Testimonials",
    "Social media links",
    "Basic SEO",
    "Analytics",
    "Enquiry buttons",
    "Downloadable brochure",
  ],
  Growth: [
    "Blog management",
    "CMS",
    "Admin dashboard",
    "Advanced enquiry forms",
    "CRM integration",
    "Lead management",
    "Email automation",
    "Dynamic service pages",
    "Location-based pages",
    "Advanced SEO",
    "Appointment booking",
    "Conversion tracking",
  ],
  Scale: [
    "E-commerce",
    "Product management",
    "Inventory",
    "Shopping cart",
    "Checkout",
    "Payment gateways",
    "Shipping integration",
    "Customer registration",
    "Customer dashboards",
    "Order tracking",
    "Automated invoices",
    "API integrations",
    "ERP / CRM",
    "Custom workflows",
    "Role-based administration",
    "Advanced reporting",
  ],
};

export const DEFAULT_PRICING: PricingSettings = {
  packages: {
    Launch: {
      name: "Launch",
      price: 20000,
      limit: 5,
      description:
        "Professional digital presence for startups and small businesses.",
      bestFor: "New businesses and individuals",
      features: [
        "Responsive website",
        "Essential business pages",
        "Contact and enquiry essentials",
        "Basic SEO foundation",
      ],
      internalHostingCost: 5000,
    },
    Growth: {
      name: "Growth",
      price: 40000,
      limit: 10,
      description:
        "Conversion-focused website designed to generate enquiries and support business growth.",
      bestFor: "Growing businesses",
      features: [
        "Everything in Launch",
        "CMS and admin dashboard",
        "Advanced enquiry workflows",
        "SEO and lead generation",
      ],
      internalHostingCost: 10000,
    },
    Scale: {
      name: "Scale",
      price: 60000,
      limit: 15,
      description:
        "Complete digital platform with e-commerce, integrations and customer features.",
      bestFor: "Established and growth-focused businesses",
      features: [
        "Everything in Growth",
        "E-commerce capabilities",
        "Customer accounts and workflows",
        "Advanced integrations",
      ],
      internalHostingCost: null,
    },
  },
  additionalPagePrice: null,
  hostingIncluded: true,
  hostingFrequency: "To be confirmed",
};

export const DEFAULT_COUPONS: Coupon[] = [
  {
    id: "cpn-offplus2",
    code: "OFFPLUS2",
    benefitType: "bonus_pages",
    bonusPages: 2,
    discountPercent: 0,
    discountAmount: 0,
    allowedPackages: ["Launch", "Growth", "Scale"],
    active: true,
    usageCount: 1,
    maxUses: null,
    expiry: "Not set",
    description: "+2 additional page slots in sitemap",
  },
  {
    id: "cpn-off10",
    code: "OFF10",
    benefitType: "percentage_discount",
    bonusPages: 0,
    discountPercent: 10,
    discountAmount: 0,
    allowedPackages: ["Launch", "Growth", "Scale"],
    active: true,
    usageCount: 0,
    maxUses: null,
    expiry: "Not set",
    description: "10% off package & additional page subtotal",
  },
  {
    id: "cpn-off25",
    code: "OFF25",
    benefitType: "percentage_discount",
    bonusPages: 0,
    discountPercent: 25,
    discountAmount: 0,
    allowedPackages: ["Launch", "Growth", "Scale"],
    active: true,
    usageCount: 0,
    maxUses: null,
    expiry: "Not set",
    description: "25% off package & additional page subtotal",
  },
  {
    id: "cpn-off50",
    code: "OFF50",
    benefitType: "percentage_discount",
    bonusPages: 0,
    discountPercent: 50,
    discountAmount: 0,
    allowedPackages: ["Launch", "Growth", "Scale"],
    active: true,
    usageCount: 0,
    maxUses: null,
    expiry: "Not set",
    description: "50% off package & additional page subtotal",
  },
];

export const INITIAL_TEAM: TeamMember[] = [];

export function createEmptyRequirement(
  overrides: Partial<RequirementData> = {}
): RequirementData {
  return {
    packageSelected: "",
    businessType: "",
    companyName: "",
    businessDescription: "",
    websitePurpose: "",
    websitePurposeOther: "",
    hasExistingWebsite: "",
    existingWebsiteUrl: "",
    targetAudience: "",
    selectedPages: [],
    customPages: [],
    couponCode: "",
    extraPages: 0,
    extraPagesStatus: "Not requested",
    customPriceOverride: null,
    customExtraPagePriceOverride: null,
    pricingAdjustmentNote: "",
    answers: {},
    featureChoices: {},
    featureDetails: {},
    agencyInternalNotes: "",
    clientTeam: {
      contactPerson: "",
      contactEmail: "",
      contactPhone: "",
      decisionMaker: "",
      contentProvider: "",
      designApprover: "",
      finalApprover: "",
    },
    driveLink: "",
    files: [],
    confirmed: false,
    approvedByName: "",
    submittedAt: "",
    taggedMemberIds: [],
    comments: [],
    lastSavedAt: "Not saved yet",
    isDraft: true,
    draftStep: "package",
    ...overrides,
  };
}

export const INITIAL_PROJECTS: Project[] = [];

export const INITIAL_ACTIVITIES: ActivityItem[] = [];

export const INITIAL_NOTIFICATIONS: PortalNotification[] = [];

export function formatINR(value: number | null | undefined): string {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

export function formatCouponBenefit(coupon: Coupon): string {
  if (coupon.benefitType === "bonus_pages") {
    return `+${coupon.bonusPages} additional pages`;
  }
  if (coupon.benefitType === "percentage_discount") {
    return `${coupon.discountPercent}% off`;
  }
  return `${formatINR(coupon.discountAmount)} off`;
}

export interface QuoteBreakdown {
  packageName: PackageName | "";
  basePackagePrice: number;
  isPriceOverridden: boolean;
  includedPages: number;
  appliedCoupon: Coupon | null;
  bonusPages: number;
  totalPageAllowance: number;
  extraPages: number;
  effectiveExtraPagePrice: number | null;
  extraPagesCost: number | null;
  subtotal: number;
  discountAmount: number;
  estimatedTotal: number;
  hostingIncluded: boolean;
  hostingFrequency: string;
  internalHostingCost: number | null;
}

export function calculateQuote(
  req: RequirementData,
  pricing: PricingSettings,
  coupons: Coupon[]
): QuoteBreakdown {
  const pkgName = req.packageSelected;
  const pkgCfg = pkgName ? pricing.packages[pkgName] : undefined;

  const defaultPkgPrice = pkgCfg?.price ?? 0;
  const isPriceOverridden = req.customPriceOverride !== null;
  const basePackagePrice =
    req.customPriceOverride !== null ? req.customPriceOverride : defaultPkgPrice;

  const includedPages = pkgCfg?.limit ?? 0;

  const normalizedCode = req.couponCode.trim().toUpperCase();
  const matchedCoupon = normalizedCode
    ? coupons.find(
        (c) =>
          c.code.toUpperCase() === normalizedCode &&
          c.active &&
          (!pkgName || c.allowedPackages.includes(pkgName))
      ) ?? null
    : null;

  const bonusPages =
    matchedCoupon && matchedCoupon.benefitType === "bonus_pages"
      ? matchedCoupon.bonusPages
      : 0;
  const totalPageAllowance = includedPages + bonusPages;

  const extraPages = Math.max(0, Number(req.extraPages) || 0);
  const effectiveExtraPagePrice =
    req.customExtraPagePriceOverride !== null
      ? req.customExtraPagePriceOverride
      : pricing.additionalPagePrice;

  const extraPagesCost =
    extraPages === 0
      ? 0
      : effectiveExtraPagePrice === null
      ? null
      : extraPages * effectiveExtraPagePrice;

  const subtotal = basePackagePrice + (extraPagesCost ?? 0);

  let discountAmount = 0;
  if (matchedCoupon) {
    if (matchedCoupon.benefitType === "percentage_discount") {
      discountAmount = Math.round(
        (subtotal * matchedCoupon.discountPercent) / 100
      );
    } else if (matchedCoupon.benefitType === "fixed_discount") {
      discountAmount = Math.min(subtotal, matchedCoupon.discountAmount);
    }
  }

  const estimatedTotal = Math.max(0, subtotal - discountAmount);

  return {
    packageName: pkgName,
    basePackagePrice,
    isPriceOverridden,
    includedPages,
    appliedCoupon: matchedCoupon,
    bonusPages,
    totalPageAllowance,
    extraPages,
    effectiveExtraPagePrice,
    extraPagesCost,
    subtotal,
    discountAmount,
    estimatedTotal,
    hostingIncluded: pricing.hostingIncluded,
    hostingFrequency: pricing.hostingFrequency,
    internalHostingCost: pkgCfg?.internalHostingCost ?? null,
  };
}

export function computeRequirementCompletion(req: RequirementData): number {
  let score = 0;
  // 1. Package selected (20%)
  if (req.packageSelected) score += 20;

  // 2. Five mandatory business questions (25%)
  const mandatoryDone = [
    req.companyName.trim(),
    req.businessDescription.trim(),
    req.websitePurpose.trim() &&
      (req.websitePurpose !== "Other" || req.websitePurposeOther.trim()),
    req.hasExistingWebsite,
    req.targetAudience.trim(),
  ].filter(Boolean).length;
  score += Math.round((mandatoryDone / 5) * 25);

  // 3. Sitemap pages selected (15%)
  if (req.selectedPages.length > 0 || req.customPages.length > 0) score += 15;

  // 4. Questionnaire & features (20%)
  const answeredCount = Object.values(req.answers).filter((v) =>
    v.trim()
  ).length;
  const featureCount = Object.values(req.featureChoices).filter(Boolean).length;
  if (answeredCount > 0 || featureCount > 0) {
    score += Math.min(20, Math.round(((answeredCount + featureCount) / 8) * 20));
  }

  // 5. Team & assets (10%)
  if (
    req.clientTeam.contactPerson.trim() ||
    req.clientTeam.contactEmail.trim() ||
    req.driveLink.trim() ||
    req.files.length > 0
  ) {
    score += 10;
  }

  // 6. Client review & approval (10%)
  if (req.confirmed && req.approvedByName.trim()) score += 10;

  return Math.min(100, score);
}

/**
 * Finds all team members whose `@Name` appears in text.
 */
export function extractMentionedMemberIds(
  text: string,
  team: TeamMember[]
): string[] {
  const lower = text.toLowerCase();
  const matchedIds: string[] = [];
  const sorted = [...team].sort((a, b) => b.name.length - a.name.length);
  let remaining = lower;

  for (const member of sorted) {
    const fullMention = `@${member.name.toLowerCase()}`;
    if (remaining.includes(fullMention)) {
      if (!matchedIds.includes(member.id)) {
        matchedIds.push(member.id);
      }
      remaining = remaining.replaceAll(fullMention, " ");
    }
  }

  for (const member of sorted) {
    const first = member.name.split(" ")[0].toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!first) continue;
    const re = new RegExp(`@${first}(?=\\b|\\s|$)`);
    if (re.test(remaining) && !matchedIds.includes(member.id)) {
      matchedIds.push(member.id);
    }
  }

  return matchedIds;
}

function escHtml(s: string | number | null | undefined): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[c] ?? c;
  });
}

export type DocumentOutputMode = "preview" | "print" | "pdf";

export function generateRequirementDocumentHtml(
  project: Project,
  pricing: PricingSettings,
  coupons: Coupon[],
  team: TeamMember[],
  mode: DocumentOutputMode = "preview"
): string {
  const req = project.requirement;
  const quote = calculateQuote(req, pricing, coupons);
  const taggedNames = team
    .filter((m) => req.taggedMemberIds.includes(m.id))
    .map((m) => m.name);

  const purposeText =
    req.websitePurpose === "Other" && req.websitePurposeOther
      ? `Other: ${req.websitePurposeOther}`
      : req.websitePurpose || "—";

  const answerRows = REQUIREMENT_SECTIONS.flatMap((sec) =>
    sec.questions.map((q, idx) => {
      const val = req.answers[`${sec.title}_${idx}`] || "";
      if (!val.trim()) return "";
      return `<div class="row"><b>${escHtml(sec.title)} · ${escHtml(q)}</b><span>${escHtml(val)}</span></div>`;
    })
  )
    .filter(Boolean)
    .join("");

  const selectedFeatures = Object.entries(req.featureChoices)
    .filter(([, choice]) => choice === "Yes")
    .map(([feature]) => {
      const detail = req.featureDetails[feature] || "";
      return `<li><b>${escHtml(feature)}</b>${detail ? ` — ${escHtml(detail)}` : ""}</li>`;
    })
    .join("");

  const autoPrintScript =
    mode === "print" || mode === "pdf"
      ? `<script>window.onload = function() { setTimeout(function() { window.print(); }, 180); };</script>`
      : "";

  const pdfHint =
    mode === "pdf"
      ? `<span class="hint">In the print dialog, choose <b>Destination → Save as PDF</b> to export your PDF.</span>`
      : `<span class="hint">Generated requirement specification preview</span>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Website Requirements - ${escHtml(req.companyName || project.company)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font: 12px/1.6 'Inter', Arial, sans-serif; color: #111; padding: 36px; max-width: 860px; margin: 0 auto; }
  h1 { font-size: 24px; margin: 0 0 4px; letter-spacing: -0.5px; }
  h2 { font-size: 15px; border-bottom: 1px solid #d4d4d4; padding-bottom: 6px; margin-top: 26px; page-break-after: avoid; }
  .muted { color: #666; }
  .row { padding: 7px 0; border-bottom: 1px solid #ececec; display: flex; justify-content: space-between; gap: 18px; page-break-inside: avoid; }
  .row b { min-width: 240px; flex: 0 0 240px; }
  .row span { flex: 1; text-align: right; }
  ul { padding-left: 18px; }
  li { margin: 4px 0; }
  .box { background: #fafafa; border: 1px solid #e5e5e5; border-radius: 6px; padding: 12px 14px; margin: 10px 0; page-break-inside: avoid; }
  .doc-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; background: #171717; color: #fff; padding: 12px 16px; border-radius: 8px; margin-bottom: 24px; }
  .doc-toolbar .hint { font-size: 12px; color: #e5e5e5; }
  .doc-toolbar .actions { display: flex; gap: 8px; }
  .doc-toolbar button { border: 1px solid #fff; background: #fff; color: #111; padding: 7px 12px; border-radius: 6px; font-weight: 600; font-size: 12px; cursor: pointer; }
  .doc-toolbar button.ghost { background: transparent; color: #fff; border-color: #666; }
  @media print {
    body { padding: 0; max-width: none; }
    .doc-toolbar { display: none !important; }
  }
</style>
</head>
<body>
  <div class="doc-toolbar">
    ${pdfHint}
    <div class="actions">
      <button type="button" onclick="window.print()">Print / Save as PDF</button>
      <button type="button" class="ghost" onclick="window.close()">Close</button>
    </div>
  </div>
  <h1>Website Requirements Document</h1>
  <p class="muted">COREFORGE LLP · Project ${escHtml(project.id)} · Stage: ${escHtml(project.stage)}</p>

  <h2>Client &amp; Business Profile</h2>
  <div class="row"><b>Company Name</b><span>${escHtml(req.companyName || project.company)}</span></div>
  <div class="row"><b>Primary Contact</b><span>${escHtml(req.clientTeam.contactPerson || project.client)} (${escHtml(req.clientTeam.contactEmail || "—")})</span></div>
  <div class="row"><b>Business Type</b><span>${escHtml(req.businessType || "—")}</span></div>
  <div class="row"><b>Business Overview</b><span>${escHtml(req.businessDescription || "—")}</span></div>
  <div class="row"><b>Primary Purpose</b><span>${escHtml(purposeText)}</span></div>
  <div class="row"><b>Existing Website</b><span>${escHtml(req.hasExistingWebsite || "—")}${req.hasExistingWebsite === "Yes" && req.existingWebsiteUrl ? ` (${escHtml(req.existingWebsiteUrl)})` : ""}</span></div>
  <div class="row"><b>Target Audience</b><span>${escHtml(req.targetAudience || "—")}</span></div>

  <h2>Package &amp; Sitemap</h2>
  <div class="row"><b>Selected Package</b><span>${escHtml(quote.packageName || "Not selected")} — ${escHtml(formatINR(quote.basePackagePrice))}${quote.isPriceOverridden ? " (Custom quoted)" : ""}</span></div>
  <div class="row"><b>Page Allowance</b><span>${quote.totalPageAllowance} pages${quote.bonusPages ? ` (includes +${quote.bonusPages} coupon bonus)` : ""}</span></div>
  <div class="row"><b>Selected Pages (${req.selectedPages.length})</b><span>${req.selectedPages.length ? escHtml(req.selectedPages.join(", ")) : "None selected"}</span></div>
  <div class="row"><b>Additional Pages Requested</b><span>${quote.extraPages} (${escHtml(req.extraPagesStatus)})</span></div>

  ${
    req.customPages.length
      ? `<h2>Custom Pages</h2>${req.customPages
          .map(
            (cp, idx) =>
              `<div class="box"><b>${idx + 1}. ${escHtml(cp.name || "Untitled custom page")}</b><br/>Purpose: ${escHtml(cp.purpose || "—")}<br/>Description: ${escHtml(cp.description || "—")}<br/>Functionality: ${escHtml(cp.functionality || "—")}<br/>Reference URL: ${escHtml(cp.url || "—")}</div>`
          )
          .join("")}`
      : ""
  }

  <h2>Quotation Estimate</h2>
  <div class="row"><b>Website Development Package</b><span>${escHtml(formatINR(quote.basePackagePrice))}</span></div>
  <div class="row"><b>Additional Page Charges</b><span>${quote.extraPagesCost === null ? "Pending agency configuration" : escHtml(formatINR(quote.extraPagesCost))}</span></div>
  <div class="row"><b>Applied Coupon</b><span>${quote.appliedCoupon ? `${escHtml(quote.appliedCoupon.code)} (${escHtml(formatCouponBenefit(quote.appliedCoupon))})` : "None"}</span></div>
  ${quote.discountAmount > 0 ? `<div class="row"><b>Coupon Discount</b><span>-${escHtml(formatINR(quote.discountAmount))}</span></div>` : ""}
  <div class="row"><b>Hosting</b><span>${quote.hostingIncluded ? "Included in package (₹0 additional)" : "Configured separately"} · ${escHtml(quote.hostingFrequency)}</span></div>
  <div class="row"><b>Estimated Payable Total</b><span><b>${escHtml(formatINR(quote.estimatedTotal))}</b></span></div>
  <div class="row"><b>Taxes</b><span>Not calculated (subject to agency review)</span></div>

  <h2>Project Requirements &amp; Features</h2>
  ${answerRows || "<p class='muted'>No detailed questionnaire answers recorded yet.</p>"}
  ${selectedFeatures ? `<h3>Selected Package Features</h3><ul>${selectedFeatures}</ul>` : ""}

  <h2>Team &amp; Assets</h2>
  <div class="row"><b>Primary Contact</b><span>${escHtml(req.clientTeam.contactPerson || "—")}</span></div>
  <div class="row"><b>Contact Email / Phone</b><span>${escHtml(req.clientTeam.contactEmail || "—")} · ${escHtml(req.clientTeam.contactPhone || "—")}</span></div>
  <div class="row"><b>Decision-Maker</b><span>${escHtml(req.clientTeam.decisionMaker || "—")}</span></div>
  <div class="row"><b>Content Provider</b><span>${escHtml(req.clientTeam.contentProvider || "—")}</span></div>
  <div class="row"><b>Design Approver</b><span>${escHtml(req.clientTeam.designApprover || "—")}</span></div>
  <div class="row"><b>Final Approver</b><span>${escHtml(req.clientTeam.finalApprover || "—")}</span></div>
  <div class="row"><b>Google Drive Folder</b><span>${escHtml(req.driveLink || "—")}</span></div>
  <div class="row"><b>Attached Assets</b><span>${req.files.length ? escHtml(req.files.map((f) => f.name).join(", ")) : "None"}</span></div>
  <div class="row"><b>Tagged CoreForge Team</b><span>${taggedNames.length ? escHtml(taggedNames.join(", ")) : "None"}</span></div>

  <h2>Client Acknowledgement</h2>
  <div class="box">
    <p><b>Confirmed by:</b> ${escHtml(req.approvedByName || "Pending")} &nbsp;|&nbsp; <b>Date:</b> ${escHtml(req.submittedAt || "Pending")}</p>
    <p>Client acknowledgement: ________________________ &nbsp;&nbsp; Agency representative: ________________________</p>
  </div>
  <p class="muted">Generated from CoreForge Portal. Typed acknowledgement is an internal confirmation and not a legally verified electronic signature. Final scope, pricing, taxes and approval are subject to agency review.</p>
  ${autoPrintScript}
</body>
</html>`;
}
