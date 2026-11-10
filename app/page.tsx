"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Clock3,
  Download,
  Eye,
  Filter,
  FolderKanban,
  GripVertical,
  KeyRound,
  LayoutDashboard,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { PricingCouponsView } from "@/components/PricingCouponsView";
import { RequirementWorkspace } from "@/components/RequirementWorkspace";
import {
  playNotificationSound,
  unlockAudioContext,
} from "@/lib/notification-sound";
import {
  createEmptyRequirement,
  DEFAULT_COUPONS,
  DEFAULT_PRICING,
  INITIAL_ACTIVITIES,
  INITIAL_NOTIFICATIONS,
  INITIAL_PROJECTS,
  INITIAL_TEAM,
} from "@/lib/portal-data";
import type {
  ActivityItem,
  Coupon,
  PackageName,
  PortalNotification,
  PricingSettings,
  Project,
  RequirementComment,
  RequirementStep,
  Role,
  Stage,
  TeamMember,
} from "@/lib/portal-types";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import {
  appendActivityInDb,
  createClientRequirementInDb,
  createCouponInDb,
  createWorkspaceUserInDb,
  deleteCouponInDb,
  deleteProjectInDb,
  deleteWorkspaceUserInDb,
  fetchWorkspaceSnapshot,
  insertCommentAndNotificationsInDb,
  insertNotificationsInDb,
  markAllNotificationsReadInDb,
  markNotificationReadInDb,
  savePricingInDb,
  saveRequirementInDb,
  toggleCouponInDb,
  updateOwnPasswordInDb,
  updateStageInDb,
  updateUserPasswordInDb,
} from "@/lib/supabase/portal-api";

type NavPage =
  | "Overview"
  | "Requirements"
  | "Requirement Editor"
  | "Project board"
  | "Team"
  | "Activity logs"
  | "Coupons & pricing"
  | "Administration"
  | "Help & documentation";

interface ToastNotice {
  title?: string;
  message: string;
  variant: "success" | "error" | "info";
}

const STAGES: Stage[] = ["Requirements", "Building", "Completed"];

const STORAGE_KEYS = {
  projects: "cf_portal_v3_projects",
  pricing: "cf_portal_v3_pricing",
  coupons: "cf_portal_v3_coupons",
  team: "cf_portal_v3_team",
  activities: "cf_portal_v3_activities",
  notifications: "cf_portal_v3_notifications",
  sound: "cf_portal_v3_sound",
  sessionUser: "cf_portal_v3_user",
};

