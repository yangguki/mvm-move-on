"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, clearToken, getToken } from "@/lib/api";
import {
  Bell,
  ChevronRight,
  ChevronsUpDown,
  Clapperboard,
  LayoutGrid,
  ListVideo,
  Menu,
  Monitor,
  Palette,
  Search,
  Settings,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/logo";

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  meta?: string;
  alert?: boolean;
};

type NavEntry = { label: string } | NavLink;

function nav(counts: { offline: number; stores: number; programs: number }): NavEntry[] {
  return [
    { href: "/", label: "대시보드", icon: LayoutGrid },
    { label: "운영" },
    { href: "/devices", label: "TV · 기기", icon: Monitor, meta: String(counts.offline), alert: counts.offline > 0 },
    { href: "/stores", label: "지점", icon: Store, meta: String(counts.stores) },
    { label: "콘텐츠" },
    { href: "/programs", label: "프로그램", icon: ListVideo, meta: String(counts.programs) },
    { href: "/videos", label: "운동 영상", icon: Clapperboard },
    { href: "/skins", label: "스킨", icon: Palette },
    { label: "설정" },
    { href: "/accounts", label: "계정 · 권한", icon: Users },
  ];
}

const RAIL: Array<NavLink | "sep"> = [
  { href: "/", label: "대시보드", icon: LayoutGrid },
  { href: "/devices", label: "TV · 기기", icon: Monitor },
  { href: "/stores", label: "지점", icon: Store },
  "sep",
  { href: "/programs", label: "프로그램", icon: ListVideo },
  { href: "/videos", label: "운동 영상", icon: Clapperboard },
  { href: "/skins", label: "스킨", icon: Palette },
  "sep",
  { href: "/accounts", label: "계정 · 권한", icon: Users },
];

function tabs(offline: number): Array<NavLink & { badge?: string }> {
  return [
    { href: "/", label: "홈", icon: LayoutGrid },
    { href: "/devices", label: "TV", icon: Monitor, badge: offline ? String(offline) : undefined },
    { href: "/programs", label: "프로그램", icon: ListVideo },
    { href: "/skins", label: "스킨", icon: Palette },
    { href: "/stores", label: "더보기", icon: Menu },
  ];
}

function isLink(entry: NavEntry): entry is NavLink {
  return "href" in entry;
}

function isOn(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("양인국");
  const [role, setRole] = useState("본사 관리자");
  const [counts, setCounts] = useState({ offline: 0, stores: 0, programs: 0 });
  const NAV = nav(counts);
  const current = NAV.find((entry) => isLink(entry) && isOn(pathname, entry.href));
  const currentLabel = current && isLink(current) ? current.label : "관리자";
  const skinCrumb = pathname === "/skins";

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setReady(true);
    void api<{ displayName: string | null; role: string }>("/admin/v1/me").then((me) => {
      if (me.displayName) setName(me.displayName);
      setRole(me.role === "store_admin" ? "지점 관리자" : "본사 관리자");
    });
    void Promise.all([
      api<{ summary: { offline: number } }>("/admin/v1/devices"),
      api<{ summary: { storeCount: number } }>("/admin/v1/stores"),
      api<{ items: unknown[] }>("/admin/v1/programs"),
    ]).then(([devices, stores, programs]) => {
      setCounts({ offline: devices.summary.offline, stores: stores.summary.storeCount, programs: programs.items.length });
    });
  }, [router, pathname]);

  async function logout() {
    await api("/admin/v1/auth/logout", { method: "POST" }).catch(() => undefined);
    clearToken();
    router.replace("/login");
  }

  if (!ready) return null;

  if (pathname === "/programs" || pathname.startsWith("/programs/")) {
    return (
      <div className="app rail">
        <nav className="rail-nav" aria-label="주요 메뉴">
          <Link href="/" className="rail-logo" aria-label="MOVE ON 홈">
            <Logo variant="icon" height={32} radius={8} />
          </Link>
          {RAIL.map((entry, index) => {
            if (entry === "sep") return <span key={`sep-${index}`} className="sep" />;
            const Icon = entry.icon;
            const on = isOn(pathname, entry.href);
            return (
              <Link key={entry.href} href={entry.href} className={on ? "on" : undefined} aria-label={entry.label} aria-current={on ? "page" : undefined}>
                <Icon className="i i-lg" aria-hidden />
              </Link>
            );
          })}
          <div className="avatar" title={name}>
            {name.slice(0, 1)}
          </div>
        </nav>
        <div className="main">{children}</div>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="side">
        <div className="side-brand">
          <Logo variant="icon" />
          <Logo variant="wordmark" height={15} />
        </div>
        <div className="store-switch">
          <div className="mark">HQ</div>
          <div className="grow">
            <b>MVM 본사</b>
            <small>전체 지점 · {counts.stores}곳</small>
          </div>
          <ChevronsUpDown className="i i-sm subtle" aria-hidden />
        </div>
        {NAV.map((entry) => {
          if (!isLink(entry)) {
            return (
              <div key={entry.label} className="nav-label">
                {entry.label}
              </div>
            );
          }
          const Icon = entry.icon;
          const on = isOn(pathname, entry.href);
          return (
            <Link key={entry.href} href={entry.href} className={on ? "nav-item on" : "nav-item"} aria-current={on ? "page" : undefined}>
              <Icon className="i" aria-hidden />
              {entry.label}
              {entry.meta ? <span className={entry.alert ? "meta alert" : "meta"}>{entry.meta}</span> : null}
            </Link>
          );
        })}
        <div className="side-foot">
          <div className="avatar">{name.slice(0, 1)}</div>
          <div className="grow">
            <b>{name}</b>
            <small>{role}</small>
          </div>
          <button type="button" className="icon-btn" aria-label="로그아웃" onClick={() => void logout()}>
            <Settings className="i" aria-hidden />
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="mbar">
          <Logo variant="icon" />
          <Logo variant="wordmark" height={14} />
          <div className="row" style={{ marginLeft: "auto", gap: 4 }}>
            <button type="button" className="icon-btn" aria-label="검색">
              <Search className="i i-lg" aria-hidden />
            </button>
            <button type="button" className="icon-btn" aria-label="알림">
              <Bell className="i i-lg" aria-hidden />
            </button>
          </div>
        </header>
        <header className="topbar">
          <div className="crumbs">
            <span>MVM 본사</span>
            <ChevronRight className="i" aria-hidden />
            {skinCrumb ? <span>스킨</span> : <b>{currentLabel}</b>}
            {skinCrumb ? (
              <>
                <ChevronRight className="i" aria-hidden />
                <b>네온 아케이드</b>
              </>
            ) : null}
          </div>
          <div className="search">
            <Search className="i i-sm" aria-hidden />
            지점, TV, 프로그램 검색
            <span className="kbd">⌘K</span>
          </div>
          <button type="button" className="icon-btn" aria-label="알림">
            <Bell className="i" aria-hidden />
          </button>
        </header>
        <div className="content">{children}</div>
      </div>
      <nav className="tabbar" aria-label="모바일 메뉴">
        {tabs(counts.offline).map((tab) => {
          const Icon = tab.icon;
          const on = tab.href === "/stores" ? ["/stores", "/videos", "/accounts"].some((href) => isOn(pathname, href)) : isOn(pathname, tab.href);
          return (
            <Link key={tab.label} href={tab.href} className={on ? "on" : undefined} aria-current={on ? "page" : undefined}>
              <Icon className="i" aria-hidden />
              {tab.label}
              {tab.badge ? <span className="bd">{tab.badge}</span> : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
