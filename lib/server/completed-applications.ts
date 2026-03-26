import "server-only";

import { cache } from "react";

const COMPLETED_APPLICATIONS_REVALIDATE_SECONDS = 300;

function getHubUrl(): string {
  const value = process.env.NEXT_PUBLIC_HUB_URL;
  if (!value) {
    throw new Error("NEXT_PUBLIC_HUB_URL is not set");
  }
  return value;
}

async function fetchCompletedApplicationsPath(path: string): Promise<unknown[]> {
  const response = await fetch(`${getHubUrl()}${path}`, {
    next: { revalidate: COMPLETED_APPLICATIONS_REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Hub GET ${path} failed: ${response.status} - ${text}`);
  }

  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
}

export const getCompletedApplications = cache(
  async (): Promise<unknown[]> =>
    await fetchCompletedApplicationsPath("/applications/completed")
);

export const getCompletedApplicationsSummary = cache(
  async (): Promise<unknown[]> =>
    await fetchCompletedApplicationsPath("/applications/completed/summary")
);
