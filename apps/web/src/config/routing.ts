import type { UseCaseId } from "./useCases";
import { USE_CASES } from "./useCases";

export type Page = "landing" | "demo" | "architecture" | "dashboard" | "pilot";

export interface RouteState {
  page: Page;
  useCase: UseCaseId;
}

export function routeFromHash(source = window.location.hash): RouteState {
  const hash = source.replace(/^#\/?/, "");
  if (!hash || hash === "landing") {
    return { page: "landing", useCase: "auction" };
  }

  const parts = hash.split("/").filter(Boolean);
  if (parts[0] === "architecture") {
    return { page: "architecture", useCase: "auction" };
  }
  if (parts[0] === "dashboard") {
    return { page: "dashboard", useCase: "auction" };
  }
  if (parts[0] === "pilot") {
    return { page: "pilot", useCase: "auction" };
  }
  if (parts[0] === "demo" || parts[0] === "app") {
    const maybeCase = parts[1];
    const useCase = USE_CASES.some((item) => item.id === maybeCase)
      ? (maybeCase as UseCaseId)
      : "auction";
    return { page: "demo", useCase };
  }

  return { page: "landing", useCase: "auction" };
}

export function pilotRoundIdFromHash(source = window.location.hash): string {
  const parts = source.replace(/^#\/?/, "").split("/").filter(Boolean);
  return parts[0] === "pilot" && /^\d+$/.test(parts[1] ?? "") ? parts[1] : "";
}

export function hashFor(page: Page, useCase: UseCaseId = "auction"): string {
  if (page === "landing") return "#/landing";
  if (page === "architecture") return "#/architecture";
  if (page === "dashboard") return "#/dashboard";
  if (page === "pilot") return "#/pilot";
  return `#/demo/${useCase}`;
}
