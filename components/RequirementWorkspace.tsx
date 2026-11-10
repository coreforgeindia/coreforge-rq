"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  AtSign,
  Check,
  CheckCircle2,
  Download,
  FileDown,
  FileText,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  Printer,
  Save,
  Send,
  SlidersHorizontal,
  Tag,
  Trash2,
  Upload,
  UserPlus,
  X,
} from "lucide-react";
import {
  calculateQuote,
  computeRequirementCompletion,
  type DocumentOutputMode,
  formatCouponBenefit,
  formatINR,
  generateRequirementDocumentHtml,
  PACKAGE_FEATURES,
  PAGE_CATEGORIES,
  REQUIREMENT_SECTIONS,
  WEBSITE_PURPOSES,
} from "@/lib/portal-data";
import type {
  BusinessType,
  Coupon,
  CustomPage,
  PackageName,
  PricingSettings,
  Project,
  RequirementData,
  RequirementStep,
  Role,
  Stage,
  TeamMember,
} from "@/lib/portal-types";
import { MentionComposer } from "./MentionComposer";

interface RequirementWorkspaceProps {
  project: Project;
  projects: Project[];
  step: RequirementStep;
  role: Role;
  currentUser: TeamMember;
  team: TeamMember[];
  pricing: PricingSettings;
  coupons: Coupon[];
  onChangeStep: (step: RequirementStep) => void;
  onSelectProject: (projectId: string) => void;
  onBackToList: () => void;
  onUpdateProject: (
    projectId: string,
    updater: (prev: Project) => Project,
    activitySummary?: { action: string; type: string }
  ) => void;
  onMoveStage: (project: Project, nextStage: Stage) => void;
  onTagMembers: (params: {
    project: Project;
    memberIds: string[];
    step: RequirementStep;
    section?: string;
    message: string;
    addComment?: boolean;
  }) => void;
  onOpenGlobalPricing: () => void;
  onSaveProject: (project: Project, quiet?: boolean) => void;
  onNotifyToast: (
    msg: string,
    variant?: "success" | "error" | "info",
    title?: string
  ) => void;
}

const STEP_ITEMS: Array<{ key: RequirementStep; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "package", label: "01 · Package" },
  { key: "pages", label: "02 · Pages & pricing" },
  { key: "requirements", label: "03 · Requirements" },
  { key: "team", label: "04 · Team & assets" },
  { key: "review", label: "05 · Review & approval" },
];

const PACKAGE_ORDER: PackageName[] = ["Launch", "Growth", "Scale"];

