import { describe, expect, it } from 'vitest';
import { isValidSkill, normalizeSkill, type Agent } from '../types/agent';
import { getAgentChanges, getAgentSummary, sortAgents } from './agents';

const agent = (overrides: Partial<Agent> & { _id: string; name: string }): Agent => ({
  role: 'Researcher',
  description: '',
  status: 'active',
  skills: [],
  permissions: [],
  ...overrides,
});

describe('agent utils', () => {
  it('sorts active, then paused, then disabled, alphabetically within each', () => {
    const sorted = sortAgents([
      agent({ _id: '1', name: 'Zed', status: 'disabled' }),
      agent({ _id: '2', name: 'Bea', status: 'paused' }),
      agent({ _id: '3', name: 'Cy' }),
      agent({ _id: '4', name: 'Ada' }),
    ]);
    expect(sorted.map((a) => a.name)).toEqual(['Ada', 'Cy', 'Bea', 'Zed']);
  });

  it('counts agents by status', () => {
    expect(
      getAgentSummary([
        agent({ _id: '1', name: 'A' }),
        agent({ _id: '2', name: 'B', status: 'paused' }),
        agent({ _id: '3', name: 'C', status: 'disabled' }),
        agent({ _id: '4', name: 'D' }),
      ]),
    ).toEqual({ total: 4, active: 2, paused: 1, disabled: 1 });
    expect(getAgentSummary([])).toEqual({ total: 0, active: 0, paused: 0, disabled: 0 });
  });

  it('reports only the fields that changed, comparing lists as sets', () => {
    const existing = agent({
      _id: '1',
      name: 'Scout',
      skills: ['research', 'analysis'],
      permissions: ['task.read', 'project.read'],
    });
    const same = {
      name: 'Scout',
      role: 'Researcher',
      description: '',
      status: 'active' as const,
      skills: ['analysis', 'research'],
      permissions: ['project.read' as const, 'task.read' as const],
    };
    expect(getAgentChanges(existing, same)).toEqual({});
    expect(
      getAgentChanges(existing, {
        ...same,
        status: 'paused',
        skills: ['research'],
        permissions: [],
      }),
    ).toEqual({ status: 'paused', skills: ['research'], permissions: [] });
    expect(getAgentChanges(existing, { ...same, role: 'Analyst', description: 'New' })).toEqual({
      role: 'Analyst',
      description: 'New',
    });
  });

  it('normalizes and validates skills like the server', () => {
    expect(normalizeSkill('  Software Development ')).toBe('software-development');
    expect(normalizeSkill('project_management')).toBe('project-management');
    expect(isValidSkill('software-development')).toBe(true);
    expect(isValidSkill('')).toBe(false);
    expect(isValidSkill('c++')).toBe(false);
    expect(isValidSkill('x'.repeat(41))).toBe(false);
  });
});
