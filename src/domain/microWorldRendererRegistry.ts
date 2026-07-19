export const MICRO_WORLD_RENDERER_IDS = ["design_density_queue"] as const;
export const MICRO_WORLD_VARIABLE_ROLES = ["spacing", "hierarchy", "information_density"] as const;
export const MICRO_WORLD_OUTCOME_KINDS = ["visible_capacity", "scan_effort", "hierarchy_clarity"] as const;

export type MicroWorldRendererId = (typeof MICRO_WORLD_RENDERER_IDS)[number];
export type MicroWorldVariableRole = (typeof MICRO_WORLD_VARIABLE_ROLES)[number];
export type MicroWorldOutcomeKind = (typeof MICRO_WORLD_OUTCOME_KINDS)[number];

export interface MicroWorldRendererDefinition {
  variableRoles: readonly MicroWorldVariableRole[];
  outcomeKinds: readonly MicroWorldOutcomeKind[];
  evaluate: (normalizedValues: Readonly<Record<string, number>>) => Readonly<Record<string, number>>;
}

const designDensityQueueDefinition: MicroWorldRendererDefinition = {
  variableRoles: ["spacing", "hierarchy", "information_density"],
  outcomeKinds: ["visible_capacity", "scan_effort", "hierarchy_clarity"],
  evaluate: (values) => {
    const spacing = values.spacing ?? 0;
    const hierarchy = values.hierarchy ?? 0;
    const informationDensity = values.information_density ?? 0;
    const scanEffort = 5.2 + informationDensity * 3.4 + (1 - hierarchy) * 3.8 + Math.abs(spacing - 0.55) * 1.8;
    const hierarchyClarity = 38 + hierarchy * 54 + spacing * 8 - informationDensity * 14;

    return {
      visible_capacity: Math.round(5 + informationDensity * 4 - spacing * 2),
      scan_effort: Number(scanEffort.toFixed(1)),
      hierarchy_clarity: Math.round(Math.max(0, Math.min(100, hierarchyClarity)))
    };
  }
};

export const microWorldRendererRegistry = {
  design_density_queue: designDensityQueueDefinition
} satisfies Record<MicroWorldRendererId, MicroWorldRendererDefinition>;

export function getMicroWorldRendererDefinition(renderer: MicroWorldRendererId): MicroWorldRendererDefinition {
  return microWorldRendererRegistry[renderer];
}
