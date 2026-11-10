import type { SupabaseClient } from "@supabase/supabase-js";
import { createEmptyRequirement, DEFAULT_PRICING } from "@/lib/portal-data";
import type {
  ActivityItem,
  BusinessType,
  Coupon,
  PackageName,
  PortalNotification,
  PricingSettings,
  Project,
  RequirementComment,
  RequirementData,
  RequirementStep,
  Role,
  Stage,
  TeamMember,
} from "@/lib/portal-types";

function dbRoleToUi(role: string): Role {
  return role === "admin" ? "Admin" : "Developer";
}

function dbStageToUi(stage: string): Stage {
  if (stage === "building") return "Building";
  if (stage === "completed") return "Completed";
  return "Requirements";
}

function uiStageToDb(stage: Stage): "requirements" | "building" | "completed" {
  if (stage === "Building") return "building";
  if (stage === "Completed") return "completed";
  return "requirements";
}

function uiBusinessTypeToDb(
  bt: BusinessType
): "service" | "product" | "both" | "unset" {
  if (bt === "Service-based") return "service";
  if (bt === "Product-based") return "product";
  if (bt === "Both") return "both";
  return "unset";
}

function dbBusinessTypeToUi(bt: string | null): BusinessType {
  if (bt === "service") return "Service-based";
  if (bt === "product") return "Product-based";
  if (bt === "both") return "Both";
  return "";
}

function uiExtraStatusToDb(
  status: RequirementData["extraPagesStatus"]
): "not_requested" | "pending" | "approved" | "rejected" {
  if (status === "Pending agency approval") return "pending";
  if (status === "Approved") return "approved";
  if (status === "Rejected") return "rejected";
  return "not_requested";
}

function dbExtraStatusToUi(
  status: string | null
): RequirementData["extraPagesStatus"] {
  if (status === "pending") return "Pending agency approval";
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Not requested";
}

