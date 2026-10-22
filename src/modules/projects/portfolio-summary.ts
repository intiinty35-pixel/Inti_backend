type PortfolioProject = {
  status: string;
  lots: { status: string }[];
  sitePlan: { draft: unknown } | null;
};

export function summarizePortfolio(projects: PortfolioProject[]) {
  const summary = { projects: projects.length, availableProjects: 0, reservedProjects: 0, soldProjects: 0, totalLots: 0, available: 0, reserved: 0, sold: 0, blocked: 0 };
  for (const project of projects) {
    const draft = project.sitePlan?.draft;
    const draftLots = draft && typeof draft === 'object' && 'lots' in draft && Array.isArray(draft.lots) ? draft.lots : null;
    const lots: unknown[] = draftLots ?? project.lots;
    const statuses = new Set<string>();
    for (const lot of lots) {
      if (!lot || typeof lot !== 'object' || !('status' in lot)) continue;
      const status = lot.status;
      if (!['AVAILABLE', 'RESERVED', 'SOLD', 'BLOCKED'].includes(String(status))) continue;
      summary.totalLots++;
      statuses.add(String(status));
      if (status === 'AVAILABLE') summary.available++;
      if (status === 'RESERVED') summary.reserved++;
      if (status === 'SOLD') summary.sold++;
      if (status === 'BLOCKED') summary.blocked++;
    }
    if (project.status === 'SOLD' || (lots.length > 0 && statuses.size === 1 && statuses.has('SOLD'))) summary.soldProjects++;
    if (statuses.has('AVAILABLE')) summary.availableProjects++;
    if (statuses.has('RESERVED')) summary.reservedProjects++;
  }
  return summary;
}
