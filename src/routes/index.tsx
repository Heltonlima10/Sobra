import { createFileRoute } from "@tanstack/react-router";
import { FinanceApp } from "@/components/finance/app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <FinanceApp />;
}