function formatDbTimestamp(ts: string | null | undefined): string {
  if (!ts) return "Just now";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface WorkspaceSnapshot {
  companyId: string;
  currentProfile: TeamMember;
  team: TeamMember[];
  pricing: PricingSettings;
  coupons: Coupon[];
  projects: Project[];
  activities: ActivityItem[];
  notifications: PortalNotification[];
}

export async function fetchWorkspaceSnapshot(
  supabase: SupabaseClient,
  authUserId: string
): Promise<WorkspaceSnapshot> {
  const { data: myProfileRow, error: myProfileErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authUserId)
    .single();

  if (myProfileErr || !myProfileRow) {
    throw new Error(
      myProfileErr?.message ||
        "No profile found for this user. Ensure supabase/schema.sql was executed."
    );
  }

  const companyId = myProfileRow.company_id as string;

  const [
    profilesRes,
    pkgRes,
    couponsRes,
    reqsRes,
    commentsRes,
    activityRes,
    notifRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true }),
    supabase
      .from("package_settings")
      .select("*")
      .eq("company_id", companyId),
    supabase
      .from("coupons")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("requirements")
      .select("*, clients(*)")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("requirement_comments")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("activity_logs")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("notifications")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const teamRows = profilesRes.data ?? [];
  const team: TeamMember[] = teamRows.map((p) => ({
    id: p.id,
    name: p.full_name,
    email: p.email,
    role: dbRoleToUi(p.role),
    active: Boolean(p.is_active),
    lastActive: formatDbTimestamp(p.updated_at),
  }));
  const teamMap = new Map(team.map((m) => [m.id, m]));

  // Pricing
  const pricing: PricingSettings = structuredClone(DEFAULT_PRICING);
  const pkgRows = pkgRes.data ?? [];
  if (pkgRows.length > 0) {
    for (const row of pkgRows) {
      const name = row.package_name as PackageName;
      if (!pricing.packages[name]) continue;
      pricing.packages[name] = {
        name,
        price: Number(row.price ?? pricing.packages[name].price),
        limit: Number(row.included_pages ?? pricing.packages[name].limit),
        description: row.description || pricing.packages[name].description,
        bestFor: row.best_for || pricing.packages[name].bestFor,
        features: Array.isArray(row.features)
          ? (row.features as string[])
          : pricing.packages[name].features,
        internalHostingCost:
          row.hosting_internal_cost !== null &&
          row.hosting_internal_cost !== undefined
            ? Number(row.hosting_internal_cost)
            : null,
      };
      pricing.hostingIncluded = Boolean(row.hosting_included);
      if (row.hosting_frequency) {
        pricing.hostingFrequency =
          row.hosting_frequency as PricingSettings["hostingFrequency"];
      }
      if (
        row.additional_page_price !== null &&
        row.additional_page_price !== undefined
      ) {
        pricing.additionalPagePrice = Number(row.additional_page_price);
      }
    }
  }

  // Coupons
  const coupons: Coupon[] = (couponsRes.data ?? []).map((c) => ({
    id: c.id,
    code: c.code,
    benefitType: c.benefit_type,
    bonusPages: Number(c.bonus_pages ?? 0),
    discountPercent: Number(c.discount_percent ?? 0),
    discountAmount: Number(c.discount_amount ?? 0),
    allowedPackages: Array.isArray(c.allowed_packages)
      ? (c.allowed_packages as PackageName[])
      : ["Launch", "Growth", "Scale"],
    active: Boolean(c.is_active),
    usageCount: Number(c.usage_count ?? 0),
    maxUses: c.max_uses !== null ? Number(c.max_uses) : null,
    expiry: c.expires_at ? String(c.expires_at).slice(0, 10) : "Not set",
    description: c.description || "",
  }));

  // Comments grouped by requirement_id
  const commentsByReq = new Map<string, RequirementComment[]>();
  for (const cm of commentsRes.data ?? []) {
    const author = teamMap.get(cm.author_id);
    const list = commentsByReq.get(cm.requirement_id) ?? [];
    list.push({
      id: cm.id,
      authorId: cm.author_id,
      authorName: author?.name ?? "Team",
      step: (cm.step as RequirementStep) || "overview",
      section: cm.section || undefined,
      text: cm.body,
      taggedMemberIds: Array.isArray(cm.tagged_member_ids)
        ? cm.tagged_member_ids
        : [],
      createdAt: formatDbTimestamp(cm.created_at),
    });
    commentsByReq.set(cm.requirement_id, list);
  }

  // Projects (clients + requirements)
  const projects: Project[] = (reqsRes.data ?? []).map((r) => {
    const c = (r.clients as Record<string, unknown>) || {};
    const ownerMember = teamMap.get(r.created_by);
    const assignedMember = r.assigned_to ? teamMap.get(r.assigned_to) : undefined;
    const reqData = createEmptyRequirement({
      packageSelected: (r.package_name as PackageName) || "",
      businessType: dbBusinessTypeToUi((c.business_type as string) || null),
      companyName: String(c.business_name ?? ""),
      businessDescription: String(c.business_description ?? ""),
      websitePurpose: String(c.website_purpose ?? ""),
      websitePurposeOther: String(c.website_purpose_other ?? ""),
      hasExistingWebsite:
        (r.has_existing_website as RequirementData["hasExistingWebsite"]) || "",
      existingWebsiteUrl: String(c.website_url ?? ""),
      targetAudience: String(c.target_audience ?? ""),
      selectedPages: Array.isArray(r.selected_pages) ? r.selected_pages : [],
      customPages: Array.isArray(r.custom_pages) ? r.custom_pages : [],
      couponCode: String(r.coupon_code ?? ""),
      extraPages: Number(r.additional_pages_requested ?? 0),
      extraPagesStatus: dbExtraStatusToUi(r.additional_pages_status),
      customPriceOverride:
        r.custom_price_override !== null && r.custom_price_override !== undefined
          ? Number(r.custom_price_override)
          : null,
      customExtraPagePriceOverride:
        r.custom_extra_page_price_override !== null &&
        r.custom_extra_page_price_override !== undefined
          ? Number(r.custom_extra_page_price_override)
          : null,
      pricingAdjustmentNote: String(r.pricing_adjustment_note ?? ""),
      answers: (r.answers as Record<string, string>) || {},
      featureChoices:
        (r.feature_choices as RequirementData["featureChoices"]) || {},
      featureDetails: (r.feature_details as Record<string, string>) || {},
      agencyInternalNotes: String(r.agency_internal_notes ?? ""),
      clientTeam: {
        ...createEmptyRequirement().clientTeam,
        ...((r.client_team as Record<string, string>) || {}),
      },
      driveLink: String(r.drive_link ?? ""),
      files: Array.isArray(r.files_meta) ? r.files_meta : [],
      confirmed: Boolean(r.client_confirmed),
      approvedByName: String(r.client_approved_name ?? ""),
      submittedAt: String(r.submitted_at_label ?? ""),
      taggedMemberIds: Array.isArray(r.tagged_member_ids)
        ? r.tagged_member_ids
        : [],
      comments: commentsByReq.get(r.id) ?? [],
      lastSavedAt: formatDbTimestamp(r.updated_at),
    });

    return {
      id: r.project_code,
      dbRequirementId: r.id,
      dbClientId: r.client_id,
      client: String(c.client_name ?? ""),
      company: String(c.business_name ?? ""),
      ownerId: r.created_by,
      owner: ownerMember?.name ?? "Admin",
      assignedToId: r.assigned_to || r.created_by,
      assignedTo: assignedMember?.name ?? ownerMember?.name ?? "Unassigned",
      stage: dbStageToUi(r.stage),
      updated: formatDbTimestamp(r.updated_at),
      package: (r.package_name as PackageName) || "",
      progress: Number(r.progress ?? 0),
      requirement: reqData,
    };
  });

  // Activity logs
  const activities: ActivityItem[] = (activityRes.data ?? []).map((a) => {
    const actor = a.actor_id ? teamMap.get(a.actor_id) : undefined;
    return {
      id: Number(a.id),
      actor: actor?.name ?? "Team",
      action: a.summary,
      target: a.entity_id || a.entity_type,
      time: formatDbTimestamp(a.created_at),
      type:
        a.action === "mention_tagged"
          ? "Mention"
          : a.action === "requirement_created"
          ? "Created"
          : a.action === "stage_changed"
          ? "Status"
          : a.action === "requirement_deleted"
          ? "Deleted"
          : "Updated",
    };
  });

  // Notifications
  const notifications: PortalNotification[] = (notifRes.data ?? []).map((n) => {
    const recipient = teamMap.get(n.recipient_id);
    const actor = n.actor_id ? teamMap.get(n.actor_id) : undefined;
    return {
      id: n.id,
      recipientId: n.recipient_id,
      recipientName: recipient?.name ?? "User",
      actorId: n.actor_id || "",
      actorName: actor?.name ?? "Team",
      projectId: n.project_code || "",
      projectCompany: n.project_company || "",
      step: (n.step as RequirementStep) || "overview",
      section: n.section || undefined,
      title: n.title,
      message: n.message,
      createdAt: formatDbTimestamp(n.created_at),
      read: Boolean(n.is_read),
      kind: n.kind,
    };
  });

  const currentProfile =
    teamMap.get(authUserId) ?? {
      id: myProfileRow.id,
      name: myProfileRow.full_name,
      email: myProfileRow.email,
      role: dbRoleToUi(myProfileRow.role),
      active: Boolean(myProfileRow.is_active),
      lastActive: "Now",
    };

  return {
    companyId,
    currentProfile,
    team,
    pricing,
    coupons,
    projects,
    activities,
    notifications,
  };
}

