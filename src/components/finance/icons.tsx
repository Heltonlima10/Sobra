import {
  ArrowDownLeft,
  Bus,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  HeartPulse,
  Home,
  PiggyBank,
  Plus,
  Receipt,
  Repeat,
  ShoppingBag,
  ShoppingBasket,
  Ticket,
  UserRound,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  home: Home,
  basket: ShoppingBasket,
  receipt: Receipt,
  bus: Bus,
  health: HeartPulse,
  study: GraduationCap,
  food: UtensilsCrossed,
  ticket: Ticket,
  repeat: Repeat,
  bag: ShoppingBag,
  user: UserRound,
  wallet: Wallet,
  plus: Plus,
  down: ArrowDownLeft,
  save: PiggyBank,
};

export function CatIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Receipt;
  return <Icon className={className} strokeWidth={1.75} aria-hidden="true" />;
}

export function NavChevron({ dir }: { dir: "left" | "right" }) {
  const Icon = dir === "left" ? ChevronLeft : ChevronRight;
  return <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />;
}
