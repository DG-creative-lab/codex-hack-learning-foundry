import { CircleDot, GraduationCap, Info, Library, Network, ShieldCheck, Wrench } from "lucide-react";
import type { ReactNode } from "react";

export type ViewId = "sources" | "learn" | "memory" | "foundry" | "about";

interface SidebarProps {
  view: ViewId;
  setView: (view: ViewId) => void;
  eventCount: number;
  sourceCount: number;
  atomCount: number;
}

export function Sidebar({ view, setView, eventCount, sourceCount, atomCount }: SidebarProps) {
  const items: Array<[ViewId, string, ReactNode, string]> = [
    ["sources", "Sources", <Library size={17} />, "01"],
    ["learn", "Learn", <GraduationCap size={17} />, "02"],
    ["memory", "Memory", <Network size={17} />, eventCount.toString().padStart(2, "0")],
    ["foundry", "Foundry", <Wrench size={17} />, "03"]
  ];

  return (
    <aside className="sidebar">
      <div className="window-drag" />
      <div className="brand-block">
        <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
        <div><p className="brand-name">Learning<br />Foundry</p><p className="brand-edition">Build week / 01</p></div>
      </div>
      <nav className="primary-nav" aria-label="Primary navigation">
        {items.map(([id, label, icon, count]) => (
          <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>
            {icon}{label}<span>{count}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-project">
        <p className="eyebrow">Active project</p>
        <strong>Design intelligence</strong>
        <span>{sourceCount} sources / {atomCount} atoms</span>
      </div>
      <button className={`about-nav ${view === "about" ? "active" : ""}`} onClick={() => setView("about")}>
        <Info size={16} /> System model
      </button>
      <div className="sidebar-status">
        <p className="eyebrow">Canonical memory</p>
        <div><CircleDot size={12} /> Local / inspectable</div>
        <div><ShieldCheck size={12} /> Approval gated</div>
      </div>
    </aside>
  );
}