export async function createClientRequirementInDb(
  supabase: SupabaseClient,
  companyId: string,
  userId: string,
  project: Project,
  pricing: PricingSettings
): Promise<{ dbClientId: string; dbRequirementId: string }> {
  const req = project.requirement;
  const { data: clientRow, error: clientErr } = await supabase
    .from("clients")
    .insert({
      company_id: companyId,
      client_name: project.client,
      business_name: project.company,
      email: req.clientTeam.contactEmail || null,
      phone: req.clientTeam.contactPhone || null,
      business_type: uiBusinessTypeToDb(req.businessType),
      business_description: req.businessDescription || null,
      website_url: req.existingWebsiteUrl || null,
      target_audience: req.targetAudience || null,
      website_purpose: req.websitePurpose || null,
      website_purpose_other: req.websitePurposeOther || null,
      created_by: userId,
      updated_by: userId,
    })
    .select("id")
    .single();

  if (clientErr || !clientRow) {
    throw new Error(clientErr?.message || "Failed to create client record.");
  }

  const pkgCfg = project.package
    ? pricing.packages[project.package]
    : pricing.packages.Launch;

  const { data: reqRow, error: reqErr } = await supabase
    .from("requirements")
    .insert({
      company_id: companyId,
      client_id: clientRow.id,
      project_code: project.id,
      package_name: project.package || "Launch",
      package_price: pkgCfg?.price ?? 0,
      included_pages: pkgCfg?.limit ?? 5,
      coupon_code: req.couponCode || null,
      selected_pages: req.selectedPages,
      custom_pages: req.customPages,
      additional_pages_requested: req.extraPages,
      additional_pages_status: uiExtraStatusToDb(req.extraPagesStatus),
      hosting_included: pricing.hostingIncluded,
      hosting_frequency: pricing.hostingFrequency,
      has_existing_website: req.hasExistingWebsite,
      answers: req.answers,
      feature_choices: req.featureChoices,
      feature_details: req.featureDetails,
      client_team: req.clientTeam,
      drive_link: req.driveLink,
      files_meta: req.files,
      agency_internal_notes: req.agencyInternalNotes,
      assigned_to: project.assignedToId || userId,
      stage: uiStageToDb(project.stage),
      progress: project.progress,
      created_by: userId,
      updated_by: userId,
    })
    .select("id")
    .single();

  if (reqErr || !reqRow) {
    throw new Error(reqErr?.message || "Failed to create requirement record.");
  }

  await appendActivityInDb(
    supabase,
    companyId,
    userId,
    "requirement_created",
    "requirement",
    project.company,
    "created a requirement for"
  );

  return { dbClientId: clientRow.id, dbRequirementId: reqRow.id };
}

