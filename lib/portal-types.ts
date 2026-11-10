export type Role = "Admin" | "Developer";
export type Stage = "Requirements" | "Building" | "Completed";
export type PackageName = "Launch" | "Growth" | "Scale";
export type BusinessType = "Service-based" | "Product-based" | "Both" | "";
export type RequirementStep =
  | "overview"
  | "package"
  | "pages"
  | "requirements"
  | "team"
  | "review";

export type CouponBenefitType =
  | "bonus_pages"
  | "percentage_discount"
  | "fixed_discount";

export interface PackageConfig {
  name: PackageName;
  price: number;
  limit: number;
  description: string;
  bestFor: string;
  features: string[];
  internalHostingCost: number | null;
}

export interface PricingSettings {
  packages: Record<PackageName, PackageConfig>;
  additionalPagePrice: number | null;
  hostingIncluded: boolean;
  hostingFrequency: "To be confirmed" | "Monthly" | "Annually" | "One-time";
}

export interface Coupon {
  id: string;
  code: string;
  benefitType: CouponBenefitType;
  bonusPages: number;
  discountPercent: number;
  discountAmount: number;
  allowedPackages: PackageName[];
  active: boolean;
  usageCount: number;
  maxUses: number | null;
  expiry: string;
  description: string;
}

export interface CustomPage {
  id: string;
  name: string;
  purpose: string;
  description: string;
  functionality: string;
  url: string;
}

export interface AssetFile {
  id: string;
  name: string;
  size: number;
  type: string;
  addedAt: string;
}

export interface ClientTeam {
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  decisionMaker: string;
  contentProvider: string;
  designApprover: string;
  finalApprover: string;
}

export interface RequirementComment {
  id: string;
  authorId: string;
  authorName: string;
  step: RequirementStep;
  section?: string;
  text: string;
  taggedMemberIds: string[];
  createdAt: string;
}

export interface RequirementData {
  packageSelected: PackageName | "";
  businessType: BusinessType;
  companyName: string;
  businessDescription: string;
  websitePurpose: string;
  websitePurposeOther: string;
  hasExistingWebsite: "Yes" | "No" | "";
  existingWebsiteUrl: string;
  targetAudience: string;
  selectedPages: string[];
  customPages: CustomPage[];
  couponCode: string;
  extraPages: number;
  extraPagesStatus:
    | "Not requested"
    | "Pending agency approval"
    | "Approved"
    | "Rejected";
  customPriceOverride: number | null;
  customExtraPagePriceOverride: number | null;
  pricingAdjustmentNote: string;
  answers: Record<string, string>;
  featureChoices: Record<string, "Yes" | "No" | "">;
  featureDetails: Record<string, string>;
  agencyInternalNotes: string;
  clientTeam: ClientTeam;
  driveLink: string;
  files: AssetFile[];
  confirmed: boolean;
  approvedByName: string;
  submittedAt: string;
  taggedMemberIds: string[];
  comments: RequirementComment[];
  lastSavedAt: string;
}

export interface Project {
  id: string;
  dbRequirementId?: string;
  dbClientId?: string;
  client: string;
  company: string;
  ownerId: string;
  owner: string;
  assignedToId: string;
  assignedTo: string;
  stage: Stage;
  updated: string;
  package: PackageName | "";
  progress: number;
  requirement: RequirementData;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  lastActive: string;
}

export interface ActivityItem {
  id: number;
  actor: string;
  action: string;
  target: string;
  time: string;
  type: string;
}

export interface PortalNotification {
  id: string;
  recipientId: string;
  recipientName: string;
  actorId: string;
  actorName: string;
  projectId: string;
  projectCompany: string;
  step: RequirementStep;
  section?: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  kind: "mention" | "tag" | "stage" | "assignment" | "approval" | "pricing";
}

