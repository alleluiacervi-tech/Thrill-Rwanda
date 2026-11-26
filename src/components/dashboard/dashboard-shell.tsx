import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { SidebarLayout } from "@/components/dashboard/sidebar-nav";
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs";
import type { NavGroup, NavItem } from "@/components/dashboard/nav-types";
import { WorkspaceSwitch, type Workspace } from "@/components/dashboard/workspace-switch";
import { Badge, Container } from "@/components/ui/primitives";
import { FlashNotice } from "@/components/dashboard/flash";

export type { NavItem, NavGroup };

export type Notifications = { href: string; unread: number };

/** The header bar every dashboard shares, whichever nav shape it uses. */
function TopBar({
  role,
  roleLabel,
  userName,
  notifications,
  workspaces,
  children,
}: {
  role: string;
  roleLabel: string;
  userName: string;
  notifications?: Notifications;
  workspaces?: Workspace[];
  children?: React.ReactNode;
}) {
  return (
    <header className="border-b border-[var(--line)] bg-[var(--paper-raised)]">
      <Container wide className="flex h-16 items-center justify-between gap-4">
        <Link href="/" className="text-forest-800" aria-label="Home">
          <Logo className="h-10" />
        </Link>

        <div className="flex items-center gap-3">
          {workspaces ? <WorkspaceSwitch workspaces={workspaces} className="hidden sm:flex" /> : null}
          {notifications ? <NotificationBell href={notifications.href} unread={notifications.unread} /> : null}
          <Badge tone={role === "ADMIN" ? "sun" : "forest"}>{roleLabel}</Badge>
          <span className="hidden text-sm text-[var(--ink-muted)] sm:block">
            {userName}
          </span>
          <SignOutButton />
        </div>
      </Container>
      {children}
    </header>
  );
}

// Dashboard chrome. `nav` gives a tab row (fine to ~6 sections), `groups`
// gives the sidebar. Each layout passes its own items; this decides nothing.
export function DashboardShell({
  nav,
  groups,
  role,
  userName,
  notifications,
  workspaces,
  children,
}: {
  nav?: NavItem[];
  groups?: NavGroup[];
  role: string;
  userName: string;
  /** Renders the header bell. Omit to hide it. */
  notifications?: Notifications;
  /** The other dashboards this person may open. Fewer than two renders nothing. */
  workspaces?: Workspace[];
  children: React.ReactNode;
}) {
  const roleLabel =
    role === "ADMIN" ? "Admin" : role === "PROVIDER" ? "Provider" : ["SALES", "OPERATIONS", "FINANCE"].includes(role) ? role.toLowerCase() : "Customer";

  if (groups) {
    return (
      <SidebarLayout
        groups={groups}
        user={{ name: userName, role: roleLabel }}
        notifications={notifications}
        workspaces={workspaces}
      >
        {children}
        <FlashNotice />
      </SidebarLayout>
    );
  }

  return (
    <div className="dash-surface flex min-h-svh flex-col bg-[var(--paper)]">
      <TopBar
        role={role}
        roleLabel={roleLabel}
        userName={userName}
        notifications={notifications}
        workspaces={workspaces}
      >
        <Container wide>
          <DashboardTabs nav={nav ?? []} label={`${roleLabel} sections`} />
          {workspaces ? (
            <WorkspaceSwitch workspaces={workspaces} className="mb-3 w-fit sm:hidden" />
          ) : null}
        </Container>
      </TopBar>

      <main id="main" className="flex-1">
        <Container wide className="py-10">
          {children}
        </Container>
      </main>
      <FlashNotice />
    </div>
  );
}

/** Shared page heading inside a dashboard. */
export function DashboardHead({
  title,
  lede,
  action,
  back,
}: {
  title: string;
  lede?: string;
  action?: React.ReactNode;
  /** Renders inside the band — a back link above it would push the band off the header. */
  back?: { href: string; label: string };
}) {
  return (
    <div
      data-dash-head
      className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <div className="min-w-0">
        {back ? (
          <Link
            href={back.href}
            className="mb-3 inline-flex items-center gap-2 text-sm text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
          >
            <ArrowLeft className="size-4" />
            {back.label}
          </Link>
        ) : null}
        <h1 className="text-3xl">{title}</h1>
        {lede ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--ink-muted)]">
            {lede}
          </p>
        ) : null}
      </div>
      {/* shrink-0: the lede wraps before the actions do, rather than the
          buttons breaking onto their own row. */}
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Consistent empty state — these dashboards are mostly empty pre-launch. */
export function EmptyPanel({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      data-empty-panel
      className="rounded-[var(--radius-card)] border border-dashed border-[var(--line-strong)] px-8 py-16 text-center"
    >
      <p className="font-display text-5xl text-clay-300">—</p>
      <h2 className="mt-5 text-xl">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[var(--ink-muted)]">
        {body}
      </p>
      {action ? <div className="mt-7">{action}</div> : null}
    </div>
  );
}