export async function saveRequirementInDb(
  supabase: SupabaseClient,
  companyId: string,
  userId: string,
  project: Project,
  pricing: PricingSettings,
  coupons: Coupon[]
): Promise<void> {
  if (!project.dbRequirementId || !project.dbClientId) return;
  const req = project.requirement;
  const matchedCoupon = coupons.find(
    (c) => c.code.toUpperCase() === req.couponCode.trim().toUpperCase()
  );
  const pkgCfg = req.packageSelected
    ? pricing.packages[req.packageSelected]
    : undefined;

  const { error: clientErr } = await supabase
    .from("clients")
    .update({
      client_name: req.clientTeam.contactPerson || project.client,
      business_name: req.companyName || project.company,
      email: req.clientTeam.contactEmail || null,
      phone: req.clientTeam.contactPhone || null,
      business_type: uiBusinessTypeToDb(req.businessType),
      business_description: req.businessDescription || null,
      website_url: req.existingWebsiteUrl || null,
      target_audience: req.targetAudience || null,
      website_purpose: req.websitePurpose || null,
      website_purpose_other: req.websitePurposeOther || null,
      updated_by: userId,
    })
    .eq("id", project.dbClientId);

  if (clientErr) throw new Error(clientErr.message);

  const { error: reqErr } = await supabase
    .from("requirements")
    .update({
      package_name: req.packageSelected || null,
      package_price: pkgCfg?.price ?? 0,
      included_pages: pkgCfg?.limit ?? 5,
      coupon_id: matchedCoupon?.id ?? null,
      coupon_code: req.couponCode || null,
      coupon_bonus_pages:
        matchedCoupon?.benefitType === "bonus_pages"
          ? matchedCoupon.bonusPages
          : 0,
      selected_pages: req.selectedPages,
      custom_pages: req.customPages,
      additional_pages_requested: req.extraPages,
      additional_pages_status: uiExtraStatusToDb(req.extraPagesStatus),
      hosting_included: pricing.hostingIncluded,
      hosting_frequency: pricing.hostingFrequency,
      has_existing_website: req.hasExistingWebsite,
      answers: req.answers,
      feature_choices: req.featureChoices,
      feature_details: req.featureDetails,
      client_team: req.clientTeam,
      drive_link: req.driveLink,
      files_meta: req.files,
      agency_internal_notes: req.agencyInternalNotes,
      custom_price_override: req.customPriceOverride,
      custom_extra_page_price_override: req.customExtraPagePriceOverride,
      pricing_adjustment_note: req.pricingAdjustmentNote,
      tagged_member_ids: req.taggedMemberIds,
      assigned_to: project.assignedToId || null,
      stage: uiStageToDb(project.stage),
      progress: project.progress,
      client_confirmed: req.confirmed,
      client_approved_name: req.approvedByName,
      client_approved_at: req.confirmed ? new Date().toISOString() : null,
      submitted_at_label: req.submittedAt,
      updated_by: userId,
    })
    .eq("id", project.dbRequirementId);

  if (reqErr) throw new Error(reqErr.message);
}