export function RequirementWorkspace({
  project,
  projects,
  step,
  role,
  currentUser,
  team,
  pricing,
  coupons,
  onChangeStep,
  onSelectProject,
  onBackToList,
  onUpdateProject,
  onMoveStage,
  onTagMembers,
  onOpenGlobalPricing,
  onSaveProject,
  onNotifyToast,
}: RequirementWorkspaceProps) {
  const req = project.requirement;
  const isAdmin = role === "Admin";

  const [couponInput, setCouponInput] = useState(req.couponCode || "");
  const [couponFeedback, setCouponFeedback] = useState<{
    text: string;
    tone: "success" | "error" | "muted";
  } | null>(null);
  const [validationError, setValidationError] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [showTagPopover, setShowTagPopover] = useState(false);
  const [quickTagIds, setQuickTagIds] = useState<string[]>([]);
  const [quickTagNote, setQuickTagNote] = useState("");
  const [activeSectionTag, setActiveSectionTag] = useState<string | null>(null);
  const [showQuoteEditor, setShowQuoteEditor] = useState(false);

  const quote = useMemo(
    () => calculateQuote(req, pricing, coupons),
    [req, pricing, coupons]
  );

  const completion = useMemo(
    () => computeRequirementCompletion(req),
    [req]
  );

  const activeTeam = useMemo(() => team.filter((m) => m.active), [team]);

  const taggedMembers = useMemo(
    () => team.filter((m) => req.taggedMemberIds.includes(m.id)),
    [team, req.taggedMemberIds]
  );

  const patchRequirement = (
    updater: (prevReq: RequirementData) => RequirementData,
    extraProjectPatch?: Partial<Project>,
    activitySummary?: { action: string; type: string }
  ) => {
    const nowLabel = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    onUpdateProject(
      project.id,
      (prev) => {
        const nextReq = updater({
          ...prev.requirement,
          lastSavedAt: `Today, ${nowLabel}`,
        });
        const nextProgress = computeRequirementCompletion(nextReq);
        return {
          ...prev,
          company: nextReq.companyName.trim() || prev.company,
          client: nextReq.clientTeam.contactPerson.trim() || prev.client,
          package: nextReq.packageSelected || prev.package,
          progress: nextProgress,
          updated: "Just now",
          ...extraProjectPatch,
          requirement: nextReq,
        };
      },
      activitySummary
    );
  };

  const getMissingMandatoryFields = (): string[] => {
    const missing: string[] = [];
    if (!req.packageSelected) missing.push("Website package");
    if (!req.companyName.trim()) missing.push("Company name");
    if (!req.businessDescription.trim()) missing.push("What the business does");
    if (!req.websitePurpose.trim()) missing.push("Website purpose");
    if (req.websitePurpose === "Other" && !req.websitePurposeOther.trim()) {
      missing.push("Website purpose details");
    }
    if (!req.hasExistingWebsite) missing.push("Existing website (Yes/No)");
    if (!req.targetAudience.trim()) missing.push("Target audience");
    return missing;
  };

  const validateMandatoryStep1 = (requirePackage = false): boolean => {
    const missing: string[] = [];
    if (requirePackage && !req.packageSelected) missing.push("Website package");
    if (!req.companyName.trim()) missing.push("Company name");
    if (!req.businessDescription.trim()) missing.push("What the business does");
    if (!req.websitePurpose.trim()) missing.push("Website purpose");
    if (req.websitePurpose === "Other" && !req.websitePurposeOther.trim()) {
      missing.push("Website purpose details");
    }
    if (!req.hasExistingWebsite) missing.push("Existing website (Yes/No)");
    if (!req.targetAudience.trim()) missing.push("Target audience");

    if (missing.length > 0) {
      const msg = `Incomplete questions: ${missing.join(", ")}.`;
      setValidationError(msg);
      onNotifyToast(msg, "error", "Incomplete questions");
      return false;
    }
    setValidationError("");
    return true;
  };

  const handleGoToStep = (nextStep: RequirementStep) => {
    if (nextStep !== "overview" && nextStep !== "package") {
      if (step === "package" && !validateMandatoryStep1(false)) return;
      if (
        (nextStep === "requirements" ||
          nextStep === "team" ||
          nextStep === "review") &&
        !validateMandatoryStep1(true)
      ) {
        onChangeStep("package");
        return;
      }
    }
    setValidationError("");
    if (nextStep !== step) {
      onSaveProject(project, true);
    }
    onChangeStep(nextStep);
  };

  const applyCouponCode = (rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    setCouponInput(code);
    if (!code) {
      setCouponFeedback({
        text: "Enter a coupon code to apply.",
        tone: "error",
      });
      return;
    }
    const found = coupons.find((c) => c.code.toUpperCase() === code);
    if (!found || !found.active) {
      setCouponFeedback({
        text: "Invalid, paused, or expired coupon code.",
        tone: "error",
      });
      return;
    }
    if (
      req.packageSelected &&
      !found.allowedPackages.includes(req.packageSelected)
    ) {
      setCouponFeedback({
        text: `${found.code} is valid only for ${found.allowedPackages.join(", ")} packages.`,
        tone: "error",
      });
      return;
    }
    if (req.couponCode.toUpperCase() === found.code.toUpperCase()) {
      setCouponFeedback({
        text: `${found.code} is already applied to this requirement.`,
        tone: "muted",
      });
      return;
    }

    patchRequirement(
      (prev) => ({ ...prev, couponCode: found.code }),
      undefined,
      {
        action: `applied coupon ${found.code} (${formatCouponBenefit(found)}) to`,
        type: "Updated",
      }
    );
    setCouponFeedback({
      text: `Coupon ${found.code} applied: ${formatCouponBenefit(found)}.`,
      tone: "success",
    });
    onNotifyToast(`Coupon ${found.code} applied (${formatCouponBenefit(found)}).`);
  };

  const removeCoupon = () => {
    const oldCode = req.couponCode;
    setCouponInput("");
    patchRequirement(
      (prev) => ({ ...prev, couponCode: "" }),
      undefined,
      oldCode
        ? { action: `removed coupon ${oldCode} from`, type: "Updated" }
        : undefined
    );
    setCouponFeedback({ text: "Coupon removed.", tone: "muted" });
  };

  const togglePageSelection = (pageName: string) => {
    const isChecked = req.selectedPages.includes(pageName);
    if (!isChecked && req.selectedPages.length >= quote.totalPageAllowance) {
      onNotifyToast(
        `Page limit of ${quote.totalPageAllowance} reached. Add additional pages or apply OFFPLUS2.`
      );
      return;
    }
    patchRequirement((prev) => ({
      ...prev,
      selectedPages: isChecked
        ? prev.selectedPages.filter((p) => p !== pageName)
        : [...prev.selectedPages, pageName],
    }));
  };

  const addCustomPage = () => {
    const cp: CustomPage = {
      id: `cp-${Date.now()}`,
      name: "",
      purpose: "",
      description: "",
      functionality: "",
      url: "",
    };
    patchRequirement((prev) => ({
      ...prev,
      customPages: [...prev.customPages, cp],
    }));
  };

  const updateCustomPage = (
    id: string,
    field: keyof CustomPage,
    value: string
  ) => {
    patchRequirement((prev) => ({
      ...prev,
      customPages: prev.customPages.map((p) =>
        p.id === id ? { ...p, [field]: value } : p
      ),
    }));
  };

  const removeCustomPage = (id: string) => {
    patchRequirement((prev) => ({
      ...prev,
      customPages: prev.customPages.filter((p) => p.id !== id),
    }));
  };

  const handleQuickTagSubmit = () => {
    if (quickTagIds.length === 0) {
      onNotifyToast("Select at least one team member to tag.");
      return;
    }
    const taggedNames = team
      .filter((m) => quickTagIds.includes(m.id))
      .map((m) => `@${m.name}`)
      .join(", ");
    const msg =
      quickTagNote.trim() ||
      `${currentUser.name} tagged ${taggedNames} in ${project.company} (${STEP_ITEMS.find((s) => s.key === step)?.label || step}).`;

    onTagMembers({
      project,
      memberIds: quickTagIds,
      step,
      message: msg,
      addComment: true,
    });
    setQuickTagIds([]);
    setQuickTagNote("");
    setShowTagPopover(false);
  };

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const added = Array.from(fileList).map((f, idx) => ({
      id: `file-${Date.now()}-${idx}`,
      name: f.name,
      size: f.size,
      type: f.type || "application/octet-stream",
      addedAt: "Just now",
    }));
    patchRequirement(
      (prev) => ({
        ...prev,
        files: [...prev.files, ...added],
      }),
      undefined,
      {
        action: `attached ${added.length} asset file(s) to`,
        type: "Updated",
      }
    );
    onNotifyToast(`${added.length} file(s) attached in browser preview.`);
  };

  const handleExportJson = () => {
    const payload = JSON.stringify({ project, pricing, coupons }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CoreForge_Project_${project.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onNotifyToast(`Exported ${project.id} JSON.`);
  };

  const handleSaveOnly = () => {
    const nowLabel = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const updatedProj: Project = {
      ...project,
      company: req.companyName.trim() || project.company,
      client: req.clientTeam.contactPerson.trim() || project.client,
      package: req.packageSelected || project.package,
      progress: computeRequirementCompletion(req),
      updated: "Just now",
      requirement: {
        ...req,
        lastSavedAt: `Today, ${nowLabel}`,
      },
    };
    patchRequirement((prev) => ({
      ...prev,
      lastSavedAt: `Today, ${nowLabel}`,
    }));
    onSaveProject(updatedProj);
  };

  const handleOpenDocument = (mode: DocumentOutputMode) => {
    const missingMandatory = getMissingMandatoryFields();
    if (mode === "preview") {
      if (!req.confirmed) missingMandatory.push("Client confirmation checkbox");
      if (!req.approvedByName.trim()) {
        missingMandatory.push("Digital acknowledgement full name");
      }
    }

    if (missingMandatory.length > 0) {
      const msg = `Complete these required fields first: ${missingMandatory.join(", ")}.`;
      setValidationError(msg);
      onNotifyToast(msg, "error", "Incomplete questions");
      return;
    }

    setValidationError("");
    const submittedStamp = req.submittedAt || new Date().toLocaleString();
    const updatedReq: RequirementData = {
      ...req,
      submittedAt: mode === "preview" ? new Date().toLocaleString() : submittedStamp,
    };
    const updatedProj: Project = {
      ...project,
      requirement: updatedReq,
    };

    if (mode === "preview") {
      patchRequirement(
        (prev) => ({
          ...prev,
          submittedAt: updatedReq.submittedAt,
        }),
        undefined,
        {
          action: `generated requirement document & approval for`,
          type: "Updated",
        }
      );

      if (req.taggedMemberIds.length > 0) {
        onTagMembers({
          project: updatedProj,
          memberIds: req.taggedMemberIds,
          step: "review",
          message: `Requirement document approved by ${req.approvedByName} for ${req.companyName || project.company}.`,
          addComment: false,
        });
      }
    }

    onSaveProject(updatedProj);

    const htmlDoc = generateRequirementDocumentHtml(
      updatedProj,
      pricing,
      coupons,
      team,
      mode
    );
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(htmlDoc);
      win.document.close();
      onNotifyToast(
        mode === "pdf"
          ? "Opened PDF print view — choose 'Save as PDF' in the print dialog."
          : mode === "print"
          ? "Opened print view for requirement document."
          : "Generated requirement document preview.",
        "success"
      );
    } else {
      onNotifyToast(
        "Pop-up blocked. Please allow pop-ups to view, print, or save as PDF.",
        "error",
        "Pop-up blocked"
      );
    }
  };

  const filledAnswersList = useMemo(() => {
    const rows: Array<[string, string]> = [];
    for (const sec of REQUIREMENT_SECTIONS) {
      sec.questions.forEach((q, idx) => {
        const val = req.answers[`${sec.title}_${idx}`];
        if (val && val.trim()) {
          rows.push([`${sec.title} · ${q}`, val]);
        }
      });
    }
    Object.entries(req.featureChoices).forEach(([feat, choice]) => {
      if (choice) {
        const det = req.featureDetails[feat];
        rows.push([
          `Feature: ${feat}`,
          choice === "Yes" && det ? `Yes — ${det}` : choice,
        ]);
      }
    });
    return rows;
  }, [req.answers, req.featureChoices, req.featureDetails]);

  return (
    <div className="req-workspace">
      {/* Top Action Header */}
      <div className="req-top-bar surface">
        <div className="req-top-left">
          <button
            type="button"
            className="secondary compact-btn"
            onClick={onBackToList}
          >
            <ArrowLeft size={14} /> All requirements
          </button>

          <div className="req-project-select-wrap">
            <span className="eyebrow">{project.id}</span>
            <select
              aria-label="Switch active requirement"
              value={project.id}
              onChange={(e) => onSelectProject(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.company} ({p.id})
                </option>
              ))}
            </select>
          </div>

          <select
            aria-label="Project stage"
            className="stage-select-pill"
            value={project.stage}
            onChange={(e) => onMoveStage(project, e.target.value as Stage)}
          >
            <option value="Requirements">Requirements</option>
            <option value="Building">Building</option>
            <option value="Completed">Completed</option>
          </select>

          <span className="small muted">Saved: {req.lastSavedAt}</span>
        </div>

        <div className="req-top-right">
          <div className="tagged-bar">
            {taggedMembers.map((m) => (
              <span key={m.id} className="tagged-chip">
                <AtSign size={11} />
                {m.name}
                <button
                  type="button"
                  aria-label={`Remove ${m.name}`}
                  onClick={() =>
                    patchRequirement((prev) => ({
                      ...prev,
                      taggedMemberIds: prev.taggedMemberIds.filter(
                        (id) => id !== m.id
                      ),
                    }))
                  }
                >
                  <X size={10} />
                </button>
              </span>
            ))}

            <div className="tag-popover-anchor">
              <button
                type="button"
                className="secondary compact-btn"
                onClick={() => setShowTagPopover((v) => !v)}
              >
                <UserPlus size={13} /> Tag people
              </button>

              {showTagPopover && (
                <div className="tag-popover">
                  <div className="tag-popover-head">
                    <b>Tag &amp; notify teammates</b>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setShowTagPopover(false)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <p className="small muted" style={{ margin: "0 0 8px" }}>
                    Tagged people immediately receive a notification with sound.
                  </p>
                  <div className="tag-member-list">
                    {activeTeam.map((member) => {
                      const checked = quickTagIds.includes(member.id);
                      return (
                        <label key={member.id} className="tag-member-check">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setQuickTagIds((prev) => [...prev, member.id]);
                              } else {
                                setQuickTagIds((prev) =>
                                  prev.filter((x) => x !== member.id)
                                );
                              }
                            }}
                          />
                          <span>
                            <b>{member.name}</b>{" "}
                            <small className="muted">({member.role})</small>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Optional note (e.g. Please check pricing or integrations)..."
                    value={quickTagNote}
                    onChange={(e) => setQuickTagNote(e.target.value)}
                  />
                  <div className="tag-popover-foot">
                    <button
                      type="button"
                      className="primary wide"
                      onClick={handleQuickTagSubmit}
                    >
                      <Send size={13} /> Tag &amp; send notification
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            className={`secondary compact-btn ${showComments ? "active-toggle" : ""}`}
            onClick={() => setShowComments((v) => !v)}
          >
            <MessageSquare size={13} /> Notes &amp; @mentions (
            {req.comments.length})
          </button>

          <button
            type="button"
            className="secondary compact-btn"
            onClick={handleExportJson}
          >
            <Download size={13} /> Export JSON
          </button>

          <button
            type="button"
            className="primary compact-btn"
            onClick={handleSaveOnly}
          >
            <Save size={13} /> Save
          </button>
        </div>
      </div>

      {/* Stepper Bar matching HTML Reference */}
      <div className="req-stepper">
        {STEP_ITEMS.map((item) => (
          <button
            type="button"
            key={item.key}
            className={`req-step-tab ${step === item.key ? "active" : ""}`}
            onClick={() => handleGoToStep(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Collapsible Collaboration & @Mentions Panel */}
      {showComments && (
        <section className="surface req-comments-panel">
          <div className="section-head">
            <div>
              <h2>Requirement notes &amp; @mentions</h2>
              <p>
                Type <code>@</code> to tag any CoreForge teammate. They will
                receive an instant alert with sound.
              </p>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={() => setShowComments(false)}
            >
              <X size={16} />
            </button>
          </div>

          <MentionComposer
            team={team}
            onSubmit={(text, mentionedIds) => {
              const targetIds =
                mentionedIds.length > 0
                  ? mentionedIds
                  : req.taggedMemberIds.length > 0
                  ? req.taggedMemberIds
                  : [];
              onTagMembers({
                project,
                memberIds: targetIds,
                step,
                message: text,
                addComment: true,
              });
            }}
          />

          {req.comments.length > 0 && (
            <div className="comment-feed">
              {req.comments.map((c) => {
                const tagged = team.filter((m) =>
                  c.taggedMemberIds.includes(m.id)
                );
                return (
                  <div key={c.id} className="comment-card">
                    <div className="comment-meta">
                      <b>{c.authorName}</b>
                      <span className="soft-tag">
                        {STEP_ITEMS.find((s) => s.key === c.step)?.label ||
                          c.step}
                        {c.section ? ` · ${c.section}` : ""}
                      </span>
                      <small className="muted">{c.createdAt}</small>
                    </div>
                    <p>{c.text}</p>
                    {tagged.length > 0 && (
                      <div className="comment-tags">
                        {tagged.map((t) => (
                          <span key={t.id} className="tagged-chip readonly">
                            <AtSign size={10} /> {t.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {validationError && (
        <div className="error-banner" role="alert">
          <span>{validationError}</span>
          <button
            type="button"
            className="icon-button"
            onClick={() => setValidationError("")}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Main Content + Sticky Live Price Summary */}
      <div
        className={`req-grid ${step === "overview" ? "single-col" : "two-col"}`}
      >
        <div className="req-main">
          {/* OVERVIEW */}
          {step === "overview" && (
            <>
              <div className="req-page-head">
                <div>
                  <div className="eyebrow">CLIENT WORKSPACE</div>
                  <h2>
                    Welcome
                    {req.companyName ? `, ${req.companyName}` : " to your project"}
                  </h2>
                  <p>
                    Everything required to plan and scope your website, in one
                    place.
                  </p>
                </div>
                <span className="status-pill-outline">
                  {req.confirmed
                    ? "APPROVED SCOPE"
                    : `${project.stage.toUpperCase()} STAGE`}
                </span>
              </div>

              <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                <div className="stat-card">
                  <div className="stat-top">
                    <span>PROJECT ID</span>
                  </div>
                  <strong>{project.id}</strong>
                  <small>Single requirement record</small>
                </div>
                <div className="stat-card">
                  <div className="stat-top">
                    <span>SELECTED PACKAGE</span>
                  </div>
                  <strong>{req.packageSelected || "Not selected"}</strong>
                  <small>
                    {req.packageSelected
                      ? `${formatINR(quote.basePackagePrice)} · ${quote.totalPageAllowance} pages`
                      : "Choose in Step 01"}
                  </small>
                </div>
                <div className="stat-card">
                  <div className="stat-top">
                    <span>COMPLETION</span>
                  </div>
                  <strong>{completion}%</strong>
                  <small>Onboarding milestones</small>
                </div>
              </div>

              <section className="surface" style={{ marginBottom: 16 }}>
                <div className="section-head">
                  <div>
                    <h2>Requirement progress</h2>
                    <p>
                      Complete each section to prepare your website requirement
                      document.
                    </p>
                  </div>
                </div>
                <div className="progress-track">
                  <span style={{ width: `${completion}%` }} />
                </div>
                <p className="small muted" style={{ marginTop: 10 }}>
                  {completion === 0
                    ? "Start by selecting a package."
                    : `${completion}% of key onboarding milestones completed.`}
                </p>
                <div className="step-actions">
                  <span />
                  <button
                    type="button"
                    className="primary"
                    onClick={() => onChangeStep("package")}
                  >
                    Continue requirements <ArrowRight size={14} />
                  </button>
                </div>
              </section>

              <section className="surface">
                <div className="section-head">
                  <div>
                    <h2>Project details</h2>
                    <p>Ownership, contacts, and current workspace status.</p>
                  </div>
                </div>
                <div className="review-row">
                  <span>Client / company</span>
                  <b>{req.companyName || project.company || "Not provided"}</b>
                </div>
                <div className="review-row">
                  <span>Primary contact</span>
                  <b>
                    {req.clientTeam.contactPerson || project.client || "—"}
                    {req.clientTeam.contactEmail
                      ? ` (${req.clientTeam.contactEmail})`
                      : ""}
                  </b>
                </div>
                <div className="review-row">
                  <span>Project stage</span>
                  <b>{project.stage}</b>
                </div>
                <div className="review-row">
                  <span>Requirement owner</span>
                  <b>{project.owner}</b>
                </div>
                <div className="review-row">
                  <span>Assigned developer</span>
                  <b>{project.assignedTo}</b>
                </div>
                <div className="review-row">
                  <span>Tagged teammates</span>
                  <b>
                    {taggedMembers.length
                      ? taggedMembers.map((m) => m.name).join(", ")
                      : "None"}
                  </b>
                </div>
              </section>
            </>
          )}

          {/* STEP 01 · PACKAGE */}
          {step === "package" && (
            <>
              <div className="req-page-head">
                <div>
                  <div className="eyebrow">STEP 01</div>
                  <h2>Choose your website package</h2>
                  <p>Select the package that best fits your business goals.</p>
                </div>
                <div className="row-actions">
                  <span className="status-pill-outline">One package only</span>
                  {isAdmin && (
                    <button
                      type="button"
                      className="secondary compact-btn"
                      onClick={onOpenGlobalPricing}
                    >
                      <SlidersHorizontal size={13} /> Edit package pricing
                    </button>
                  )}
                </div>
              </div>

              <div className="package-grid">
                {PACKAGE_ORDER.map((pkgName) => {
                  const cfg = pricing.packages[pkgName];
                  const selected = req.packageSelected === pkgName;
                  return (
                    <button
                      type="button"
                      key={pkgName}
                      className={`package-card ${selected ? "selected" : ""}`}
                      onClick={() => {
                        patchRequirement(
                          (prev) => ({
                            ...prev,
                            packageSelected: pkgName,
                          }),
                          { package: pkgName },
                          {
                            action: `selected ${pkgName} package for`,
                            type: "Updated",
                          }
                        );
                      }}
                    >
                      <div className="package-top">
                        <h4>{pkgName.toUpperCase()}</h4>
                        <span className="soft-tag">Hosting included</span>
                      </div>
                      <div className="package-price">
                        {formatINR(cfg.price)}
                      </div>
                      <p>{cfg.description}</p>
                      <div className="small muted">
                        Included allowance: {cfg.limit} pages
                      </div>
                      <ul>
                        {cfg.features.map((feat) => (
                          <li key={feat}>{feat}</li>
                        ))}
                      </ul>
                      <div className="package-choose">
                        {selected ? "✓ SELECTED" : "SELECT PACKAGE"}
                      </div>
                    </button>
                  );
                })}
              </div>

              <section className="surface" style={{ marginTop: 18 }}>
                <div className="section-head">
                  <div>
                    <h2>About your business</h2>
                    <p>
                      These five questions are mandatory for every project.
                    </p>
                  </div>
                </div>

                <div className="question">
                  <label>Business type</label>
                  <div className="choice-row">
                    {(["Service-based", "Product-based", "Both"] as BusinessType[]).map(
                      (bt) => (
                        <label key={bt} className="choice-label">
                          <input
                            type="radio"
                            name="businessType"
                            checked={req.businessType === bt}
                            onChange={() =>
                              patchRequirement((prev) => ({
                                ...prev,
                                businessType: bt,
                              }))
                            }
                          />
                          <span>{bt}</span>
                        </label>
                      )
                    )}
                  </div>
                </div>

                <div className="question">
                  <label htmlFor="req-company">
                    1. What is your business / company name? *
                  </label>
                  <input
                    id="req-company"
                    type="text"
                    placeholder="Company name"
                    value={req.companyName}
                    onChange={(e) =>
                      patchRequirement((prev) => ({
                        ...prev,
                        companyName: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="question">
                  <label htmlFor="req-business">
                    2. What does your business do? *
                  </label>
                  <textarea
                    id="req-business"
                    placeholder="Describe your products, services and business model"
                    value={req.businessDescription}
                    onChange={(e) =>
                      patchRequirement((prev) => ({
                        ...prev,
                        businessDescription: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="question">
                  <label htmlFor="req-purpose">
                    3. What is the primary purpose of your website? *
                  </label>
                  <select
                    id="req-purpose"
                    value={req.websitePurpose}
                    onChange={(e) =>
                      patchRequirement((prev) => ({
                        ...prev,
                        websitePurpose: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select purpose</option>
                    {WEBSITE_PURPOSES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  {req.websitePurpose === "Other" && (
                    <input
                      type="text"
                      style={{ marginTop: 10 }}
                      placeholder="Please specify the primary website purpose *"
                      value={req.websitePurposeOther}
                      onChange={(e) =>
                        patchRequirement((prev) => ({
                          ...prev,
                          websitePurposeOther: e.target.value,
                        }))
                      }
                    />
                  )}
                </div>

                <div className="question">
                  <label>4. Do you already have an existing website? *</label>
                  <div className="choice-row">
                    {(["Yes", "No"] as const).map((ans) => (
                      <label key={ans} className="choice-label">
                        <input
                          type="radio"
                          name="hasExistingWebsite"
                          checked={req.hasExistingWebsite === ans}
                          onChange={() =>
                            patchRequirement((prev) => ({
                              ...prev,
                              hasExistingWebsite: ans,
                            }))
                          }
                        />
                        <span>{ans}</span>
                      </label>
                    ))}
                  </div>
                  {req.hasExistingWebsite === "Yes" && (
                    <input
                      type="url"
                      style={{ marginTop: 10 }}
                      placeholder="Existing website URL (https://...)"
                      value={req.existingWebsiteUrl}
                      onChange={(e) =>
                        patchRequirement((prev) => ({
                          ...prev,
                          existingWebsiteUrl: e.target.value,
                        }))
                      }
                    />
                  )}
                </div>

                <div className="question">
                  <label htmlFor="req-audience">
                    5. Who is your target audience? *
                  </label>
                  <textarea
                    id="req-audience"
                    placeholder="Describe your ideal customers, location, industry or age group"
                    value={req.targetAudience}
                    onChange={(e) =>
                      patchRequirement((prev) => ({
                        ...prev,
                        targetAudience: e.target.value,
                      }))
                    }
                  />
                </div>
              </section>

              <div className="step-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => handleGoToStep("overview")}
                >
                  Back
                </button>
                <div className="row-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={handleSaveOnly}
                  >
                    <Save size={14} /> Save
                  </button>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => handleGoToStep("pages")}
                  >
                    Save &amp; continue <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* STEP 02 · PAGES & PRICING */}
          {step === "pages" && (
            <>
              <div className="req-page-head">
                <div>
                  <div className="eyebrow">STEP 02</div>
                  <h2>Build your sitemap &amp; pricing</h2>
                  <p>
                    Select the pages your website needs. Your package includes a
                    page allowance.
                  </p>
                </div>
                <span className="status-pill-outline">
                  {req.selectedPages.length} / {quote.totalPageAllowance} pages
                </span>
              </div>

              <div className="notice-banner">
                {req.selectedPages.length >= quote.totalPageAllowance
                  ? `You have reached your package limit of ${quote.totalPageAllowance} pages.`
                  : `Your package includes ${quote.includedPages} pages${
                      quote.bonusPages
                        ? ` plus ${quote.bonusPages} coupon bonus pages`
                        : ""
                    }. Select up to ${quote.totalPageAllowance} pages.`}
              </div>

              {Object.entries(PAGE_CATEGORIES).map(([category, items]) => {
                const selectedInCat = items.filter((item) =>
                  req.selectedPages.includes(item)
                ).length;
                return (
                  <div className="category-box" key={category}>
                    <div className="category-head">
                      <span>{category}</span>
                      <span className="muted">{selectedInCat} selected</span>
                    </div>
                    <div className="category-options">
                      {items.map((item) => {
                        const checked = req.selectedPages.includes(item);
                        const disabled =
                          !checked &&
                          req.selectedPages.length >= quote.totalPageAllowance;
                        return (
                          <label
                            key={item}
                            className={`page-option ${disabled ? "disabled" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={() => togglePageSelection(item)}
                            />
                            <span>{item}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <section className="surface" style={{ marginTop: 14 }}>
                <div className="section-head">
                  <div>
                    <h2>Custom pages</h2>
                    <p>Need a page that is not listed above? Add it here.</p>
                  </div>
                  <button
                    type="button"
                    className="secondary"
                    onClick={addCustomPage}
                  >
                    <Plus size={14} /> Add custom page
                  </button>
                </div>

                {req.customPages.length === 0 ? (
                  <p className="small muted">No custom pages added yet.</p>
                ) : (
                  req.customPages.map((cp, idx) => (
                    <div key={cp.id} className="custom-page-card">
                      <div className="custom-page-head">
                        <b>Custom page {idx + 1}</b>
                        <button
                          type="button"
                          className="text-button danger-text"
                          onClick={() => removeCustomPage(cp.id)}
                        >
                          <Trash2 size={13} /> Remove
                        </button>
                      </div>
                      <div className="form-grid">
                        <label>
                          Page name
                          <input
                            value={cp.name}
                            placeholder="e.g. Investor Relations"
                            onChange={(e) =>
                              updateCustomPage(cp.id, "name", e.target.value)
                            }
                          />
                        </label>
                        <label>
                          Purpose
                          <input
                            value={cp.purpose}
                            placeholder="Goal of this page"
                            onChange={(e) =>
                              updateCustomPage(cp.id, "purpose", e.target.value)
                            }
                          />
                        </label>
                        <label>
                          Description
                          <textarea
                            rows={2}
                            value={cp.description}
                            onChange={(e) =>
                              updateCustomPage(
                                cp.id,
                                "description",
                                e.target.value
                              )
                            }
                          />
                        </label>
                        <label>
                          Required functionality
                          <textarea
                            rows={2}
                            value={cp.functionality}
                            onChange={(e) =>
                              updateCustomPage(
                                cp.id,
                                "functionality",
                                e.target.value
                              )
                            }
                          />
                        </label>
                        <label style={{ gridColumn: "1 / -1" }}>
                          Reference URL
                          <input
                            type="url"
                            value={cp.url}
                            placeholder="https://"
                            onChange={(e) =>
                              updateCustomPage(cp.id, "url", e.target.value)
                            }
                          />
                        </label>
                      </div>
                    </div>
                  ))
                )}
              </section>

              <section className="surface" style={{ marginTop: 14 }}>
                <div className="section-head">
                  <div>
                    <h2>Promotional coupon</h2>
                    <p>
                      Apply an agency coupon code (10%, 25%, 50% off, or
                      OFFPLUS2 for +2 pages).
                    </p>
                  </div>
                  {quote.appliedCoupon && (
                    <span className="status-live">
                      {quote.appliedCoupon.code} ·{" "}
                      {formatCouponBenefit(quote.appliedCoupon)}
                    </span>
                  )}
                </div>

                <div className="coupon-input-row">
                  <input
                    value={couponInput}
                    placeholder="Enter coupon code (e.g. OFF10, OFF25, OFF50, OFFPLUS2)"
                    onChange={(e) =>
                      setCouponInput(e.target.value.toUpperCase())
                    }
                  />
                  <button
                    type="button"
                    className="primary"
                    onClick={() => applyCouponCode(couponInput)}
                  >
                    Apply code
                  </button>
                  {req.couponCode && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={removeCoupon}
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="coupon-quick-row">
                  <span className="small muted">Quick apply:</span>
                  {coupons
                    .filter((c) => c.active)
                    .map((c) => {
                      const activeApplied =
                        req.couponCode.toUpperCase() === c.code.toUpperCase();
                      return (
                        <button
                          type="button"
                          key={c.id}
                          className={`tag-pill-btn ${activeApplied ? "tagged" : ""}`}
                          onClick={() => applyCouponCode(c.code)}
                        >
                          <Tag size={11} />
                          <b>{c.code}</b> · {formatCouponBenefit(c)}
                        </button>
                      );
                    })}
                </div>

                {couponFeedback && (
                  <p
                    className={`small ${
                      couponFeedback.tone === "success"
                        ? "success-text"
                        : couponFeedback.tone === "error"
                        ? "error-text"
                        : "muted"
                    }`}
                    style={{ marginTop: 8 }}
                  >
                    {couponFeedback.text}
                  </p>
                )}
              </section>

              <section className="surface" style={{ marginTop: 14 }}>
                <div className="section-head">
                  <div>
                    <h2>Need additional pages?</h2>
                    <p>
                      Request pages beyond your included allowance. Additional
                      charges depend on agency configuration and approval.
                    </p>
                  </div>
                </div>

                <div className="form-grid">
                  <label>
                    Additional pages requested
                    <input
                      type="number"
                      min={0}
                      value={req.extraPages}
                      onChange={(e) => {
                        const count = Math.max(0, Number(e.target.value) || 0);
                        patchRequirement((prev) => ({
                          ...prev,
                          extraPages: count,
                          extraPagesStatus:
                            count === 0
                              ? "Not requested"
                              : prev.extraPagesStatus === "Not requested"
                              ? "Pending agency approval"
                              : prev.extraPagesStatus,
                        }));
                      }}
                    />
                  </label>
                  <label>
                    Approval status
                    <select
                      disabled={!isAdmin}
                      value={req.extraPagesStatus}
                      onChange={(e) =>
                        patchRequirement((prev) => ({
                          ...prev,
                          extraPagesStatus: e.target.value as RequirementData["extraPagesStatus"],
                        }))
                      }
                    >
                      <option value="Not requested">Not requested</option>
                      <option value="Pending agency approval">
                        Pending agency approval
                      </option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </label>
                </div>

                <p className="small muted" style={{ marginTop: 10 }}>
                  {quote.effectiveExtraPagePrice === null
                    ? "Additional page pricing has not been configured yet."
                    : `Configured additional page price: ${formatINR(quote.effectiveExtraPagePrice)} per page.`}
                </p>
              </section>

              {isAdmin && (
                <section className="surface" style={{ marginTop: 14 }}>
                  <div className="section-head">
                    <div>
                      <h2>Editable quote pricing (Admin)</h2>
                      <p>
                        Customize this project&apos;s package price or extra page
                        rate, or edit global rates in Coupons &amp; pricing.
                      </p>
                    </div>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="secondary compact-btn"
                        onClick={onOpenGlobalPricing}
                      >
                        Global pricing
                      </button>
                      <button
                        type="button"
                        className="secondary compact-btn"
                        onClick={() => setShowQuoteEditor((v) => !v)}
                      >
                        <Pencil size={12} />{" "}
                        {showQuoteEditor ? "Hide editor" : "Edit quote pricing"}
                      </button>
                    </div>
                  </div>

                  {showQuoteEditor && (
                    <div className="form-grid">
                      <label>
                        Custom package price override (₹)
                        <input
                          type="number"
                          min={0}
                          placeholder={`Default (${formatINR(
                            req.packageSelected
                              ? pricing.packages[req.packageSelected].price
                              : 0
                          )})`}
                          value={req.customPriceOverride ?? ""}
                          onChange={(e) =>
                            patchRequirement(
                              (prev) => ({
                                ...prev,
                                customPriceOverride:
                                  e.target.value === ""
                                    ? null
                                    : Math.max(0, Number(e.target.value) || 0),
                              }),
                              undefined,
                              {
                                action: "edited custom package pricing for",
                                type: "Updated",
                              }
                            )
                          }
                        />
                      </label>
                      <label>
                        Custom extra page rate override (₹)
                        <input
                          type="number"
                          min={0}
                          placeholder={
                            pricing.additionalPagePrice === null
                              ? "Global not set"
                              : `Default (${formatINR(pricing.additionalPagePrice)})`
                          }
                          value={req.customExtraPagePriceOverride ?? ""}
                          onChange={(e) =>
                            patchRequirement((prev) => ({
                              ...prev,
                              customExtraPagePriceOverride:
                                e.target.value === ""
                                  ? null
                                  : Math.max(0, Number(e.target.value) || 0),
                            }))
                          }
                        />
                      </label>
                      <label style={{ gridColumn: "1 / -1" }}>
                        Pricing adjustment note
                        <input
                          placeholder="Reason for custom pricing (optional)"
                          value={req.pricingAdjustmentNote}
                          onChange={(e) =>
                            patchRequirement((prev) => ({
                              ...prev,
                              pricingAdjustmentNote: e.target.value,
                            }))
                          }
                        />
                      </label>
                      {(req.customPriceOverride !== null ||
                        req.customExtraPagePriceOverride !== null) && (
                        <div style={{ gridColumn: "1 / -1" }}>
                          <button
                            type="button"
                            className="secondary compact-btn"
                            onClick={() =>
                              patchRequirement((prev) => ({
                                ...prev,
                                customPriceOverride: null,
                                customExtraPagePriceOverride: null,
                                pricingAdjustmentNote: "",
                              }))
                            }
                          >
                            Reset to workspace default pricing
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}

              <div className="step-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => handleGoToStep("package")}
                >
                  Back
                </button>
                <div className="row-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={handleSaveOnly}
                  >
                    <Save size={14} /> Save
                  </button>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => handleGoToStep("requirements")}
                  >
                    Save &amp; continue <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* STEP 03 · REQUIREMENTS */}
          {step === "requirements" && (
            <>
              <div className="req-page-head">
                <div>
                  <div className="eyebrow">STEP 03</div>
                  <h2>Project requirements</h2>
                  <p>
                    Tell us how your website should look, work and connect with
                    your business. Tag teammates directly on any section.
                  </p>
                </div>
              </div>

              {REQUIREMENT_SECTIONS.map((sec, idx) => {
                const isTagOpen = activeSectionTag === sec.title;
                const sectionComments = req.comments.filter(
                  (c) => c.section === sec.title
                );
                return (
                  <section
                    className="surface"
                    key={sec.id}
                    style={{ marginBottom: 14 }}
                  >
                    <div className="section-head">
                      <div>
                        <h2>
                          {idx + 1}. {sec.title}
                        </h2>
                        <p>
                          Add the details that will help our team plan this part
                          of your project.
                        </p>
                      </div>
                      <button
                        type="button"
                        className={`secondary compact-btn ${isTagOpen ? "active-toggle" : ""}`}
                        onClick={() =>
                          setActiveSectionTag(isTagOpen ? null : sec.title)
                        }
                      >
                        <AtSign size={12} /> Tag teammate
                        {sectionComments.length > 0
                          ? ` (${sectionComments.length})`
                          : ""}
                      </button>
                    </div>

                    {isTagOpen && (
                      <div className="section-tag-drawer">
                        <MentionComposer
                          compact
                          team={team}
                          submitLabel={`Tag on ${sec.title}`}
                          placeholder={`Tag a teammate on "${sec.title}" using @Name...`}
                          onSubmit={(text, mentionedIds) => {
                            const targets =
                              mentionedIds.length > 0
                                ? mentionedIds
                                : req.taggedMemberIds;
                            onTagMembers({
                              project,
                              memberIds: targets,
                              step: "requirements",
                              section: sec.title,
                              message: text,
                              addComment: true,
                            });
                            setActiveSectionTag(null);
                          }}
                        />
                      </div>
                    )}

                    {sectionComments.length > 0 && (
                      <div className="inline-section-notes">
                        {sectionComments.map((c) => (
                          <div key={c.id} className="inline-note-chip">
                            <b>{c.authorName}:</b> {c.text}
                          </div>
                        ))}
                      </div>
                    )}

                    {sec.questions.map((question, qIdx) => {
                      const key = `${sec.title}_${qIdx}`;
                      return (
                        <div className="question" key={key}>
                          <label htmlFor={`q-${sec.id}-${qIdx}`}>
                            {question}
                          </label>
                          <textarea
                            id={`q-${sec.id}-${qIdx}`}
                            placeholder="Your answer..."
                            value={req.answers[key] || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              patchRequirement((prev) => ({
                                ...prev,
                                answers: {
                                  ...prev.answers,
                                  [key]: val,
                                },
                              }));
                            }}
                          />
                        </div>
                      );
                    })}
                  </section>
                );
              })}

              {/* Conditional Package Features */}
              <section className="surface" style={{ marginBottom: 14 }}>
                <div className="section-head">
                  <div>
                    <h2>{req.packageSelected || "Launch"} features</h2>
                    <p>
                      Select the features you require. Choosing &ldquo;Yes&rdquo;
                      reveals a follow-up field for details.
                    </p>
                  </div>
                </div>

                {PACKAGE_FEATURES[req.packageSelected || "Launch"].map(
                  (feature) => {
                    const choice = req.featureChoices[feature] || "";
                    return (
                      <div className="question" key={feature}>
                        <label>{feature}</label>
                        <div className="choice-row">
                          {(["Yes", "No"] as const).map((opt) => (
                            <label key={opt} className="choice-label">
                              <input
                                type="radio"
                                name={`feat-${feature}`}
                                checked={choice === opt}
                                onChange={() =>
                                  patchRequirement((prev) => ({
                                    ...prev,
                                    featureChoices: {
                                      ...prev.featureChoices,
                                      [feature]: opt,
                                    },
                                  }))
                                }
                              />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                        {choice === "Yes" && (
                          <textarea
                            style={{ marginTop: 10 }}
                            placeholder="Please provide details / preferences..."
                            value={req.featureDetails[feature] || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              patchRequirement((prev) => ({
                                ...prev,
                                featureDetails: {
                                  ...prev.featureDetails,
                                  [feature]: val,
                                },
                              }));
                            }}
                          />
                        )}
                      </div>
                    );
                  }
                )}
              </section>

              {/* Agency internal notes */}
              <section className="surface">
                <div className="section-head">
                  <div>
                    <h2>Agency internal notes</h2>
                    <p>
                      Internal scoping notes for CoreForge Admin and Developers.
                    </p>
                  </div>
                  <span className="soft-tag">Internal only</span>
                </div>
                <textarea
                  className="full-textarea"
                  rows={3}
                  placeholder="Technical constraints, delivery risks, or internal handover notes..."
                  value={req.agencyInternalNotes}
                  onChange={(e) =>
                    patchRequirement((prev) => ({
                      ...prev,
                      agencyInternalNotes: e.target.value,
                    }))
                  }
                />
              </section>

              <div className="step-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => handleGoToStep("pages")}
                >
                  Back
                </button>
                <div className="row-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={handleSaveOnly}
                  >
                    <Save size={14} /> Save
                  </button>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => handleGoToStep("team")}
                  >
                    Save &amp; continue <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* STEP 04 · TEAM & ASSETS */}
          {step === "team" && (
            <>
              <div className="req-page-head">
                <div>
                  <div className="eyebrow">STEP 04</div>
                  <h2>People, content &amp; assets</h2>
                  <p>
                    Identify key client contacts, assign CoreForge team members,
                    and attach assets.
                  </p>
                </div>
              </div>

              <section className="surface" style={{ marginBottom: 14 }}>
                <div className="section-head">
                  <div>
                    <h2>Client team &amp; responsibilities</h2>
                    <p>
                      Tell us who we should contact for decisions and approvals.
                    </p>
                  </div>
                </div>
                <div className="form-grid">
                  <label>
                    Primary contact person
                    <input
                      placeholder="Full name"
                      value={req.clientTeam.contactPerson}
                      onChange={(e) =>
                        patchRequirement((prev) => ({
                          ...prev,
                          clientTeam: {
                            ...prev.clientTeam,
                            contactPerson: e.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                  <label>
                    Contact email
                    <input
                      type="email"
                      placeholder="name@company.com"
                      value={req.clientTeam.contactEmail}
                      onChange={(e) =>
                        patchRequirement((prev) => ({
                          ...prev,
                          clientTeam: {
                            ...prev.clientTeam,
                            contactEmail: e.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                  <label>
                    Phone number
                    <input
                      placeholder="+91"
                      value={req.clientTeam.contactPhone}
                      onChange={(e) =>
                        patchRequirement((prev) => ({
                          ...prev,
                          clientTeam: {
                            ...prev.clientTeam,
                            contactPhone: e.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                  <label>
                    Decision-maker
                    <input
                      placeholder="Full name"
                      value={req.clientTeam.decisionMaker}
                      onChange={(e) =>
                        patchRequirement((prev) => ({
                          ...prev,
                          clientTeam: {
                            ...prev.clientTeam,
                            decisionMaker: e.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                  <label>
                    Content provider
                    <input
                      placeholder="Full name"
                      value={req.clientTeam.contentProvider}
                      onChange={(e) =>
                        patchRequirement((prev) => ({
                          ...prev,
                          clientTeam: {
                            ...prev.clientTeam,
                            contentProvider: e.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                  <label>
                    Design approver
                    <input
                      placeholder="Full name"
                      value={req.clientTeam.designApprover}
                      onChange={(e) =>
                        patchRequirement((prev) => ({
                          ...prev,
                          clientTeam: {
                            ...prev.clientTeam,
                            designApprover: e.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                  <label>
                    Final approver
                    <input
                      placeholder="Full name"
                      value={req.clientTeam.finalApprover}
                      onChange={(e) =>
                        patchRequirement((prev) => ({
                          ...prev,
                          clientTeam: {
                            ...prev.clientTeam,
                            finalApprover: e.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                </div>
              </section>

              <section className="surface" style={{ marginBottom: 14 }}>
                <div className="section-head">
                  <div>
                    <h2>CoreForge assignment &amp; notifications</h2>
                    <p>
                      Assign the developer and tag teammates to notify them with
                      sound.
                    </p>
                  </div>
                </div>

                <div className="form-grid" style={{ marginBottom: 14 }}>
                  <label>
                    Requirement owner
                    <select
                      value={project.ownerId}
                      onChange={(e) => {
                        const member = team.find(
                          (m) => m.id === e.target.value
                        );
                        if (!member) return;
                        patchRequirement(
                          (prev) => prev,
                          { ownerId: member.id, owner: member.name },
                          {
                            action: `changed requirement owner to ${member.name} on`,
                            type: "Updated",
                          }
                        );
                      }}
                    >
                      {activeTeam.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.role})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Assigned developer
                    <select
                      value={project.assignedToId}
                      onChange={(e) => {
                        const member = team.find(
                          (m) => m.id === e.target.value
                        );
                        if (!member) return;
                        patchRequirement(
                          (prev) => prev,
                          { assignedToId: member.id, assignedTo: member.name },
                          {
                            action: `assigned ${member.name} to`,
                            type: "Updated",
                          }
                        );
                        onTagMembers({
                          project,
                          memberIds: [member.id],
                          step: "team",
                          message: `${currentUser.name} assigned you to ${project.company}.`,
                          addComment: false,
                        });
                      }}
                    >
                      {activeTeam.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.role})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="small muted" style={{ display: "block", marginBottom: 8 }}>
                  Tag teammates in this requirement (click to toggle &amp; notify):
                </label>
                <div className="inline-check-row">
                  {activeTeam.map((member) => {
                    const isTagged = req.taggedMemberIds.includes(member.id);
                    return (
                      <button
                        type="button"
                        key={member.id}
                        className={`tag-pill-btn ${isTagged ? "tagged" : ""}`}
                        onClick={() => {
                          if (isTagged) {
                            patchRequirement((prev) => ({
                              ...prev,
                              taggedMemberIds: prev.taggedMemberIds.filter(
                                (id) => id !== member.id
                              ),
                            }));
                          } else {
                            onTagMembers({
                              project,
                              memberIds: [member.id],
                              step: "team",
                              message: `${currentUser.name} tagged ${member.name} on Team & assets for ${project.company}.`,
                              addComment: false,
                            });
                          }
                        }}
                      >
                        {isTagged ? <Check size={12} /> : <AtSign size={12} />}
                        {member.name} ({member.role})
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="surface">
                <div className="section-head">
                  <div>
                    <h2>Content &amp; asset uploads</h2>
                    <p>
                      Attach files in this browser preview or share a Google
                      Drive link.
                    </p>
                  </div>
                </div>

                <label className="upload-box">
                  <Upload size={20} />
                  <b>Select files to attach</b>
                  <span>
                    Logo · Images · Videos · Brand guidelines · Catalogues ·
                    Brochures · Documents
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.zip"
                    onChange={(e) => handleFilesSelected(e.target.files)}
                  />
                </label>

                {req.files.length > 0 && (
                  <div className="asset-list">
                    {req.files.map((file) => (
                      <div key={file.id} className="asset-item">
                        <div>
                          <Paperclip size={13} />
                          <b>{file.name}</b>
                          <small className="muted">
                            ({Math.max(1, Math.round(file.size / 1024))} KB)
                          </small>
                        </div>
                        <button
                          type="button"
                          className="icon-button danger-text"
                          onClick={() =>
                            patchRequirement((prev) => ({
                              ...prev,
                              files: prev.files.filter((f) => f.id !== file.id),
                            }))
                          }
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="question" style={{ borderBottom: 0, paddingBottom: 0 }}>
                  <label htmlFor="drive-link">Google Drive folder link</label>
                  <input
                    id="drive-link"
                    type="url"
                    placeholder="https://drive.google.com/..."
                    value={req.driveLink}
                    onChange={(e) =>
                      patchRequirement((prev) => ({
                        ...prev,
                        driveLink: e.target.value,
                      }))
                    }
                  />
                </div>
              </section>

              <div className="step-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => handleGoToStep("requirements")}
                >
                  Back
                </button>
                <div className="row-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={handleSaveOnly}
                  >
                    <Save size={14} /> Save
                  </button>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => handleGoToStep("review")}
                  >
                    Review project <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* STEP 05 · REVIEW & APPROVAL */}
          {step === "review" && (
            <>
              <div className="req-page-head">
                <div>
                  <div className="eyebrow">STEP 05</div>
                  <h2>Review &amp; approve</h2>
                  <p>
                    Review your selections before preparing the requirement
                    document.
                  </p>
                </div>
                <span className="status-pill-outline">
                  {req.confirmed ? "Approved" : "Ready for review"}
                </span>
              </div>

              <section className="surface" style={{ marginBottom: 14 }}>
                <div className="section-head">
                  <h2>Client &amp; project details</h2>
                </div>
                <div className="review-row">
                  <span>Project ID</span>
                  <b>{project.id}</b>
                </div>
                <div className="review-row">
                  <span>Company</span>
                  <b>{req.companyName || project.company || "—"}</b>
                </div>
                <div className="review-row">
                  <span>Business type</span>
                  <b>{req.businessType || "—"}</b>
                </div>
                <div className="review-row">
                  <span>Business description</span>
                  <b>{req.businessDescription || "—"}</b>
                </div>
                <div className="review-row">
                  <span>Website purpose</span>
                  <b>
                    {req.websitePurpose === "Other" && req.websitePurposeOther
                      ? `Other: ${req.websitePurposeOther}`
                      : req.websitePurpose || "—"}
                  </b>
                </div>
                <div className="review-row">
                  <span>Existing website</span>
                  <b>
                    {req.hasExistingWebsite || "—"}
                    {req.hasExistingWebsite === "Yes" && req.existingWebsiteUrl
                      ? ` (${req.existingWebsiteUrl})`
                      : ""}
                  </b>
                </div>
                <div className="review-row">
                  <span>Target audience</span>
                  <b>{req.targetAudience || "—"}</b>
                </div>
              </section>

              <section className="surface" style={{ marginBottom: 14 }}>
                <div className="section-head">
                  <h2>Selected package &amp; pages</h2>
                </div>
                <div className="review-row">
                  <span>Package</span>
                  <b>{req.packageSelected || "Not selected"}</b>
                </div>
                <div className="review-row">
                  <span>Included allowance</span>
                  <b>{quote.totalPageAllowance} pages</b>
                </div>
                <div className="review-row">
                  <span>Selected pages ({req.selectedPages.length})</span>
                  <b>
                    {req.selectedPages.length
                      ? req.selectedPages.join(", ")
                      : "None"}
                  </b>
                </div>
                <div className="review-row">
                  <span>Custom pages</span>
                  <b>
                    {req.customPages.map((p) => p.name).filter(Boolean).length
                      ? req.customPages
                          .map((p) => p.name)
                          .filter(Boolean)
                          .join(", ")
                      : "None"}
                  </b>
                </div>
                <div className="review-row">
                  <span>Coupon applied</span>
                  <b>
                    {quote.appliedCoupon
                      ? `${quote.appliedCoupon.code} (${formatCouponBenefit(quote.appliedCoupon)})`
                      : "None"}
                  </b>
                </div>
                <div className="review-row">
                  <span>Extra pages requested</span>
                  <b>
                    {quote.extraPages} ({req.extraPagesStatus})
                  </b>
                </div>
              </section>

              <section className="surface" style={{ marginBottom: 14 }}>
                <div className="section-head">
                  <h2>Quotation estimate</h2>
                </div>
                <div className="review-row">
                  <span>
                    Website development
                    {quote.isPriceOverridden ? " (Custom quote)" : ""}
                  </span>
                  <b>{formatINR(quote.basePackagePrice)}</b>
                </div>
                <div className="review-row">
                  <span>Additional page charges</span>
                  <b>
                    {quote.extraPagesCost === null
                      ? "Pending configuration"
                      : formatINR(quote.extraPagesCost)}
                  </b>
                </div>
                {quote.discountAmount > 0 && (
                  <div className="review-row">
                    <span>
                      Coupon discount ({quote.appliedCoupon?.code})
                    </span>
                    <b className="success-text">
                      -{formatINR(quote.discountAmount)}
                    </b>
                  </div>
                )}
                <div className="review-row">
                  <span>Hosting</span>
                  <b>
                    {quote.hostingIncluded
                      ? "Included in package (₹0)"
                      : "Separate"}{" "}
                    · {quote.hostingFrequency}
                  </b>
                </div>
                <div className="review-row">
                  <span>Estimated total</span>
                  <b>{formatINR(quote.estimatedTotal)}</b>
                </div>
                <div className="review-row">
                  <span>Taxes</span>
                  <b>Not calculated</b>
                </div>
              </section>

              <section className="surface" style={{ marginBottom: 14 }}>
                <div className="section-head">
                  <h2>Project requirements &amp; team</h2>
                </div>
                {filledAnswersList.length === 0 ? (
                  <div className="review-row">
                    <span>Questionnaire</span>
                    <b>No additional answers recorded yet</b>
                  </div>
                ) : (
                  filledAnswersList.map(([label, val]) => (
                    <div className="review-row" key={label}>
                      <span>{label}</span>
                      <b>{val}</b>
                    </div>
                  ))
                )}
                <div className="review-row">
                  <span>Primary client contact</span>
                  <b>
                    {req.clientTeam.contactPerson || "—"} ·{" "}
                    {req.clientTeam.contactEmail || "—"}
                  </b>
                </div>
                <div className="review-row">
                  <span>Tagged CoreForge teammates</span>
                  <b>
                    {taggedMembers.length
                      ? taggedMembers.map((m) => m.name).join(", ")
                      : "None"}
                  </b>
                </div>
              </section>

              <section className="surface">
                <div className="section-head">
                  <h2>Client confirmation</h2>
                </div>
                <label className="confirm-check">
                  <input
                    type="checkbox"
                    checked={req.confirmed}
                    onChange={(e) =>
                      patchRequirement((prev) => ({
                        ...prev,
                        confirmed: e.target.checked,
                      }))
                    }
                  />
                  <span>
                    I confirm that the information provided is accurate and may
                    be used to prepare the project scope and quotation.
                  </span>
                </label>

                <div className="question" style={{ borderBottom: 0 }}>
                  <label htmlFor="client-signature">
                    Type your full name as digital acknowledgement
                  </label>
                  <input
                    id="client-signature"
                    placeholder="Full name"
                    value={req.approvedByName}
                    onChange={(e) =>
                      patchRequirement((prev) => ({
                        ...prev,
                        approvedByName: e.target.value,
                      }))
                    }
                  />
                </div>
                <p className="small muted" style={{ margin: 0 }}>
                  This is an internal portal acknowledgement and is not a legally
                  verified electronic signature.
                </p>
              </section>

              <div className="step-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => handleGoToStep("team")}
                >
                  Back
                </button>
                <div className="row-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={handleSaveOnly}
                  >
                    <Save size={14} /> Save
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={handleExportJson}
                  >
                    <Download size={14} /> Export JSON
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => handleOpenDocument("print")}
                  >
                    <Printer size={14} /> Print
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => handleOpenDocument("pdf")}
                  >
                    <FileDown size={14} /> Print as PDF
                  </button>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => handleOpenDocument("preview")}
                  >
                    <FileText size={14} /> Generate
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Sticky Live Estimate Sidebar (Steps 01-05) */}
        {step !== "overview" && (
          <aside className="req-summary-aside">
            <div className="surface summary-card">
              <div className="eyebrow">LIVE ESTIMATE</div>
              <h2 style={{ margin: "6px 0 4px" }}>Price summary</h2>
              <p className="small muted" style={{ margin: "0 0 14px" }}>
                Hosting is included in package pricing.
              </p>

              <div className="lineitem">
                <span>
                  Website package
                  {quote.packageName ? ` (${quote.packageName})` : ""}
                </span>
                <strong>{formatINR(quote.basePackagePrice)}</strong>
              </div>

              <div className="lineitem">
                <span>Additional pages ({quote.extraPages})</span>
                <strong>
                  {quote.extraPagesCost === null
                    ? "Pending"
                    : formatINR(quote.extraPagesCost)}
                </strong>
              </div>

              {quote.appliedCoupon && (
                <div className="lineitem">
                  <span>Coupon ({quote.appliedCoupon.code})</span>
                  <strong className="success-text">
                    {quote.discountAmount > 0
                      ? `-${formatINR(quote.discountAmount)}`
                      : formatCouponBenefit(quote.appliedCoupon)}
                  </strong>
                </div>
              )}

              <div className="lineitem">
                <span>Hosting</span>
                <strong>
                  {quote.hostingIncluded ? "Included (₹0)" : "Separate"}
                </strong>
              </div>

              <div className="lineitem">
                <span>Hosting frequency</span>
                <strong>
                  {quote.hostingFrequency === "To be confirmed"
                    ? "TBC"
                    : quote.hostingFrequency}
                </strong>
              </div>

              <div className="lineitem">
                <span>Selected pages</span>
                <strong>
                  {req.selectedPages.length} / {quote.totalPageAllowance}
                </strong>
              </div>

              {isAdmin && quote.internalHostingCost !== null && (
                <div className="lineitem admin-only-line">
                  <span>Internal hosting cost (Admin)</span>
                  <strong>{formatINR(quote.internalHostingCost)}</strong>
                </div>
              )}

              <div className="summary-total-box">
                <div className="small muted">ESTIMATED TOTAL</div>
                <div className="summary-total">
                  {formatINR(quote.estimatedTotal)}
                </div>
              </div>

              <p className="small muted" style={{ margin: "6px 0 14px" }}>
                Taxes are not calculated. Final quote is subject to agency
                review.
              </p>

              <button
                type="button"
                className="primary wide"
                onClick={() => handleGoToStep("review")}
              >
                <FileText size={14} /> Review quotation
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

