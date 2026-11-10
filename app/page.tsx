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
  deleteCouponInDb,
  deleteProjectInDb,
  fetchWorkspaceSnapshot,
  insertCommentAndNotificationsInDb,
  insertNotificationsInDb,
  markAllNotificationsReadInDb,
  markNotificationReadInDb,
  savePricingInDb,
  saveRequirementInDb,
  toggleCouponInDb,
  updateStageInDb,
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

  const [currentUserId, setCurrentUserId] = useState<string>("usr-admin");
  const [roleOverride, setRoleOverride] = useState<Role | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginEmail, setLoginEmail] = useState("admin@coreforgeindia.com");
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
  });

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

  // Hydrate either from Supabase or clean localStorage
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      const savedProjects = readStorage(STORAGE_KEYS.projects, INITIAL_PROJECTS);
      setProjects(savedProjects);
      setPricing(readStorage(STORAGE_KEYS.pricing, DEFAULT_PRICING));
      setCoupons(readStorage(STORAGE_KEYS.coupons, DEFAULT_COUPONS));
      setTeam(readStorage(STORAGE_KEYS.team, INITIAL_TEAM));
      setActivities(readStorage(STORAGE_KEYS.activities, INITIAL_ACTIVITIES));
      setNotifications(
        readStorage(STORAGE_KEYS.notifications, INITIAL_NOTIFICATIONS)
      );
      setSoundEnabled(readStorage(STORAGE_KEYS.sound, true));
      const savedSessionUser = readStorage<string>(STORAGE_KEYS.sessionUser, "");
      if (savedSessionUser) {
        setCurrentUserId(savedSessionUser);
        setLoggedIn(true);
      }
      if (savedProjects[0]) {
        setActiveProjectId(savedProjects[0].id);
      }
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

  // Persist local preview state when Supabase is not configured
  useEffect(() => {
    if (!hydrated || supabaseEnabled) return;
    window.localStorage.setItem(
      STORAGE_KEYS.projects,
      JSON.stringify(projects)
    );
  }, [hydrated, supabaseEnabled, projects]);

  useEffect(() => {
    if (!hydrated || supabaseEnabled) return;
    window.localStorage.setItem(STORAGE_KEYS.pricing, JSON.stringify(pricing));
  }, [hydrated, supabaseEnabled, pricing]);

  useEffect(() => {
    if (!hydrated || supabaseEnabled) return;
    window.localStorage.setItem(STORAGE_KEYS.coupons, JSON.stringify(coupons));
  }, [hydrated, supabaseEnabled, coupons]);

  useEffect(() => {
    if (!hydrated || supabaseEnabled) return;
    window.localStorage.setItem(STORAGE_KEYS.team, JSON.stringify(team));
  }, [hydrated, supabaseEnabled, team]);

  useEffect(() => {
    if (!hydrated || supabaseEnabled) return;
    window.localStorage.setItem(
      STORAGE_KEYS.activities,
      JSON.stringify(activities)
    );
  }, [hydrated, supabaseEnabled, activities]);

  useEffect(() => {
    if (!hydrated || supabaseEnabled) return;
    window.localStorage.setItem(
      STORAGE_KEYS.notifications,
      JSON.stringify(notifications)
    );
  }, [hydrated, supabaseEnabled, notifications]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      STORAGE_KEYS.sound,
      JSON.stringify(soundEnabled)
    );
  }, [hydrated, soundEnabled]);

  useEffect(() => {
    if (!hydrated || supabaseEnabled) return;
    window.localStorage.setItem(
      STORAGE_KEYS.sessionUser,
      JSON.stringify(loggedIn ? currentUserId : "")
    );
  }, [hydrated, supabaseEnabled, loggedIn, currentUserId]);

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

  // Realtime listener in Supabase mode OR cross-tab storage listener in local mode
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (supabase && loggedIn && companyId) {
      const refreshQuietly = async () => {
        try {
          const snap = await fetchWorkspaceSnapshot(supabase, currentUserId);
          setProjects(snap.projects);
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

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.notifications && e.newValue) {
        try {
          const next = JSON.parse(e.newValue) as PortalNotification[];
          setNotifications(next);
          const newest = next[0];
          if (newest && newest.recipientId === currentUserId && !newest.read) {
            playNotificationSound("mention", soundEnabled);
            notify(newest.message, "info", newest.title);
          }
        } catch {
          // Ignore malformed storage updates
        }
      }
      if (e.key === STORAGE_KEYS.projects && e.newValue) {
        try {
          setProjects(JSON.parse(e.newValue) as Project[]);
        } catch {
          // Ignore
        }
      }
      if (e.key === STORAGE_KEYS.pricing && e.newValue) {
        try {
          setPricing(JSON.parse(e.newValue) as PricingSettings);
        } catch {
          // Ignore
        }
      }
      if (e.key === STORAGE_KEYS.coupons && e.newValue) {
        try {
          setCoupons(JSON.parse(e.newValue) as Coupon[]);
        } catch {
          // Ignore
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [companyId, currentUserId, loggedIn, notify, soundEnabled, team]);

  const currentUser = useMemo(
    () => team.find((m) => m.id === currentUserId) ?? team[0] ?? INITIAL_TEAM[0],
    [team, currentUserId]
  );

  const role: Role = roleOverride ?? currentUser.role;

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
      projects.filter(
        (p) =>
          (stageFilter === "All stages" || p.stage === stageFilter) &&
          `${p.id} ${p.client} ${p.company} ${p.owner} ${p.assignedTo}`
            .toLowerCase()
            .includes(search.toLowerCase())
      ),
    [projects, search, stageFilter]
  );

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? projects[0] ?? null,
    [projects, activeProjectId]
  );

  const openRequirementEditor = (
    projectId: string,
    step: RequirementStep = "overview"
  ) => {
    setActiveProjectId(projectId);
    setRequirementStep(step);
    setActive("Requirement Editor");
    setSelected(null);
  };

  const updateProject = useCallback(
    (
      projectId: string,
      updater: (prev: Project) => Project,
      activitySummary?: { action: string; type: string }
    ) => {
      let targetCompany = "";
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== projectId) return p;
          const next = updater(p);
          targetCompany = next.company;
          return next;
        })
      );
      if (activitySummary && targetCompany) {
        log(activitySummary.action, targetCompany, activitySummary.type);
      }
    },
    [log]
  );

  const handleSaveProject = useCallback(
    async (projectToSave: Project, quiet = false) => {
      setProjects((prev) =>
        prev.map((p) => (p.id === projectToSave.id ? projectToSave : p))
      );
      if (!quiet) {
        log("saved requirement for", projectToSave.company, "Updated");
      }

      const supabase = getSupabaseBrowserClient();
      if (supabase && companyId) {
        try {
          await saveRequirementInDb(
            supabase,
            companyId,
            currentUser.id,
            projectToSave,
            pricing,
            coupons
          );
          if (!quiet) {
            await appendActivityInDb(
              supabase,
              companyId,
              currentUser.id,
              "requirement_updated",
              "requirement",
              projectToSave.company,
              "saved requirement for"
            );
          }
        } catch (err) {
          notify(
            err instanceof Error ? err.message : "Failed to save to Supabase.",
            "error",
            "Save error"
          );
          return;
        }
      }

      if (!quiet) {
        playNotificationSound("success", soundEnabled);
        notify(
          `Saved ${projectToSave.company} (${projectToSave.id}).`,
          "success"
        );
      }
    },
    [companyId, coupons, currentUser.id, log, notify, pricing, soundEnabled]
  );

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

      updateProject(project.id, (prev) => {
        const mergedTagged = Array.from(
          new Set([...prev.requirement.taggedMemberIds, ...uniqueIds])
        );
        return {
          ...prev,
          updated: "Just now",
          requirement: {
            ...prev.requirement,
            taggedMemberIds: mergedTagged,
            comments: newComment
              ? [newComment, ...prev.requirement.comments]
              : prev.requirement.comments,
            lastSavedAt: `Today, ${nowTime}`,
          },
        };
      });

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
      updateProject,
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

  const createProject = async () => {
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
      updated: "Just now",
      package: form.package,
      progress: 25,
      requirement: createEmptyRequirement({
        packageSelected: form.package,
        companyName: form.company.trim(),
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

    const supabase = getSupabaseBrowserClient();
    if (supabase && companyId) {
      try {
        const ids = await createClientRequirementInDb(
          supabase,
          companyId,
          currentUser.id,
          newProj,
          pricing
        );
        newProj.dbClientId = ids.dbClientId;
        newProj.dbRequirementId = ids.dbRequirementId;
      } catch (err) {
        notify(
          err instanceof Error
            ? err.message
            : "Failed to create requirement in Supabase.",
          "error",
          "Database error"
        );
        return;
      }
    }

    setProjects((prev) => [newProj, ...prev]);
    log("created a requirement for", newProj.company, "Created");
    setForm({ client: "", company: "", package: "Launch", email: "" });
    setShowNew(false);
    openRequirementEditor(newProj.id, "package");
    notify("Requirement created. Complete steps 01–05.", "success");
  };

  const deleteProject = async (p: Project) => {
    if (role !== "Admin") {
      notify("Only admins can delete projects.", "error", "Permission required");
      return;
    }
    if (!confirm(`Delete ${p.company}? This action cannot be undone.`)) return;

    const supabase = getSupabaseBrowserClient();
    if (supabase && companyId) {
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
    log("deleted requirement for", p.company, "Deleted");
    setSelected(null);
    if (active === "Requirement Editor" && activeProjectId === p.id) {
      setActive("Requirements");
    }
    notify("Project deleted.", "info");
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

  const handleInviteMember = () => {
    if (!inviteForm.name.trim() || !inviteForm.email.trim()) {
      notify("Name and email are required.", "error", "Incomplete fields");
      return;
    }
    if (supabaseEnabled) {
      notify(
        "Create additional Supabase Auth users via Supabase Dashboard or an Admin Edge Function.",
        "info",
        "Supabase Auth"
      );
      setShowInvite(false);
      return;
    }
    const created: TeamMember = {
      id: `usr-${Date.now()}`,
      name: inviteForm.name.trim(),
      email: inviteForm.email.trim(),
      role: inviteForm.role,
      active: true,
      lastActive: "Invited just now",
    };
    setTeam((prev) => [...prev, created]);
    log(`invited team member ${created.name}`, "Workspace Team", "Created");
    setInviteForm({ name: "", email: "", role: "Developer" });
    setShowInvite(false);
    playNotificationSound("success", soundEnabled);
    notify(
      `${created.name} added and ready to be @tagged in requirements.`,
      "success"
    );
  };

  const switchActiveMember = (member: TeamMember) => {
    if (supabaseEnabled) {
      notify(
        "In Supabase mode, sign out and sign in with the user's account.",
        "info"
      );
      setShowProfile(false);
      setShowTopProfile(false);
      return;
    }
    setCurrentUserId(member.id);
    setRoleOverride(null);
    setShowProfile(false);
    setShowTopProfile(false);
    const unread = notifications.filter(
      (n) => n.recipientId === member.id && !n.read
    ).length;
    if (unread > 0) {
      playNotificationSound("mention", soundEnabled);
      notify(
        `Switched to ${member.name} · ${unread} unread notification(s).`,
        "info"
      );
    } else {
      notify(`Switched workspace user to ${member.name} (${member.role}).`, "info");
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
    if (supabase) {
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
      return;
    }

    // Local preview sign-in before Supabase env keys are configured
    const matched = team.find((m) => m.email.toLowerCase() === email);
    if (!matched) {
      setLoginError(
        "Unrecognized workspace user. Use admin@coreforgeindia.com or gagan@coreforgeindia.com."
      );
      playNotificationSound("alert", soundEnabled);
      return;
    }
    setCurrentUserId(matched.id);
    setRoleOverride(null);
    setLoggedIn(true);
    notify(`Signed in as ${matched.name} (${matched.role}).`, "success");
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
          <div className="eyebrow">
            {supabaseEnabled ? "SUPABASE LIVE AUTH" : "FRESH WORKSPACE PREVIEW"}
          </div>
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
              placeholder="admin@coreforgeindia.com"
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

          {!supabaseEnabled && (
            <div className="login-quick-switch">
              <small className="muted">Quick fill user:</small>
              <div className="row-actions" style={{ justifyContent: "center" }}>
                <button
                  type="button"
                  className="secondary compact-btn"
                  onClick={() => setLoginEmail("admin@coreforgeindia.com")}
                >
                  Admin
                </button>
                <button
                  type="button"
                  className="secondary compact-btn"
                  onClick={() => setLoginEmail("gagan@coreforgeindia.com")}
                >
                  Gagan
                </button>
              </div>
              <small>
                Local preview mode · Paste Supabase URL &amp; anon key in{" "}
                <code>.env.local</code> to switch to live DB.
              </small>
            </div>
          )}
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
      value: projects.length,
      sub: "Active workspace clients",
      icon: BriefcaseBusiness,
    },
    {
      label: "Requirements",
      value: projects.filter((p) => p.stage === "Requirements").length,
      sub: "Awaiting scope confirmation",
      icon: ClipboardList,
    },
    {
      label: "Building",
      value: projects.filter((p) => p.stage === "Building").length,
      sub: "Currently in development",
      icon: FolderKanban,
    },
    {
      label: "Completed",
      value: projects.filter((p) => p.stage === "Completed").length,
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
          <span className="workspace-tag">
            {supabaseEnabled ? "LIVE DB" : "WORKSPACE"}
          </span>
        </div>

        <div className="company-switch">
          <div className="company-icon">C</div>
          <div>
            <b>CoreForge LLP</b>
            <small>
              {supabaseEnabled ? "Supabase connected" : "Fresh workspace"}
            </small>
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
                {!supabaseEnabled && (
                  <>
                    <div className="profile-pop-label">
                      SWITCH USER (TEST TAGS)
                    </div>
                    {team.map((m) => (
                      <button
                        key={m.id}
                        className={
                          m.id === currentUser.id ? "active-user-row" : ""
                        }
                        onClick={() => switchActiveMember(m)}
                      >
                        {m.name} ({m.role})
                      </button>
                    ))}
                    <div className="profile-pop-divider" />
                  </>
                )}
                <button
                  onClick={() => {
                    setRoleOverride(role === "Admin" ? "Developer" : "Admin");
                    setShowProfile(false);
                  }}
                >
                  Preview as {role === "Admin" ? "Developer" : "Admin"}
                </button>
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
              onTestSound={() => {
                playNotificationSound("mention", true);
                notify("Played notification chime sound.", "info");
              }}
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
                    ACTIVE USER · {currentUser.name}
                  </div>
                  {!supabaseEnabled &&
                    team.map((m) => (
                      <button
                        key={m.id}
                        className={
                          m.id === currentUser.id ? "active-user-row" : ""
                        }
                        onClick={() => switchActiveMember(m)}
                      >
                        {m.name} ({m.role})
                      </button>
                    ))}
                  <div className="profile-pop-divider" />
                  <button
                    onClick={() => {
                      setRoleOverride(role === "Admin" ? "Developer" : "Admin");
                      setShowTopProfile(false);
                    }}
                  >
                    Preview as {role === "Admin" ? "Developer" : "Admin"}
                  </button>
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
                    onOpen={(p) => setSelected(p)}
                    onEdit={(p) => openRequirementEditor(p.id, "package")}
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
                    Manage team <ArrowUpRight size={14} />
                  </button>
                </div>
                <div className="workload">
                  {team.map((member) => {
                    const count = projects.filter(
                      (p) =>
                        p.assignedToId === member.id || p.ownerId === member.id
                    ).length;
                    return (
                      <Workload
                        key={member.id}
                        name={member.name}
                        count={count}
                        total={Math.max(1, projects.length)}
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
                  onOpen={(p) => setSelected(p)}
                  onEdit={(p) => openRequirementEditor(p.id, "package")}
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
              projects={projects}
              step={requirementStep}
              role={role}
              currentUser={currentUser}
              team={team}
              pricing={pricing}
              coupons={coupons}
              onChangeStep={setRequirementStep}
              onSelectProject={(id) => openRequirementEditor(id, requirementStep)}
              onBackToList={() => setActive("Requirements")}
              onUpdateProject={updateProject}
              onMoveStage={moveProject}
              onTagMembers={handleTagMembers}
              onOpenGlobalPricing={() => setActive("Coupons & pricing")}
              onSaveProject={handleSaveProject}
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
                    Drag and drop project cards between Requirements, Building,
                    and Completed.
                  </p>
                </div>
                <button className="primary" onClick={() => setShowNew(true)}>
                  <Plus size={16} /> New requirement
                </button>
              </div>

              <div className="kanban">
                {STAGES.map((stage) => {
                  const stageProjects = projects.filter(
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
                        const targetProj = projects.find(
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
                        stageProjects.map((p) => (
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
                                onClick={() =>
                                  openRequirementEditor(p.id, "overview")
                                }
                                title="Open requirement workspace"
                              >
                                <Pencil size={14} />
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
                        ))
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
                    CoreForge workspace users. Tagged members receive
                    notifications with sound.
                  </p>
                </div>
                {role === "Admin" && (
                  <button
                    className="primary"
                    onClick={() => setShowInvite(true)}
                  >
                    <Plus size={16} /> Invite member
                  </button>
                )}
              </div>

              <section className="surface">
                <div className="section-head">
                  <div>
                    <h2>Workspace members</h2>
                    <p>
                      Only admins can create accounts and reset passwords.
                    </p>
                  </div>
                  <span className="soft-tag">2 roles · Admin / Developer</span>
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
                        {!supabaseEnabled && <th>SWITCH USER</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {team.map((m) => {
                        const count = projects.filter(
                          (p) => p.assignedToId === m.id || p.ownerId === m.id
                        ).length;
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
                            <td>{count} projects</td>
                            <td>{m.lastActive}</td>
                            <td>
                              <span className="status-live">
                                {m.active ? "Active" : "Inactive"}
                              </span>
                            </td>
                            {!supabaseEnabled && (
                              <td>
                                <button
                                  className="secondary compact-btn"
                                  disabled={isSelf}
                                  onClick={() => switchActiveMember(m)}
                                >
                                  {isSelf ? "Current user" : "Switch to user"}
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="note-box">
                <ShieldCheck size={18} />
                <div>
                  <b>Workspace accounts</b>
                  <p>
                    Configured for Admin (<code>admin@coreforgeindia.com</code>)
                    and Gagan (<code>gagan@coreforgeindia.com</code>). Add more
                    users via Supabase Auth Admin APIs or Dashboard.
                  </p>
                </div>
              </div>
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

          {active === "Administration" && (
            <>
              <div className="page-title-row">
                <div>
                  <div className="eyebrow">ADMIN CONTROL CENTRE</div>
                  <h1>Administration</h1>
                  <p className="muted">
                    Company-level controls for users, permissions and workspace
                    configuration.
                  </p>
                </div>
                <span className="soft-tag">Admin access</span>
              </div>

              <div className="admin-grid">
                <div className="surface admin-tile">
                  <ShieldCheck size={20} />
                  <h3>User management</h3>
                  <p>
                    Manage Admin (<code>admin@coreforgeindia.com</code>) and
                    Gagan (<code>gagan@coreforgeindia.com</code>).
                  </p>
                  <button
                    className="secondary"
                    onClick={() => setActive("Team")}
                  >
                    Manage users <ArrowUpRight size={14} />
                  </button>
                </div>

                <div className="surface admin-tile">
                  <SlidersHorizontal size={20} />
                  <h3>Editable pricing &amp; coupons</h3>
                  <p>
                    Edit Launch, Growth &amp; Scale pricing, page allowances,
                    additional page rates and 10%/25%/50% coupons.
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
              </div>

              <div className="note-box">
                <ShieldCheck size={18} />
                <div>
                  <b>Supabase connection status</b>
                  <p>
                    {supabaseEnabled
                      ? "Connected to Supabase Auth, PostgreSQL & Realtime."
                      : "Paste NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local and run supabase/schema.sql in Supabase SQL Editor."}
                  </p>
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
                    collection, pricing, and team notifications.
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
                    sections, package-specific conditional features, and tag
                    teammates with <code>@Name</code>.
                  </li>
                  <li>
                    <b>04 · Team &amp; assets:</b> assign responsibilities,
                    upload brand assets, share Drive links, and notify tagged
                    members.
                  </li>
                  <li>
                    <b>05 · Review &amp; approval:</b> save drafts anytime,
                    export JSON, print, print as PDF, or generate the approved
                    document.
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

      {/* Invite Member Modal */}
      {showInvite && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowInvite(false);
          }}
        >
          <div className="modal">
            <div className="modal-head">
              <div>
                <div className="eyebrow">TEAM PROVISIONING</div>
                <h2>Add workspace member</h2>
                <p>
                  New members appear immediately in @mention autocomplete and
                  task assignment.
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
                  placeholder="e.g. Rohan K."
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
                  placeholder="name@coreforgeindia.com"
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
            </div>
            <div className="modal-foot">
              <button
                className="secondary"
                onClick={() => setShowInvite(false)}
              >
                Cancel
              </button>
              <button className="primary" onClick={handleInviteMember}>
                Add member <ArrowUpRight size={15} />
              </button>
            </div>
          </div>
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
                <div className="eyebrow">{selected.id}</div>
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
                <b>{selected.stage}</b>
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
              <button
                className="primary"
                onClick={() => openRequirementEditor(selected.id, "package")}
              >
                <Pencil size={14} /> Open 5-step requirement
              </button>
              {role === "Admin" && (
                <button
                  className="danger-button"
                  onClick={() => deleteProject(selected)}
                >
                  <Trash2 size={14} /> Delete
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
  onOpen,
  onEdit,
  onDelete,
  admin = false,
}: {
  projects: Project[];
  emptyText?: string;
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
          {projects.map((p) => (
            <tr key={p.id}>
              <td>
                <button className="project-link" onClick={() => onEdit(p)}>
                  <b>{p.company}</b>
                  <small>
                    {p.id} · {p.client}
                  </small>
                </button>
              </td>
              <td>{p.assignedTo}</td>
              <td>{p.package || "—"}</td>
              <td>
                <span className={`stage-pill ${p.stage.toLowerCase()}`}>
                  <i /> {p.stage}
                </span>
              </td>
              <td>{p.updated}</td>
              <td>
                <div className="row-actions">
                  <button
                    className="secondary compact-btn"
                    onClick={() => onEdit(p)}
                  >
                    <Pencil size={12} /> Open
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Quick view"
                    onClick={() => onOpen(p)}
                  >
                    <Eye size={16} />
                  </button>
                  {admin && onDelete && (
                    <button
                      className="icon-button danger-text"
                      aria-label="Delete project"
                      onClick={() => onDelete(p)}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
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