export async function updateStageInDb(
  supabase: SupabaseClient,
  companyId: string,
  userId: string,
  project: Project,
  stage: Stage,
  progress: number
): Promise<void> {
  if (!project.dbRequirementId) return;
  const dbStage = uiStageToDb(stage);
  const { error } = await supabase
    .from("requirements")
    .update({
      stage: dbStage,
      progress,
      completed_at: dbStage === "completed" ? new Date().toISOString() : null,
      updated_by: userId,
    })
    .eq("id", project.dbRequirementId);

  if (error) throw new Error(error.message);

  await appendActivityInDb(
    supabase,
    companyId,
    userId,
    "stage_changed",
    "requirement",
    project.company,
    `moved project to ${stage}`
  );
}

export async function deleteProjectInDb(
  supabase: SupabaseClient,
  companyId: string,
  userId: string,
  project: Project
): Promise<void> {
  if (!project.dbClientId) return;
  await appendActivityInDb(
    supabase,
    companyId,
    userId,
    "requirement_deleted",
    "client",
    project.company,
    "deleted requirement for"
  );
  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", project.dbClientId);
  if (error) throw new Error(error.message);
}

export async function savePricingInDb(
  supabase: SupabaseClient,
  companyId: string,
  userId: string,
  pricing: PricingSettings
): Promise<void> {
  const rows = (["Launch", "Growth", "Scale"] as PackageName[]).map((name) => {
    const p = pricing.packages[name];
    return {
      company_id: companyId,
      package_name: name,
      price: p.price,
      included_pages: p.limit,
      description: p.description,
      best_for: p.bestFor,
      features: p.features,
      hosting_included: pricing.hostingIncluded,
      hosting_internal_cost: p.internalHostingCost,
      hosting_frequency: pricing.hostingFrequency,
      additional_page_price: pricing.additionalPagePrice,
      updated_by: userId,
    };
  });

  const { error } = await supabase
    .from("package_settings")
    .upsert(rows, { onConflict: "company_id,package_name" });

  if (error) throw new Error(error.message);

  await appendActivityInDb(
    supabase,
    companyId,
    userId,
    "settings_updated",
    "package_settings",
    "CoreForge Pricing",
    "updated package & page pricing settings"
  );
}

