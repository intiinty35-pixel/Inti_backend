import { summarizePortfolio } from './portfolio-summary';

describe('summarizePortfolio', () => {
  it('uses saved plan inventory without double counting legacy lots', () => {
    const result = summarizePortfolio([
      { status: 'PUBLISHED', lots: [{ status: 'SOLD' }], sitePlan: { draft: { lots: [{ status: 'AVAILABLE' }, { status: 'RESERVED' }, { status: 'BLOCKED' }] } } },
      { status: 'PUBLISHED', lots: [{ status: 'SOLD' }], sitePlan: null },
      { status: 'SOLD', lots: [], sitePlan: { draft: { lots: [] } } },
    ]);
    expect(result).toEqual({ projects: 3, availableProjects: 1, reservedProjects: 1, soldProjects: 2, totalLots: 4, available: 1, reserved: 1, sold: 1, blocked: 1 });
  });
  it('handles an empty portfolio', () => {
    expect(summarizePortfolio([]).totalLots).toBe(0);
    expect(summarizePortfolio([]).projects).toBe(0);
  });
});