const REQUIREMENT_STEPS: Array<{ key: RequirementStep; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "package", label: "01 · Package" },
  { key: "pages", label: "02 · Pages & pricing" },
  { key: "requirements", label: "03 · Requirements" },
  { key: "team", label: "04 · Team & assets" },
  { key: "review", label: "05 · Review & approval" },
];

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function Home() {
  const supabaseEnabled = isSupabaseConfigured();
  const [hydrated, setHydrated] = useState(false);
  const [companyId, setCompanyId] = useState<string>("");
  const [authLoading, setAuthLoading] = useState<boolean>(supabaseEnabled);

  const [active, setActive] = useState<NavPage>("Overview");
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [pricing, setPricing] = useState<PricingSettings>(DEFAULT_PRICING);
  const [coupons, setCoupons] = useState<Coupon[]>(DEFAULT_COUPONS);
  const [team, setTeam] = useState<TeamMember[]>(INITIAL_TEAM);
  const [activities, setActivities] =
    useState<ActivityItem[]>(INITIAL_ACTIVITIES);
  const [notifications, setNotifications] = useState<PortalNotification[]>(
    INITIAL_NOTIFICATIONS
  );
  const [soundEnabled, setSoundEnabled] = useState(true);

  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [activeProjectId, setActiveProjectId] = useState<string>("");
  const [requirementStep, setRequirementStep] =
    useState<RequirementStep>("package");

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("All stages");
  const [showNew, setShowNew] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showTopProfile, setShowTopProfile] = useState(false);
  const [showLogsFilter, setShowLogsFilter] = useState("All activity");
  const [selected, setSelected] = useState<Project | null>(null);
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<Stage | null>(null);

  const [form, setForm] = useState({
    client: "",
    company: "",
    package: "Launch" as PackageName,
    email: "",
  });

  const [inviteForm, setInviteForm] = useState({
    name: "",
    email: "",
    role: "Developer" as Role,
    password: "",
  });
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

  const [passwordModalUser, setPasswordModalUser] =
    useState<TeamMember | null>(null);
  const [userNewPassword, setUserNewPassword] = useState("");
  const [userConfirmPassword, setUserConfirmPassword] = useState("");
  const [userPasswordBusy, setUserPasswordBusy] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const [ownNewPassword, setOwnNewPassword] = useState("");
  const [ownConfirmPassword, setOwnConfirmPassword] = useState("");
  const [ownPasswordBusy, setOwnPasswordBusy] = useState(false);

  const notify = useCallback(
    (
      message: string,
      variant: "success" | "error" | "info" = "success",
      title?: string
    ) => {
      if (variant === "error") {
        playNotificationSound("alert", soundEnabled);
      }
      setToast({ message, variant, title });
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = window.setTimeout(
        () => setToast(null),
        variant === "error" ? 4800 : 3200
      );
    },
    [soundEnabled]
  );

  // Hydrate from Supabase Auth session
  useEffect(() => {
    setSoundEnabled(readStorage(STORAGE_KEYS.sound, true));
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setHydrated(true);
      setAuthLoading(false);
      return;
    }

    let cancelled = false;
    const initSupabaseSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user && !cancelled) {
          const snap = await fetchWorkspaceSnapshot(supabase, session.user.id);
          if (cancelled) return;
          setCompanyId(snap.companyId);
          setTeam(snap.team);
          setPricing(snap.pricing);
          setCoupons(snap.coupons);
          setProjects(snap.projects);
          setActivities(snap.activities);
          setNotifications(snap.notifications);
          setCurrentUserId(snap.currentProfile.id);
          if (snap.projects[0]) setActiveProjectId(snap.projects[0].id);
          setLoggedIn(true);
        }
      } catch (err) {
        if (!cancelled) {
          setLoginError(
            err instanceof Error ? err.message : "Failed to load workspace."
          );
        }
      } finally {
        if (!cancelled) {
          setHydrated(true);
          setAuthLoading(false);
        }
      }
    };
    void initSupabaseSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setLoggedIn(false);
        setProjects([]);
        setActivities([]);
        setNotifications([]);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      STORAGE_KEYS.sound,
      JSON.stringify(soundEnabled)
    );
  }, [hydrated, soundEnabled]);

  // Unlock Web Audio on first interaction
  useEffect(() => {
    const unlock = () => unlockAudioContext();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Realtime listener in Supabase mode
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (supabase && loggedIn && companyId) {
      const refreshQuietly = async () => {
        try {
          const snap = await fetchWorkspaceSnapshot(supabase, currentUserId);
          setTeam(snap.team);
          setProjects((prev) => {
            const unsavedLocal = prev.filter((p) => !p.dbRequirementId);
            return [...unsavedLocal, ...snap.projects];
          });
          setActivities(snap.activities);
          setPricing(snap.pricing);
          setCoupons(snap.coupons);
        } catch {
          // Ignore background sync failures
        }
      };

      const channel = supabase
        .channel(`cf-notifications-${companyId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `recipient_id=eq.${currentUserId}`,
          },
          (payload) => {
            const row = payload.new as Record<string, unknown>;
            const actor = team.find((m) => m.id === row.actor_id);
            const incoming: PortalNotification = {
              id: String(row.id),
              recipientId: String(row.recipient_id),
              recipientName:
                team.find((m) => m.id === row.recipient_id)?.name ?? "You",
              actorId: String(row.actor_id ?? ""),
              actorName: actor?.name ?? "Team",
              projectId: String(row.project_code ?? ""),
              projectCompany: String(row.project_company ?? ""),
              step: (row.step as RequirementStep) || "overview",
              section: row.section ? String(row.section) : undefined,
              title: String(row.title ?? "New notification"),
              message: String(row.message ?? ""),
              createdAt: "Just now",
              read: Boolean(row.is_read),
              kind: (row.kind as PortalNotification["kind"]) || "mention",
            };
            setNotifications((prev) =>
              prev.some((n) => n.id === incoming.id) ? prev : [incoming, ...prev]
            );
            playNotificationSound("mention", soundEnabled);
            notify(incoming.message, "info", incoming.title);
            void refreshQuietly();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "requirements",
            filter: `company_id=eq.${companyId}`,
          },
          () => {
            void refreshQuietly();
          }
        )
        .subscribe();

      return () => {
        void supabase.removeChannel(channel);
      };
    }
  }, [companyId, currentUserId, loggedIn, notify, soundEnabled, team]);

  const currentUser = useMemo(
    () =>
      team.find((m) => m.id === currentUserId) ??
      team[0] ?? {
        id: currentUserId || "",
        name: "User",
        email: "",
        role: "Developer" as Role,
        active: true,
        lastActive: "",
      },
    [team, currentUserId]
  );

  const role: Role = currentUser.role;

  const canEditProject = useCallback(
    (p: Project) => role === "Admin" || p.ownerId === currentUser.id,
    [role, currentUser.id]
  );

  const visibleProjects = useMemo(
    () =>
      projects.filter(
        (p) => !p.requirement.isDraft || p.ownerId === currentUser.id
      ),
    [projects, currentUser.id]
  );

  const publishedProjects = useMemo(
    () => visibleProjects.filter((p) => !p.requirement.isDraft),
    [visibleProjects]
  );

  const log = useCallback(
    (action: string, target: string, type: string) => {
      setActivities((prev) => [
        {
          id: Date.now() + Math.floor(Math.random() * 1000),
          actor: currentUser.name,
          action,
          target,
          time: "Just now",
          type,
        },
        ...prev,
      ]);
    },
    [currentUser.name]
  );

  const filtered = useMemo(
    () =>
      visibleProjects.filter(
        (p) =>
          (stageFilter === "All stages" || p.stage === stageFilter) &&
          `${p.id} ${p.client} ${p.company} ${p.owner} ${p.assignedTo}`
            .toLowerCase()
            .includes(search.toLowerCase())
      ),
    [visibleProjects, search, stageFilter]
  );

  const activeProject = useMemo(
    () =>
      visibleProjects.find((p) => p.id === activeProjectId) ??
      visibleProjects[0] ??
      null,
    [visibleProjects, activeProjectId]
  );

  const openRequirementEditor = (
    projectId: string,
    step?: RequirementStep
  ) => {
    const target = visibleProjects.find((p) => p.id === projectId);
    const resolvedStep =
      step ??
      (target?.requirement.isDraft ? target.requirement.draftStep : "overview");
    setActiveProjectId(projectId);
    setRequirementStep(resolvedStep);
    setActive("Requirement Editor");
    setSelected(null);
  };

  const pushNotifications = useCallback(
    (
      newItems: PortalNotification[],
      soundKind: "mention" | "alert" | "success" = "mention"
    ) => {
      if (newItems.length === 0) return;
      setNotifications((prev) => [...newItems, ...prev]);
      playNotificationSound(soundKind, soundEnabled);
    },
    [soundEnabled]
  );

  const handleSaveProject = useCallback(
    async (
      projectToSave: Project,
      options?: { publish?: boolean; step?: RequirementStep }
    ): Promise<boolean> => {
      if (!canEditProject(projectToSave)) {
        notify(
          "You only have read-only preview access to this requirement.",
          "error",
          "Permission denied"
        );
        return false;
      }

      const existing = projects.find((p) => p.id === projectToSave.id);
      const wasDraft = existing ? existing.requirement.isDraft : true;
      const isPublishing =
        Boolean(options?.publish) ||
        (wasDraft && !projectToSave.requirement.isDraft);
      const savedCopy: Project = { ...projectToSave };

      const supabase = getSupabaseBrowserClient();
      if (supabase && companyId) {
        try {
          if (!savedCopy.dbRequirementId || !savedCopy.dbClientId) {
            const ids = await createClientRequirementInDb(
              supabase,
              companyId,
              currentUser.id,
              savedCopy,
              pricing,
              coupons
            );
            savedCopy.dbClientId = ids.dbClientId;
            savedCopy.dbRequirementId = ids.dbRequirementId;
          } else {
            await saveRequirementInDb(
              supabase,
              companyId,
              currentUser.id,
              savedCopy,
              pricing,
              coupons
            );
            if (!savedCopy.requirement.isDraft) {
              await appendActivityInDb(
                supabase,
                companyId,
                currentUser.id,
                isPublishing ? "requirement_created" : "requirement_updated",
                "requirement",
                savedCopy.company,
                isPublishing
                  ? "submitted requirement for"
                  : "saved requirement for"
              );
            }
          }

          if (isPublishing) {
            const recipientIds = Array.from(
              new Set([
                savedCopy.assignedToId,
                ...savedCopy.requirement.taggedMemberIds,
              ])
            ).filter((id) => id && id !== currentUser.id);
            const alerts: PortalNotification[] = team
              .filter((m) => recipientIds.includes(m.id))
              .map((member, idx) => ({
                id: `ntf-pub-${Date.now()}-${idx}`,
                recipientId: member.id,
                recipientName: member.name,
                actorId: currentUser.id,
                actorName: currentUser.name,
                projectId: savedCopy.id,
                projectCompany: savedCopy.company,
                step: "overview",
                title: `New requirement submitted: ${savedCopy.company}`,
                message: `${currentUser.name} completed and shared the requirement for ${savedCopy.company}.`,
                createdAt: "Just now",
                read: false,
                kind: "assignment",
              }));
            if (alerts.length > 0) {
              const persistedAlerts = await insertNotificationsInDb(
                supabase,
                companyId,
                currentUser.id,
                savedCopy.dbRequirementId,
                alerts
              );
              pushNotifications(persistedAlerts, "mention");
            }
          }
        } catch (err) {
          notify(
            err instanceof Error ? err.message : "Failed to save to database.",
            "error",
            "Save error"
          );
          return false;
        }
      }

      setProjects((prev) =>
        prev.some((p) => p.id === savedCopy.id)
          ? prev.map((p) => (p.id === savedCopy.id ? savedCopy : p))
          : [savedCopy, ...prev]
      );

      if (!savedCopy.requirement.isDraft) {
        log(
          isPublishing ? "submitted requirement for" : "saved requirement for",
          savedCopy.company,
          isPublishing ? "Created" : "Updated"
        );
      }

      playNotificationSound("success", soundEnabled);
      if (savedCopy.requirement.isDraft) {
        notify(
          `Draft saved privately (${savedCopy.company}). Only you can view it until submitted.`,
          "success"
        );
      } else if (isPublishing) {
        notify(
          `Requirement submitted and shared with your team (${savedCopy.company}).`,
          "success"
        );
      } else {
        notify(`Saved ${savedCopy.company} (${savedCopy.id}).`, "success");
      }
      return true;
    },
    [
      canEditProject,
      companyId,
      coupons,
      currentUser.id,
      currentUser.name,
      log,
      notify,
      pricing,
      projects,
      pushNotifications,
      soundEnabled,
      team,
    ]
  );

  const handleTagMembers = useCallback(
    async ({
      project,
      memberIds,
      step,
      section,
      message,
      addComment = true,
    }: {
      project: Project;
      memberIds: string[];
      step: RequirementStep;
      section?: string;
      message: string;
      addComment?: boolean;
    }) => {
      const uniqueIds = Array.from(new Set(memberIds)).filter(Boolean);
      const nowTime = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      const newComment: RequirementComment | null = addComment
        ? {
            id: `cmt-${Date.now()}-${Math.floor(Math.random() * 100)}`,
            authorId: currentUser.id,
            authorName: currentUser.name,
            step,
            section,
            text: message,
            taggedMemberIds: uniqueIds,
            createdAt: `Today, ${nowTime}`,
          }
        : null;

      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== project.id) return p;
          const mergedTagged = Array.from(
            new Set([...p.requirement.taggedMemberIds, ...uniqueIds])
          );
          return {
            ...p,
            updated: "Just now",
            requirement: {
              ...p.requirement,
              taggedMemberIds: mergedTagged,
              comments: newComment
                ? [newComment, ...p.requirement.comments]
                : p.requirement.comments,
              lastSavedAt: `Today, ${nowTime}`,
            },
          };
        })
      );

      const targetMembers = team.filter((m) => uniqueIds.includes(m.id));
      const createdAlerts: PortalNotification[] = targetMembers.map(
        (member, idx) => ({
          id: `ntf-${Date.now()}-${idx}`,
          recipientId: member.id,
          recipientName: member.name,
          actorId: currentUser.id,
          actorName: currentUser.name,
          projectId: project.id,
          projectCompany: project.company,
          step,
          section,
          title: section
            ? `Tagged in ${project.company} (${section})`
            : `Tagged in ${project.company}`,
          message,
          createdAt: `Today, ${nowTime}`,
          read: false,
          kind: "mention",
        })
      );

      let savedAlerts = createdAlerts;
      const supabase = getSupabaseBrowserClient();
      if (supabase && companyId) {
        try {
          savedAlerts = await insertCommentAndNotificationsInDb(supabase, {
            companyId,
            actorId: currentUser.id,
            project,
            step,
            section,
            message,
            taggedIds: uniqueIds,
            notifications: createdAlerts,
            addComment,
          });
        } catch (err) {
          notify(
            err instanceof Error ? err.message : "Failed to save tag.",
            "error",
            "Notification error"
          );
        }
      }

      if (targetMembers.length > 0) {
        pushNotifications(savedAlerts, "mention");
        const namesStr = targetMembers.map((m) => m.name).join(", ");
        log(
          section
            ? `tagged ${namesStr} in ${section} for`
            : `tagged ${namesStr} in`,
          project.company,
          "Mention"
        );
        notify(`Notified ${namesStr} with sound alert.`, "success");
      } else if (addComment) {
        log("added a requirement note on", project.company, "Updated");
        notify("Requirement note saved.", "success");
      }
    },
    [
      companyId,
      currentUser.id,
      currentUser.name,
      log,
      notify,
      pushNotifications,
      team,
    ]
  );

  const moveProject = async (project: Project, stage: Stage) => {
    if (project.stage === stage) return;
    if (role !== "Admin" && stage === "Completed") {
      notify("Only an admin can move a project to Completed.", "error", "Permission required");
      return;
    }

    const nextProgress =
      stage === "Completed"
        ? 100
        : Math.max(project.progress, stage === "Building" ? 70 : 25);

    setProjects((prev) =>
      prev.map((p) =>
        p.id === project.id
          ? {
              ...p,
              stage,
              progress: nextProgress,
              updated: "Just now",
            }
          : p
      )
    );
    if (selected?.id === project.id) {
      setSelected((prev) => (prev ? { ...prev, stage } : null));
    }
    log(`moved project to ${stage}`, project.company, "Status");

    const supabase = getSupabaseBrowserClient();
    if (supabase && companyId) {
      try {
        await updateStageInDb(
          supabase,
          companyId,
          currentUser.id,
          project,
          stage,
          nextProgress
        );
      } catch (err) {
        notify(
          err instanceof Error ? err.message : "Failed to update stage.",
          "error",
          "Sync error"
        );
      }
    }

    const recipients = Array.from(
      new Set([
        project.ownerId,
        project.assignedToId,
        ...project.requirement.taggedMemberIds,
      ])
    ).filter((id) => id !== currentUser.id);

    const alertList: PortalNotification[] = team
      .filter((m) => recipients.includes(m.id))
      .map((member, idx) => ({
        id: `ntf-stage-${Date.now()}-${idx}`,
        recipientId: member.id,
        recipientName: member.name,
        actorId: currentUser.id,
        actorName: currentUser.name,
        projectId: project.id,
        projectCompany: project.company,
        step: "overview",
        title: `Stage updated to ${stage}`,
        message: `${currentUser.name} moved ${project.company} to ${stage}.`,
        createdAt: "Just now",
        read: false,
        kind: "stage",
      }));

    if (alertList.length > 0) {
      if (supabase && companyId) {
        try {
          await insertNotificationsInDb(
            supabase,
            companyId,
            currentUser.id,
            project.dbRequirementId,
            alertList
          );
        } catch {
          // Keep UI smooth if optional notification insert fails
        }
      }
      pushNotifications(alertList, "alert");
    }
    notify(`${project.company} moved to ${stage}.`, "success");
  };

  const createProject = () => {
    if (!form.client.trim() || !form.company.trim()) {
      notify(
        "Client contact name and company name are required.",
        "error",
        "Incomplete fields"
      );
      return;
    }

    const id = `CF-${String(Date.now()).slice(-5)}`;
    const newProj: Project = {
      id,
      client: form.client.trim(),
      company: form.company.trim(),
      ownerId: currentUser.id,
      owner: currentUser.name,
      assignedToId: currentUser.id,
      assignedTo: currentUser.name,
      stage: "Requirements",
      updated: "Not saved yet",
      package: form.package,
      progress: 25,
      requirement: createEmptyRequirement({
        packageSelected: form.package,
        companyName: form.company.trim(),
        isDraft: true,
        draftStep: "package",
        lastSavedAt: "Not saved yet",
        clientTeam: {
          contactPerson: form.client.trim(),
          contactEmail: form.email.trim(),
          contactPhone: "",
          decisionMaker: "",
          contentProvider: "",
          designApprover: "",
          finalApprover: "",
        },
      }),
    };

    setProjects((prev) => [newProj, ...prev]);
    setForm({ client: "", company: "", package: "Launch", email: "" });
    setShowNew(false);
    openRequirementEditor(newProj.id, "package");
    notify(
      "Draft opened locally. Nothing is sent to the database until you click Save draft or Submit.",
      "info"
    );
  };

  const deleteProject = async (p: Project) => {
    const canDeleteOwnDraft =
      p.requirement.isDraft && p.ownerId === currentUser.id;
    if (role !== "Admin" && !canDeleteOwnDraft) {
      notify("Only admins can delete projects.", "error", "Permission required");
      return;
    }
    const promptMsg = p.requirement.isDraft
      ? `Discard draft for ${p.company}?`
      : `Delete ${p.company}? This action cannot be undone.`;
    if (!confirm(promptMsg)) return;

    const supabase = getSupabaseBrowserClient();
    if (supabase && companyId && p.dbClientId) {
      try {
        await deleteProjectInDb(supabase, companyId, currentUser.id, p);
      } catch (err) {
        notify(
          err instanceof Error ? err.message : "Failed to delete project.",
          "error",
          "Database error"
        );
        return;
      }
    }

    setProjects((prev) => prev.filter((x) => x.id !== p.id));
    if (!p.requirement.isDraft) {
      log("deleted requirement for", p.company, "Deleted");
    }
    setSelected(null);
    if (active === "Requirement Editor" && activeProjectId === p.id) {
      setActive("Requirements");
    }
    notify(p.requirement.isDraft ? "Draft discarded." : "Project deleted.", "info");
  };

  const handleSavePricing = async (nextPricing: PricingSettings) => {
    const supabase = getSupabaseBrowserClient();
    if (supabase && companyId) {
      try {
        await savePricingInDb(supabase, companyId, currentUser.id, nextPricing);
      } catch (err) {
        notify(
          err instanceof Error ? err.message : "Failed to save pricing.",
          "error",
          "Database error"
        );
        return;
      }
    }
    setPricing(nextPricing);
    log("updated package & page pricing settings", "CoreForge Pricing", "Updated");
    playNotificationSound("success", soundEnabled);
    notify("Pricing settings saved and applied live.", "success");
  };

  const handleCreateCoupon = async (
    newCoupon: Omit<Coupon, "id" | "usageCount">
  ) => {
    const supabase = getSupabaseBrowserClient();
    if (supabase && companyId) {
      try {
        const savedCoupon = await createCouponInDb(
          supabase,
          companyId,
          currentUser.id,
          newCoupon
        );
        setCoupons((prev) => [savedCoupon, ...prev]);
        log(`created coupon ${savedCoupon.code}`, "Coupons & pricing", "Created");
        playNotificationSound("success", soundEnabled);
        notify(`Coupon ${savedCoupon.code} created.`, "success");
        return;
      } catch (err) {
        notify(
          err instanceof Error ? err.message : "Failed to create coupon.",
          "error",
          "Database error"
        );
        return;
      }
    }

    const created: Coupon = {
      ...newCoupon,
      id: `cpn-${Date.now()}`,
      usageCount: 0,
    };
    setCoupons((prev) => [created, ...prev]);
    log(`created coupon ${created.code}`, "Coupons & pricing", "Created");
    playNotificationSound("success", soundEnabled);
    notify(`Coupon ${created.code} created.`, "success");
  };

  const handleToggleCoupon = async (id: string) => {
    const target = coupons.find((c) => c.id === id);
    if (!target) return;
    const supabase = getSupabaseBrowserClient();
    if (supabase && companyId) {
      try {
        await toggleCouponInDb(supabase, id, !target.active);
      } catch (err) {
        notify(
          err instanceof Error ? err.message : "Failed to toggle coupon.",
          "error",
          "Database error"
        );
        return;
      }
    }
    setCoupons((prev) =>
      prev.map((c) => (c.id === id ? { ...c, active: !c.active } : c))
    );
    notify("Coupon status updated.", "success");
  };

  const handleDeleteCoupon = async (id: string) => {
    const found = coupons.find((c) => c.id === id);
    if (!found) return;
    const supabase = getSupabaseBrowserClient();
    if (supabase && companyId) {
      try {
        await deleteCouponInDb(supabase, id);
      } catch (err) {
        notify(
          err instanceof Error ? err.message : "Failed to delete coupon.",
          "error",
          "Database error"
        );
        return;
      }
    }
    setCoupons((prev) => prev.filter((c) => c.id !== id));
    log(`deleted coupon ${found.code}`, "Coupons & pricing", "Deleted");
    notify(`Coupon ${found.code} removed.`, "info");
  };

  const handleInviteMember = async () => {
    if (role !== "Admin") return;
    if (
      !inviteForm.name.trim() ||
      !inviteForm.email.trim() ||
      inviteForm.password.length < 6
    ) {
      notify(
        "Full name, email, and a password of at least 6 characters are required.",
        "error",
        "Incomplete fields"
      );
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      notify(
        "Supabase connection is required to create workspace users.",
        "error"
      );
      return;
    }

    setInviteSubmitting(true);
    try {
      const userId = await createWorkspaceUserInDb(supabase, {
        fullName: inviteForm.name.trim(),
        email: inviteForm.email.trim(),
        password: inviteForm.password,
        role: inviteForm.role,
      });
      const created: TeamMember = {
        id: userId,
        name: inviteForm.name.trim(),
        email: inviteForm.email.trim().toLowerCase(),
        role: inviteForm.role,
        active: true,
        lastActive: "Just created",
      };
      setTeam((prev) => [...prev, created]);
      log(
        `created user account for ${created.name}`,
        created.email,
        "Created"
      );
      setInviteForm({ name: "", email: "", role: "Developer", password: "" });
      setShowInvite(false);
      playNotificationSound("success", soundEnabled);
      notify(`User account created for ${created.name}.`, "success");
    } catch (err) {
      notify(
        err instanceof Error
          ? err.message
          : "Failed to create user. Ensure supabase/migration_v2.sql was executed.",
        "error",
        "User creation failed"
      );
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleChangeUserPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role !== "Admin" || !passwordModalUser) return;
    if (userNewPassword.length < 6) {
      notify("Password must be at least 6 characters.", "error");
      return;
    }
    if (userNewPassword !== userConfirmPassword) {
      notify("Passwords do not match.", "error");
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setUserPasswordBusy(true);
    try {
      await updateUserPasswordInDb(
        supabase,
        passwordModalUser.id,
        userNewPassword
      );
      log(
        `changed password for ${passwordModalUser.name}`,
        passwordModalUser.email,
        "Updated"
      );
      playNotificationSound("success", soundEnabled);
      notify(`Password updated for ${passwordModalUser.name}.`, "success");
      setPasswordModalUser(null);
      setUserNewPassword("");
      setUserConfirmPassword("");
    } catch (err) {
      notify(
        err instanceof Error
          ? err.message
          : "Failed to change password. Ensure supabase/migration_v2.sql was executed.",
        "error",
        "Password update failed"
      );
    } finally {
      setUserPasswordBusy(false);
    }
  };

  const handleDeleteUser = async (member: TeamMember) => {
    if (role !== "Admin") return;
    if (member.id === currentUser.id) {
      notify("You cannot delete your own active admin account.", "error");
      return;
    }
    if (
      !confirm(
        `Delete user ${member.name} (${member.email})? Existing projects created by this user will be preserved.`
      )
    ) {
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setDeletingUserId(member.id);
    try {
      await deleteWorkspaceUserInDb(supabase, member.id);
      setTeam((prev) => prev.filter((m) => m.id !== member.id));
      setProjects((prev) =>
        prev.map((p) => ({
          ...p,
          ownerId: p.ownerId === member.id ? currentUser.id : p.ownerId,
          owner: p.ownerId === member.id ? currentUser.name : p.owner,
          assignedToId: p.assignedToId === member.id ? "" : p.assignedToId,
          assignedTo:
            p.assignedToId === member.id ? "Unassigned" : p.assignedTo,
        }))
      );
      log(`deleted user account for ${member.name}`, member.email, "Deleted");
      notify(`Deleted user ${member.name}.`, "info");
    } catch (err) {
      notify(
        err instanceof Error
          ? err.message
          : "Failed to delete user. Ensure supabase/migration_v2.sql was executed.",
        "error",
        "Delete failed"
      );
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleChangeOwnPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role !== "Admin") return;
    if (ownNewPassword.length < 6) {
      notify("New password must be at least 6 characters.", "error");
      return;
    }
    if (ownNewPassword !== ownConfirmPassword) {
      notify("New passwords do not match.", "error");
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setOwnPasswordBusy(true);
    try {
      await updateOwnPasswordInDb(supabase, ownNewPassword);
      setOwnNewPassword("");
      setOwnConfirmPassword("");
      playNotificationSound("success", soundEnabled);
      notify("Your administrator password has been updated.", "success");
    } catch (err) {
      notify(
        err instanceof Error ? err.message : "Failed to update password.",
        "error",
        "Password update failed"
      );
    } finally {
      setOwnPasswordBusy(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    const email = loginEmail.trim().toLowerCase();
    if (!email || !loginPassword) {
      setLoginError("Please enter both email address and password.");
      playNotificationSound("alert", soundEnabled);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setLoginError(
        "Authentication service is not configured. Contact your administrator."
      );
      playNotificationSound("alert", soundEnabled);
      return;
    }

    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: loginPassword,
      });
      if (error || !data.user) {
        throw new Error(error?.message || "Invalid login credentials.");
      }
      const snap = await fetchWorkspaceSnapshot(supabase, data.user.id);
      setCompanyId(snap.companyId);
      setTeam(snap.team);
      setPricing(snap.pricing);
      setCoupons(snap.coupons);
      setProjects(snap.projects);
      setActivities(snap.activities);
      setNotifications(snap.notifications);
      setCurrentUserId(snap.currentProfile.id);
      if (snap.projects[0]) setActiveProjectId(snap.projects[0].id);
      await appendActivityInDb(
        supabase,
        snap.companyId,
        snap.currentProfile.id,
        "login",
        "session",
        snap.currentProfile.email,
        "signed in"
      );
      setLoggedIn(true);
      notify(`Welcome back, ${snap.currentProfile.name}.`, "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign in failed.";
      setLoginError(msg);
      playNotificationSound("alert", soundEnabled);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      if (companyId) {
        await appendActivityInDb(
          supabase,
          companyId,
          currentUser.id,
          "logout",
          "session",
          currentUser.email,
          "signed out"
        );
      }
      await supabase.auth.signOut();
    }
    setLoggedIn(false);
    setShowProfile(false);
    setShowTopProfile(false);
    setLoginPassword("");
  };

  if (authLoading && !hydrated) {
    return (
      <main className="login-screen">
        <div className="login-box">
          <div className="brand-mark">
            CORE<span>FORGE.</span>
          </div>
          <p className="muted">Connecting to CoreForge workspace...</p>
        </div>
      </main>
    );
  }

  if (!loggedIn) {
    return (
      <main className="login-screen">
        <form className="login-box" onSubmit={handleLoginSubmit}>
          <div className="brand-mark">
            CORE<span>FORGE.</span>
          </div>
          <div className="eyebrow">COREFORGE WORKSPACE</div>
          <h1>Sign in to CoreForge</h1>
          <p className="muted">
            Access projects, requirements and team activity.
          </p>
          <label>
            Email address
            <input
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="name@company.com"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </label>
          {loginError && (
            <p className="small error-text" style={{ margin: 0 }}>
              {loginError}
            </p>
          )}
          <button className="primary wide" type="submit" disabled={authLoading}>
            {authLoading ? "Signing in..." : "Sign in"}{" "}
            <ArrowUpRight size={16} />
          </button>
        </form>
      </main>
    );
  }

  const nav = [
    { name: "Overview" as NavPage, icon: LayoutDashboard },
    { name: "Requirements" as NavPage, icon: ClipboardList },
    { name: "Project board" as NavPage, icon: FolderKanban },
    { name: "Team" as NavPage, icon: Users },
    { name: "Activity logs" as NavPage, icon: Activity },
    { name: "Coupons & pricing" as NavPage, icon: SlidersHorizontal },
    ...(role === "Admin"
      ? [{ name: "Administration" as NavPage, icon: ShieldCheck }]
      : []),
  ];

  const stats = [
    {
      label: "Total projects",
      value: publishedProjects.length,
      sub: "Submitted workspace clients",
      icon: BriefcaseBusiness,
    },
    {
      label: "Requirements",
      value: publishedProjects.filter((p) => p.stage === "Requirements").length,
      sub: "Awaiting scope confirmation",
      icon: ClipboardList,
    },
    {
      label: "Building",
      value: publishedProjects.filter((p) => p.stage === "Building").length,
      sub: "Currently in development",
      icon: FolderKanban,
    },
    {
      label: "Completed",
      value: publishedProjects.filter((p) => p.stage === "Completed").length,
      sub: "Delivered projects",
      icon: CheckCircle2,
    },
  ];

  const activeStepLabel =
    REQUIREMENT_STEPS.find((s) => s.key === requirementStep)?.label ?? "";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark">
            CORE<span>FORGE.</span>
          </div>
          <span className="workspace-tag">PORTAL</span>
        </div>

        <div className="company-switch">
          <div className="company-icon">C</div>
          <div>
            <b>CoreForge LLP</b>
            <small>Company workspace</small>
          </div>
          <ChevronDown size={15} />
        </div>

        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav.map((item) => {
            const isReqGroup = item.name === "Requirements";
            const isActive =
              active === item.name ||
              (isReqGroup && active === "Requirement Editor");
            return (
              <div key={item.name}>
                <button
                  className={`nav-item ${isActive ? "active" : ""}`}
                  onClick={() => setActive(item.name)}
                >
                  <item.icon size={17} />
                  <span>{item.name}</span>
                  {item.name === "Activity logs" && activities.length > 0 && (
                    <i className="nav-dot" />
                  )}
                </button>

                {isReqGroup && (
                  <div className="sidebar-subnav">
                    {REQUIREMENT_STEPS.map((s) => (
                      <button
                        key={s.key}
                        className={`subnav-item ${
                          active === "Requirement Editor" &&
                          requirementStep === s.key
                            ? "active"
                            : ""
                        }`}
                        onClick={() => {
                          if (activeProject) {
                            openRequirementEditor(activeProject.id, s.key);
                          } else {
                            setShowNew(true);
                            notify(
                              "Create your first requirement to open step " +
                                s.label,
                              "info"
                            );
                          }
                        }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <CircleHelp size={17} />
            <b>Need help?</b>
            <p>View the workspace guide and workflow documentation.</p>
            <button onClick={() => setActive("Help & documentation")}>
              Open guide <ArrowUpRight size={13} />
            </button>
          </div>

          <div className="sidebar-user">
            <div className="avatar">
              {currentUser.name
                .split(" ")
                .map((x) => x[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div className="user-meta">
              <b>{currentUser.name}</b>
              <small>{role}</small>
            </div>
            <button
              className="icon-button"
              aria-label="User menu"
              onClick={() => setShowProfile(!showProfile)}
            >
              <MoreHorizontal size={18} />
            </button>

            {showProfile && (
              <div className="profile-pop">
                <button onClick={handleLogout}>Log out</button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>CoreForge</span>
            <span>/</span>
            {active === "Requirement Editor" && activeProject ? (
              <>
                <button
                  type="button"
                  className="crumb-link"
                  onClick={() => setActive("Requirements")}
                >
                  Requirements
                </button>
                <span>/</span>
                <b>
                  {activeProject.company} · {activeStepLabel}
                </b>
              </>
            ) : (
              <b>{active}</b>
            )}
          </div>

          <div className="topbar-right">
            <div className="searchbox">
              <Search size={15} />
              <input
                placeholder="Search projects, clients..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>⌘ K</kbd>
            </div>

            <NotificationBell
              notifications={notifications}
              currentUserId={currentUser.id}
              soundEnabled={soundEnabled}
              onToggleSound={() => setSoundEnabled((prev) => !prev)}
              onMarkRead={(id) => {
                setNotifications((prev) =>
                  prev.map((n) => (n.id === id ? { ...n, read: true } : n))
                );
                const supabase = getSupabaseBrowserClient();
                if (supabase) void markNotificationReadInDb(supabase, id);
              }}
              onMarkAllRead={() => {
                setNotifications((prev) =>
                  prev.map((n) =>
                    n.recipientId === currentUser.id ? { ...n, read: true } : n
                  )
                );
                const supabase = getSupabaseBrowserClient();
                if (supabase)
                  void markAllNotificationsReadInDb(supabase, currentUser.id);
              }}
              onOpenNotification={(projectId, step) => {
                if (projectId) openRequirementEditor(projectId, step);
              }}
            />

            <div className="topbar-user-wrap">
              <button
                type="button"
                className="top-avatar-btn"
                title={`Signed in as ${currentUser.name} (${role})`}
                onClick={() => setShowTopProfile((p) => !p)}
              >
                <span className="top-avatar">
                  {currentUser.name
                    .split(" ")
                    .map((x) => x[0])
                    .join("")
                    .slice(0, 2)}
                </span>
              </button>

              {showTopProfile && (
                <div className="profile-pop topbar-profile-pop">
                  <div className="profile-pop-label">
                    ACTIVE USER · {currentUser.name} ({role})
                  </div>
                  <div className="profile-pop-divider" />
                  <button onClick={handleLogout}>Log out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="content">
          {active === "Overview" && (
            <>
              <div className="page-title-row">
                <div>
                  <div className="eyebrow">WORKSPACE DASHBOARD</div>
                  <h1>Good afternoon, {currentUser.name.split(" ")[0]}.</h1>
                  <p className="muted">
                    Here&apos;s what&apos;s happening across your projects today.
                  </p>
                </div>
                <button className="primary" onClick={() => setShowNew(true)}>
                  <Plus size={16} /> New requirement
                </button>
              </div>

              <section className="stats-grid">
                {stats.map((s) => (
                  <div className="stat-card" key={s.label}>
                    <div className="stat-top">
                      <span>{s.label}</span>
                      <s.icon size={17} />
                    </div>
                    <strong>{s.value}</strong>
                    <small>{s.sub}</small>
                  </div>
                ))}
              </section>

              <div className="overview-grid">
                <section className="surface">
                  <div className="section-head">
                    <div>
                      <h2>Recent projects</h2>
                      <p>Latest client requirements and development work.</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setActive("Requirements")}
                    >
                      View all <ArrowUpRight size={14} />
                    </button>
                  </div>
                  <ProjectTable
                    projects={filtered.slice(0, 5)}
                    emptyText="No projects yet. Click '+ New requirement' to add your first client."
                    canEdit={canEditProject}
                    onOpen={(p) => setSelected(p)}
                    onEdit={(p) => openRequirementEditor(p.id)}
                  />
                </section>

                <section className="surface activity-preview">
                  <div className="section-head">
                    <div>
                      <h2>Recent activity</h2>
                      <p>Latest team actions &amp; mentions.</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setActive("Activity logs")}
                    >
                      View logs <ArrowUpRight size={14} />
                    </button>
                  </div>
                  {activities.length === 0 ? (
                    <div className="empty-state">No activity recorded yet.</div>
                  ) : (
                    activities
                      .slice(0, 5)
                      .map((a) => <ActivityRow key={a.id} item={a} />)
                  )}
                </section>
              </div>

              <section className="surface team-pulse">
                <div className="section-head">
                  <div>
                    <h2>Team workload</h2>
                    <p>Projects currently assigned across the team.</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setActive("Team")}
                  >
                    {role === "Admin" ? "Manage team" : "View team"}{" "}
                    <ArrowUpRight size={14} />
                  </button>
                </div>
                <div className="workload">
                  {team.map((member) => {
                    const count = publishedProjects.filter(
                      (p) =>
                        p.assignedToId === member.id || p.ownerId === member.id
                    ).length;
                    return (
                      <Workload
                        key={member.id}
                        name={member.name}
                        count={count}
                        total={Math.max(1, publishedProjects.length)}
                      />
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {active === "Requirements" && (
            <>
              <div className="page-title-row">
                <div>
                  <div className="eyebrow">CLIENT ONBOARDING</div>
                  <h1>Requirements</h1>
                  <p className="muted">
                    One active requirement record per client. Open any record to
                    edit steps 01–05, pricing, coupons, and team tags.
                  </p>
                </div>
                <button className="primary" onClick={() => setShowNew(true)}>
                  <Plus size={16} /> New requirement
                </button>
              </div>

              <div className="toolbar">
                <div className="searchbox">
                  <Search size={15} />
                  <input
                    placeholder="Search client or project..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                >
                  <option>All stages</option>
                  {STAGES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <button
                  className="secondary"
                  onClick={() => {
                    setSearch("");
                    setStageFilter("All stages");
                  }}
                >
                  <Filter size={15} /> Clear
                </button>
              </div>

              <section className="surface">
                <ProjectTable
                  projects={filtered}
                  emptyText="No requirements yet. Click '+ New requirement' to create one."
                  canEdit={canEditProject}
                  onOpen={(p) => setSelected(p)}
                  onEdit={(p) => openRequirementEditor(p.id)}
                  onDelete={deleteProject}
                  admin={role === "Admin"}
                />
              </section>
            </>
          )}

          {active === "Requirement Editor" && activeProject && (
            <RequirementWorkspace
              key={activeProject.id}
              project={activeProject}
              projects={visibleProjects}
              step={requirementStep}
              role={role}
              currentUser={currentUser}
              team={team}
              pricing={pricing}
              coupons={coupons}
              canEdit={canEditProject(activeProject)}
              onChangeStep={setRequirementStep}
              onSelectProject={(id) => openRequirementEditor(id)}
              onBackToList={() => setActive("Requirements")}
              onMoveStage={moveProject}
              onTagMembers={handleTagMembers}
              onOpenGlobalPricing={() => setActive("Coupons & pricing")}
              onSaveProject={handleSaveProject}
              onDeleteDraft={deleteProject}
              onNotifyToast={notify}
            />
          )}

          {active === "Project board" && (
            <>
              <div className="page-title-row">
                <div>
                  <div className="eyebrow">DELIVERY PIPELINE</div>
                  <h1>Project board</h1>
                  <p className="muted">
                    Drag and drop submitted project cards between Requirements,
                    Building, and Completed.
                  </p>
                </div>
                <button className="primary" onClick={() => setShowNew(true)}>
                  <Plus size={16} /> New requirement
                </button>
              </div>

              <div className="kanban">
                {STAGES.map((stage) => {
                  const stageProjects = publishedProjects.filter(
                    (p) => p.stage === stage
                  );
                  return (
                    <div
                      key={stage}
                      className={`kanban-col ${
                        dragOverStage === stage ? "drag-over" : ""
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (dragOverStage !== stage) {
                          setDragOverStage(stage);
                        }
                      }}
                      onDragLeave={(e) => {
                        if (
                          !e.currentTarget.contains(e.relatedTarget as Node)
                        ) {
                          setDragOverStage(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const droppedId =
                          e.dataTransfer.getData("text/plain") ||
                          draggedProjectId;
                        setDragOverStage(null);
                        setDraggedProjectId(null);
                        if (!droppedId) return;
                        const targetProj = publishedProjects.find(
                          (x) => x.id === droppedId
                        );
                        if (targetProj) {
                          void moveProject(targetProj, stage);
                        }
                      }}
                    >
                      <div className="kanban-heading">
                        <div>
                          <span
                            className={`stage-dot ${stage.toLowerCase()}`}
                          />
                          <b>{stage}</b>
                        </div>
                        <span className="count-pill">
                          {stageProjects.length}
                        </span>
                      </div>

                      {stageProjects.length === 0 ? (
                        <div className="kanban-empty-drop">
                          Drop project card here
                        </div>
                      ) : (
                        stageProjects.map((p) => {
                          const editable = canEditProject(p);
                          return (
                            <article
                              key={p.id}
                              draggable
                              onDragStart={(e) => {
                                setDraggedProjectId(p.id);
                                e.dataTransfer.effectAllowed = "move";
                                e.dataTransfer.setData("text/plain", p.id);
                              }}
                              onDragEnd={() => {
                                setDraggedProjectId(null);
                                setDragOverStage(null);
                              }}
                              className={`project-card ${
                                draggedProjectId === p.id ? "dragging" : ""
                              }`}
                            >
                              <div className="card-top">
                                <span className="drag-handle">
                                  <GripVertical size={12} /> {p.id}
                                </span>
                                <button
                                  className="icon-button"
                                  onClick={() => openRequirementEditor(p.id)}
                                  title={
                                    editable
                                      ? "Open requirement editor"
                                      : "View full detailed preview"
                                  }
                                >
                                  {editable ? (
                                    <Pencil size={14} />
                                  ) : (
                                    <Eye size={14} />
                                  )}
                                </button>
                              </div>
                              <h3>{p.company}</h3>
                              <p>{p.client}</p>
                              <div className="card-meta">
                                <span>{p.package || "Unselected"}</span>
                                <span>
                                  <UserRound size={12} /> {p.assignedTo}
                                </span>
                              </div>
                              <div className="mini-progress">
                                <span style={{ width: `${p.progress}%` }} />
                              </div>
                              <div className="card-footer">
                                <small>{p.updated}</small>
                                <select
                                  aria-label={`Move ${p.company}`}
                                  value={p.stage}
                                  onChange={(e) =>
                                    void moveProject(p, e.target.value as Stage)
                                  }
                                >
                                  {STAGES.map((s) => (
                                    <option key={s}>{s}</option>
                                  ))}
                                </select>
                              </div>
                            </article>
                          );
                        })
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {active === "Team" && (
            <>
              <div className="page-title-row">
                <div>
                  <div className="eyebrow">PEOPLE &amp; ACCESS</div>
                  <h1>Team</h1>
                  <p className="muted">
                    {role === "Admin"
                      ? "CoreForge workspace users. Manage accounts, passwords, and deletions in Administration."
                      : "CoreForge workspace team members."}
                  </p>
                </div>
                {role === "Admin" && (
                  <button
                    className="primary"
                    onClick={() => setShowInvite(true)}
                  >
                    <Plus size={16} /> Add user
                  </button>
                )}
              </div>

              <section className="surface">
                <div className="section-head">
                  <div>
                    <h2>Workspace members</h2>
                    <p>
                      {role === "Admin"
                        ? "Active workspace members across Admin and Developer roles."
                        : "Team members in your CoreForge workspace."}
                    </p>
                  </div>
                  <span className="soft-tag">{team.length} members</span>
                </div>

                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>MEMBER</th>
                        <th>ROLE</th>
                        <th>ASSIGNED PROJECTS</th>
                        <th>LAST ACTIVE</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {team.map((m) => {
                        const count = publishedProjects.filter(
                          (p) => p.assignedToId === m.id || p.ownerId === m.id
                        ).length;
                        return (
                          <tr key={m.id}>
                            <td>
                              <div className="member-cell">
                                <div className="avatar">
                                  {m.name
                                    .split(" ")
                                    .map((x) => x[0])
                                    .join("")
                                    .slice(0, 2)}
                                </div>
                                <div>
                                  <b>{m.name}</b>
                                  <small>{m.email}</small>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="role-pill">{m.role}</span>
                            </td>
                            <td>{count} projects</td>
                            <td>{m.lastActive}</td>
                            <td>
                              <span className="status-live">
                                {m.active ? "Active" : "Inactive"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {active === "Activity logs" && (
            <>
              <div className="page-title-row">
                <div>
                  <div className="eyebrow">AUDIT TRAIL</div>
                  <h1>Activity logs</h1>
                  <p className="muted">
                    A chronological record of actions and team mentions
                    performed in the workspace.
                  </p>
                </div>
                <button
                  className="secondary"
                  onClick={() => downloadCsv(activities)}
                >
                  <Download size={15} /> Export CSV
                </button>
              </div>

              <div className="toolbar">
                <select
                  value={showLogsFilter}
                  onChange={(e) => setShowLogsFilter(e.target.value)}
                >
                  <option>All activity</option>
                  <option>Mention</option>
                  <option>Created</option>
                  <option>Updated</option>
                  <option>Status</option>
                  <option>Deleted</option>
                  <option>Completed</option>
                </select>
                <span className="muted small">
                  {activities.length} events in workspace
                </span>
              </div>

              <section className="surface log-list">
                {activities.filter(
                  (a) =>
                    showLogsFilter === "All activity" ||
                    a.type === showLogsFilter
                ).length === 0 ? (
                  <div className="empty-state">No activity logs yet.</div>
                ) : (
                  activities
                    .filter(
                      (a) =>
                        showLogsFilter === "All activity" ||
                        a.type === showLogsFilter
                    )
                    .map((a) => <ActivityRow key={a.id} item={a} detailed />)
                )}
              </section>

              <div className="note-box">
                <Clock3 size={18} />
                <div>
                  <b>Audit log design</b>
                  <p>
                    Logs are append-only in PostgreSQL (<code>activity_logs</code>
                    ) with company-scoped Row Level Security.
                  </p>
                </div>
              </div>
            </>
          )}

          {active === "Coupons & pricing" && (
            <PricingCouponsView
              role={role}
              pricing={pricing}
              coupons={coupons}
              onSavePricing={handleSavePricing}
              onCreateCoupon={handleCreateCoupon}
              onToggleCoupon={handleToggleCoupon}
              onDeleteCoupon={handleDeleteCoupon}
            />
          )}

          {active === "Administration" && role === "Admin" && (
            <>
              <div className="page-title-row">
                <div>
                  <div className="eyebrow">ADMIN CONTROL CENTRE</div>
                  <h1>Administration</h1>
                  <p className="muted">
                    Manage users, reset passwords, delete accounts, and
                    configure workspace security.
                  </p>
                </div>
                <button
                  className="primary"
                  onClick={() => setShowInvite(true)}
                >
                  <Plus size={16} /> Add user
                </button>
              </div>

              <section className="surface" style={{ marginBottom: 15 }}>
                <div className="section-head">
                  <div>
                    <h2>User management</h2>
                    <p>
                      Create workspace accounts, change user passwords, or
                      delete users.
                    </p>
                  </div>
                  <span className="soft-tag">{team.length} accounts</span>
                </div>

                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>USER</th>
                        <th>ROLE</th>
                        <th>STATUS</th>
                        <th>LAST ACTIVE</th>
                        <th>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {team.map((m) => {
                        const isSelf = m.id === currentUser.id;
                        return (
                          <tr key={m.id}>
                            <td>
                              <div className="member-cell">
                                <div className="avatar">
                                  {m.name
                                    .split(" ")
                                    .map((x) => x[0])
                                    .join("")
                                    .slice(0, 2)}
                                </div>
                                <div>
                                  <b>{m.name}</b>
                                  <small>{m.email}</small>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="role-pill">{m.role}</span>
                            </td>
                            <td>
                              <span className="status-live">
                                {m.active ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td>{m.lastActive}</td>
                            <td>
                              <div className="row-actions">
                                <button
                                  type="button"
                                  className="secondary compact-btn"
                                  onClick={() => {
                                    setPasswordModalUser(m);
                                    setUserNewPassword("");
                                    setUserConfirmPassword("");
                                  }}
                                >
                                  <KeyRound size={12} /> Change password
                                </button>
                                <button
                                  type="button"
                                  className="secondary compact-btn danger-text"
                                  disabled={isSelf || deletingUserId === m.id}
                                  title={
                                    isSelf
                                      ? "You cannot delete your active admin account"
                                      : `Delete ${m.name}`
                                  }
                                  onClick={() => void handleDeleteUser(m)}
                                >
                                  <Trash2 size={12} />{" "}
                                  {isSelf
                                    ? "Current account"
                                    : deletingUserId === m.id
                                    ? "Deleting..."
                                    : "Delete user"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="surface" style={{ marginBottom: 15 }}>
                <div className="section-head">
                  <div>
                    <h2>Change my administrator password</h2>
                    <p>
                      Update the password for your signed-in account (
                      {currentUser.email}).
                    </p>
                  </div>
                  <span className="soft-tag">Account security</span>
                </div>
                <form onSubmit={handleChangeOwnPassword}>
                  <div className="form-grid">
                    <label>
                      New password (min 6 characters)
                      <input
                        type="password"
                        value={ownNewPassword}
                        onChange={(e) => setOwnNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        minLength={6}
                        required
                      />
                    </label>
                    <label>
                      Confirm new password
                      <input
                        type="password"
                        value={ownConfirmPassword}
                        onChange={(e) => setOwnConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        minLength={6}
                        required
                      />
                    </label>
                  </div>
                  <div className="step-actions" style={{ marginTop: 14 }}>
                    <span className="small muted">
                      Takes effect immediately on your account.
                    </span>
                    <button
                      type="submit"
                      className="primary"
                      disabled={ownPasswordBusy}
                    >
                      <KeyRound size={14} />{" "}
                      {ownPasswordBusy
                        ? "Updating..."
                        : "Update my password"}
                    </button>
                  </div>
                </form>
              </section>

              <div className="admin-grid">
                <div className="surface admin-tile">
                  <SlidersHorizontal size={20} />
                  <h3>Editable pricing &amp; coupons</h3>
                  <p>
                    Edit Launch, Growth &amp; Scale pricing, page allowances,
                    additional page rates and promotional coupons.
                  </p>
                  <button
                    className="secondary"
                    onClick={() => setActive("Coupons & pricing")}
                  >
                    Open pricing <ArrowUpRight size={14} />
                  </button>
                </div>

                <div className="surface admin-tile">
                  <Activity size={20} />
                  <h3>Audit &amp; security</h3>
                  <p>
                    Review every create, edit, delete, tag/mention, status
                    change and admin action.
                  </p>
                  <button
                    className="secondary"
                    onClick={() => setActive("Activity logs")}
                  >
                    View audit trail <ArrowUpRight size={14} />
                  </button>
                </div>

                <div className="surface admin-tile">
                  <ShieldCheck size={20} />
                  <h3>Workspace team</h3>
                  <p>
                    Inspect assigned project counts and active roles across
                    CoreForge LLP.
                  </p>
                  <button
                    className="secondary"
                    onClick={() => setActive("Team")}
                  >
                    View team <ArrowUpRight size={14} />
                  </button>
                </div>
              </div>
            </>
          )}

          {active === "Help & documentation" && (
            <>
              <div className="page-title-row">
                <div>
                  <div className="eyebrow">WORKSPACE GUIDE</div>
                  <h1>Help &amp; documentation</h1>
                  <p className="muted">
                    How CoreForge handles client onboarding, 5-step requirement
                    collection, private drafts, pricing, and team notifications.
                  </p>
                </div>
              </div>
              <section className="surface doc-content">
                <h2>5-step requirement collection</h2>
                <ol>
                  <li>
                    <b>01 · Package:</b> select Launch, Growth or Scale and
                    answer the five mandatory business questions.
                  </li>
                  <li>
                    <b>02 · Pages &amp; pricing:</b> build the sitemap from 8
                    page categories, add custom pages, apply coupons (
                    <code>OFFPLUS2</code>, <code>OFF10</code>,{" "}
                    <code>OFF25</code>, <code>OFF50</code>), or customize quote
                    pricing (Admin).
                  </li>
                  <li>
                    <b>03 · Requirements:</b> capture all 11 specification
                    sections and package-specific conditional features.
                  </li>
                  <li>
                    <b>04 · Team &amp; assets:</b> assign responsibilities,
                    attach files, share Drive links, and tag teammates.
                  </li>
                  <li>
                    <b>05 · Review &amp; approval:</b> save incomplete progress
                    privately at any step with <b>Save draft</b> (hidden from
                    teammates until complete), or click{" "}
                    <b>Complete &amp; submit to team</b> once finished.
                  </li>
                </ol>
              </section>
            </>
          )}
        </div>
      </main>

      {/* New Requirement Modal */}
      {showNew && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowNew(false);
          }}
        >
          <div className="modal">
            <div className="modal-head">
              <div>
                <div className="eyebrow">NEW CLIENT RECORD</div>
                <h2>Create requirement</h2>
                <p>
                  Start a single requirement record and open the 5-step builder.
                </p>
              </div>
              <button
                className="icon-button"
                onClick={() => setShowNew(false)}
              >
                <X size={19} />
              </button>
            </div>
            <div className="form-grid">
              <label>
                Client contact name *
                <input
                  value={form.client}
                  onChange={(e) => setForm({ ...form, client: e.target.value })}
                  placeholder="Full name"
                />
              </label>
              <label>
                Company / client name *
                <input
                  value={form.company}
                  onChange={(e) =>
                    setForm({ ...form, company: e.target.value })
                  }
                  placeholder="Company name"
                />
              </label>
              <label>
                Client email
                <input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="name@company.com"
                />
              </label>
              <label>
                Package
                <select
                  value={form.package}
                  onChange={(e) =>
                    setForm({ ...form, package: e.target.value as PackageName })
                  }
                >
                  <option value="Launch">Launch</option>
                  <option value="Growth">Growth</option>
                  <option value="Scale">Scale</option>
                </select>
              </label>
            </div>
            <div className="modal-foot">
              <button
                className="secondary"
                onClick={() => setShowNew(false)}
              >
                Cancel
              </button>
              <button className="primary" onClick={createProject}>
                Create &amp; open builder <ArrowUpRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showInvite && role === "Admin" && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowInvite(false);
          }}
        >
          <div className="modal">
            <div className="modal-head">
              <div>
                <div className="eyebrow">USER PROVISIONING</div>
                <h2>Add workspace user</h2>
                <p>
                  Create a new user login with name, email, role, and initial
                  password.
                </p>
              </div>
              <button
                className="icon-button"
                onClick={() => setShowInvite(false)}
              >
                <X size={19} />
              </button>
            </div>
            <div className="form-grid">
              <label>
                Full name *
                <input
                  value={inviteForm.name}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, name: e.target.value })
                  }
                  placeholder="Full name"
                />
              </label>
              <label>
                Email address *
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, email: e.target.value })
                  }
                  placeholder="name@company.com"
                />
              </label>
              <label>
                Role
                <select
                  value={inviteForm.role}
                  onChange={(e) =>
                    setInviteForm({
                      ...inviteForm,
                      role: e.target.value as Role,
                    })
                  }
                >
                  <option value="Developer">Developer</option>
                  <option value="Admin">Admin</option>
                </select>
              </label>
              <label>
                Initial password * (min 6 chars)
                <input
                  type="password"
                  value={inviteForm.password}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, password: e.target.value })
                  }
                  placeholder="Minimum 6 characters"
                  minLength={6}
                />
              </label>
            </div>
            <div className="modal-foot">
              <button
                className="secondary"
                onClick={() => setShowInvite(false)}
              >
                Cancel
              </button>
              <button
                className="primary"
                disabled={inviteSubmitting}
                onClick={() => void handleInviteMember()}
              >
                {inviteSubmitting ? "Creating..." : "Create user"}{" "}
                <ArrowUpRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change User Password Modal */}
      {passwordModalUser && role === "Admin" && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPasswordModalUser(null);
          }}
        >
          <form className="modal" onSubmit={handleChangeUserPassword}>
            <div className="modal-head">
              <div>
                <div className="eyebrow">USER PASSWORD</div>
                <h2>Change password for {passwordModalUser.name}</h2>
                <p>{passwordModalUser.email}</p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setPasswordModalUser(null)}
              >
                <X size={19} />
              </button>
            </div>
            <div className="form-grid">
              <label>
                New password * (min 6 chars)
                <input
                  type="password"
                  value={userNewPassword}
                  onChange={(e) => setUserNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  minLength={6}
                  required
                />
              </label>
              <label>
                Confirm new password *
                <input
                  type="password"
                  value={userConfirmPassword}
                  onChange={(e) => setUserConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  minLength={6}
                  required
                />
              </label>
            </div>
            <div className="modal-foot">
              <button
                type="button"
                className="secondary"
                onClick={() => setPasswordModalUser(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary"
                disabled={userPasswordBusy}
              >
                <KeyRound size={14} />{" "}
                {userPasswordBusy ? "Updating..." : "Update password"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Project Quick Detail Modal */}
      {selected && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <div className="modal">
            <div className="modal-head">
              <div>
                <div className="eyebrow">
                  {selected.id}
                  {selected.requirement.isDraft ? " · PRIVATE DRAFT" : ""}
                </div>
                <h2>{selected.company}</h2>
                <p>
                  {selected.client} · {selected.package || "No"} package
                </p>
              </div>
              <button
                className="icon-button"
                onClick={() => setSelected(null)}
              >
                <X size={19} />
              </button>
            </div>

            <div className="detail-grid">
              <div>
                <small>PROJECT STAGE</small>
                <b>
                  {selected.requirement.isDraft
                    ? "Private draft"
                    : selected.stage}
                </b>
              </div>
              <div>
                <small>ASSIGNED DEVELOPER</small>
                <b>{selected.assignedTo}</b>
              </div>
              <div>
                <small>LAST UPDATED</small>
                <b>{selected.updated}</b>
              </div>
              <div>
                <small>COMPLETION</small>
                <b>{selected.progress}%</b>
              </div>
            </div>

            <div className="detail-actions">
              {!selected.requirement.isDraft && (
                <label>
                  Move stage
                  <select
                    value={selected.stage}
                    onChange={(e) =>
                      void moveProject(selected, e.target.value as Stage)
                    }
                  >
                    <option>Requirements</option>
                    <option>Building</option>
                    <option>Completed</option>
                  </select>
                </label>
              )}
              <button
                className="primary"
                onClick={() => openRequirementEditor(selected.id)}
              >
                {canEditProject(selected) ? (
                  <>
                    <Pencil size={14} /> Open 5-step requirement
                  </>
                ) : (
                  <>
                    <Eye size={14} /> View full detailed preview
                  </>
                )}
              </button>
              {(role === "Admin" ||
                (selected.requirement.isDraft &&
                  selected.ownerId === currentUser.id)) && (
                <button
                  className="danger-button"
                  onClick={() => deleteProject(selected)}
                >
                  <Trash2 size={14} />{" "}
                  {selected.requirement.isDraft ? "Discard draft" : "Delete"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Side-bottom Notification Toast (Success / Info / Incomplete-Question Error) */}
      {toast && (
        <div
          className={`toast toast-${toast.variant}`}
          role={toast.variant === "error" ? "alert" : "status"}
        >
          {toast.variant === "error" ? (
            <AlertCircle size={18} className="toast-icon" />
          ) : (
            <CheckCircle2 size={17} className="toast-icon" />
          )}
          <div className="toast-body">
            {toast.title && <b>{toast.title}</b>}
            <span>{toast.message}</span>
          </div>
          <button
            type="button"
            className="toast-close"
            aria-label="Close notification"
            onClick={() => setToast(null)}
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

function ProjectTable({
  projects,
  emptyText = "No projects match your search.",
  canEdit,
  onOpen,
  onEdit,
  onDelete,
  admin = false,
}: {
  projects: Project[];
  emptyText?: string;
  canEdit?: (p: Project) => boolean;
  onOpen: (p: Project) => void;
  onEdit: (p: Project) => void;
  onDelete?: (p: Project) => void;
  admin?: boolean;
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>PROJECT / CLIENT</th>
            <th>ASSIGNED</th>
            <th>PACKAGE</th>
            <th>STAGE</th>
            <th>UPDATED</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => {
            const editable = canEdit ? canEdit(p) : true;
            const canRemove = admin || (p.requirement.isDraft && editable);
            return (
              <tr key={p.id}>
                <td>
                  <button className="project-link" onClick={() => onEdit(p)}>
                    <b>
                      {p.company}{" "}
                      {p.requirement.isDraft && (
                        <span className="soft-tag" style={{ marginLeft: 6 }}>
                          Private draft
                        </span>
                      )}
                    </b>
                    <small>
                      {p.id} · {p.client}
                    </small>
                  </button>
                </td>
                <td>{p.assignedTo}</td>
                <td>{p.package || "—"}</td>
                <td>
                  <span className={`stage-pill ${p.stage.toLowerCase()}`}>
                    <i /> {p.requirement.isDraft ? "Draft" : p.stage}
                  </span>
                </td>
                <td>{p.updated}</td>
                <td>
                  <div className="row-actions">
                    <button
                      className="secondary compact-btn"
                      onClick={() => onEdit(p)}
                    >
                      {editable ? (
                        <>
                          <Pencil size={12} /> Open
                        </>
                      ) : (
                        <>
                          <Eye size={12} /> Preview
                        </>
                      )}
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Quick view"
                      onClick={() => onOpen(p)}
                    >
                      <Eye size={16} />
                    </button>
                    {canRemove && onDelete && (
                      <button
                        className="icon-button danger-text"
                        aria-label={
                          p.requirement.isDraft
                            ? "Discard draft"
                            : "Delete project"
                        }
                        onClick={() => onDelete(p)}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {projects.length === 0 && <div className="empty-state">{emptyText}</div>}
    </div>
  );
}

function ActivityRow({
  item,
  detailed = false,
}: {
  item: ActivityItem;
  detailed?: boolean;
}) {
  return (
    <div className={`activity-row ${detailed ? "detailed" : ""}`}>
      <div className="activity-avatar">
        {item.actor
          .split(" ")
          .map((x) => x[0])
          .join("")
          .slice(0, 2)}
      </div>
      <div className="activity-copy">
        <p>
          <b>{item.actor}</b> {item.action} <strong>{item.target}</strong>
        </p>
        <small>
          {item.time}
          {detailed ? ` · ${item.type}` : ""}
        </small>
      </div>
      <span className="activity-type">{item.type}</span>
    </div>
  );
}

function Workload({
  name,
  count,
  total,
}: {
  name: string;
  count: number;
  total: number;
}) {
  return (
    <div className="workload-item">
      <div>
        <b>{name}</b>
        <span>{count} active projects</span>
      </div>
      <div className="workload-track">
        <i style={{ width: `${Math.min(100, (count / total) * 100)}%` }} />
      </div>
    </div>
  );
}

function downloadCsv(rows: ActivityItem[]) {
  const csv = [
    "id,actor,action,target,time,type",
    ...rows.map((r) =>
      [r.id, r.actor, r.action, r.target, r.time, r.type]
        .map((v) => `"${String(v).replaceAll('"', '""')}"`)
        .join(",")
    ),
  ].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "coreforge-activity-logs.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}
