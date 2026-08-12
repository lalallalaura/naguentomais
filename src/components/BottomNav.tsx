import { Home, History, UserRound } from "lucide-react";

interface Props {
  active: string;
  onChange: (tab: string) => void;
}

export function BottomNav({ active, onChange }: Props) {
  const tabs = [
    { id: "home", label: "Início", icon: Home },
    { id: "history", label: "Histórico", icon: History },
    { id: "profile", label: "Perfil", icon: UserRound },
  ];

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            className={active === tab.id ? "active" : ""}
            onClick={() => onChange(tab.id)}
          >
            <Icon size={21} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}