export async function createCouponInDb(
  supabase: SupabaseClient,
  companyId: string,
  userId: string,
  coupon: Omit<Coupon, "id" | "usageCount">
): Promise<Coupon> {
  const { data, error } = await supabase
    .from("coupons")
    .insert({
      company_id: companyId,
      code: coupon.code,
      benefit_type: coupon.benefitType,
      bonus_pages: coupon.bonusPages,
      discount_percent: coupon.discountPercent,
      discount_amount: coupon.discountAmount,
      allowed_packages: coupon.allowedPackages,
      description: coupon.description,
      expires_at:
        coupon.expiry && coupon.expiry !== "Not set"
          ? new Date(coupon.expiry).toISOString()
          : null,
      max_uses: coupon.maxUses,
      is_active: coupon.active,
      created_by: userId,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message || "Failed to create coupon.");

  await appendActivityInDb(
    supabase,
    companyId,
    userId,
    "coupon_created",
    "coupon",
    coupon.code,
    `created coupon ${coupon.code}`
  );

  return {
    ...coupon,
    id: data.id,
    usageCount: Number(data.usage_count ?? 0),
  };
}

export async function toggleCouponInDb(
  supabase: SupabaseClient,
  couponId: string,
  nextActive: boolean
): Promise<void> {
  const { error } = await supabase
    .from("coupons")
    .update({ is_active: nextActive })
    .eq("id", couponId);
  if (error) throw new Error(error.message);
}

export async function deleteCouponInDb(
  supabase: SupabaseClient,
  couponId: string
): Promise<void> {
  const { error } = await supabase.from("coupons").delete().eq("id", couponId);
  if (error) throw new Error(error.message);
}

export async function insertNotificationsInDb(
  supabase: SupabaseClient,
  companyId: string,
  actorId: string,
  requirementId: string | undefined,
  notifications: PortalNotification[]
): Promise<PortalNotification[]> {
  if (notifications.length === 0) return [];
  const { data, error } = await supabase
    .from("notifications")
    .insert(
      notifications.map((n) => ({
        company_id: companyId,
        recipient_id: n.recipientId,
        actor_id: actorId,
        requirement_id: requirementId || null,
        project_code: n.projectId,
        project_company: n.projectCompany,
        step: n.step,
        section: n.section || null,
        kind: n.kind,
        title: n.title,
        message: n.message,
      }))
    )
    .select("id");
  if (error) throw new Error(error.message);
  return notifications.map((n, idx) => ({
    ...n,
    id: data?.[idx]?.id ? String(data[idx].id) : n.id,
  }));
}

export async function insertCommentAndNotificationsInDb(
  supabase: SupabaseClient,
  params: {
    companyId: string;
    actorId: string;
    project: Project;
    step: RequirementStep;
    section?: string;
    message: string;
    taggedIds: string[];
    notifications: PortalNotification[];
    addComment: boolean;
  }
): Promise<PortalNotification[]> {
  const {
    companyId,
    actorId,
    project,
    step,
    section,
    message,
    taggedIds,
    notifications,
    addComment,
  } = params;

  if (addComment && project.dbRequirementId) {
    await supabase.from("requirement_comments").insert({
      company_id: companyId,
      requirement_id: project.dbRequirementId,
      author_id: actorId,
      step,
      section: section || null,
      body: message,
      tagged_member_ids: taggedIds,
    });
  }

  if (project.dbRequirementId && taggedIds.length > 0) {
    const merged = Array.from(
      new Set([...project.requirement.taggedMemberIds, ...taggedIds])
    );
    await supabase
      .from("requirements")
      .update({ tagged_member_ids: merged, updated_by: actorId })
      .eq("id", project.dbRequirementId);
  }

  let savedNotifications = notifications;
  if (notifications.length > 0) {
    savedNotifications = await insertNotificationsInDb(
      supabase,
      companyId,
      actorId,
      project.dbRequirementId,
      notifications
    );
  }

  if (taggedIds.length > 0) {
    await appendActivityInDb(
      supabase,
      companyId,
      actorId,
      "mention_tagged",
      "requirement",
      project.company,
      section
        ? `tagged team member(s) in ${section} for`
        : "tagged team member(s) in"
    );
  }

  return savedNotifications;
}

export async function markNotificationReadInDb(
  supabase: SupabaseClient,
  notificationId: string
): Promise<void> {
  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);
}

export async function markAllNotificationsReadInDb(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("recipient_id", userId)
    .eq("is_read", false);
}

export async function appendActivityInDb(
  supabase: SupabaseClient,
  companyId: string,
  actorId: string,
  action:
    | "login"
    | "logout"
    | "requirement_created"
    | "requirement_updated"
    | "requirement_deleted"
    | "stage_changed"
    | "coupon_created"
    | "settings_updated"
    | "document_generated"
    | "mention_tagged",
  entityType: string,
  entityId: string,
  summary: string
): Promise<void> {
  await supabase.from("activity_logs").insert({
    company_id: companyId,
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    summary,
  });
}

