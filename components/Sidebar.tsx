"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { icon: "📒", label: "全部笔记", href: "/" },
  { icon: "📊", label: "统计", href: "/stats" },
  { icon: "⭐", label: "收藏", href: "/favorites" },
  { icon: "⚙️", label: "设置", href: "/settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="notebook-sidebar">
      {/* Logo */}
      <Link href="/" className="sidebar-logo">
        ▶
      </Link>

      <div style={{ height: 1, width: 24, background: "var(--border)", margin: "4px 0 8px" }} />

      {/* Nav items */}
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || (item.href === "/" && pathname.startsWith("/notebook"));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`sidebar-icon${isActive ? " active" : ""}`}
            title={item.label}
          >
            {item.icon}
          </Link>
        );
      })}

      <div className="sidebar-spacer" />

      {/* User avatar */}
      <div className="sidebar-avatar" title="用户">
        S
      </div>
    </nav>
  );
}