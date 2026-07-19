import type { ComponentType } from "react";
import type { MicroWorldProjection, MicroWorldVariableValues } from "../../domain/microWorld";
import type { MicroWorldRendererId } from "../../domain/microWorldRendererRegistry";
import { DensityQueueStage } from "./DensityQueueStage";

interface MicroWorldStageProps {
  artifact: MicroWorldProjection;
  values: MicroWorldVariableValues;
}

const microWorldStageRegistry = {
  design_density_queue: DensityQueueStage
} satisfies Record<MicroWorldRendererId, ComponentType<MicroWorldStageProps>>;

export function getMicroWorldStage(renderer: MicroWorldRendererId): ComponentType<MicroWorldStageProps> {
  return microWorldStageRegistry[renderer];
}
