import {
  EducationAgentEmulator,
  type AgentPosition,
} from "../engine/educationAgentEmulator";

export type { AgentPosition };

export interface HouseDimensions {
  width: number; // X-axis span
  length: number; // Z-axis span
  height: number; // Y-axis wall height
}

export function executeAutomated3DHouseBuilder(
  agent: EducationAgentEmulator,
  dimensions: HouseDimensions,
): { position: AgentPosition; placedCount: number } {
  const { width, length, height } = dimensions;
  if (![width, length, height].every((value) => Number.isInteger(value) && value > 0)) {
    throw new Error("House dimensions must be positive integers");
  }

  agent.log(
    `[Script Start] Agent building a ${width}x${length}x${height} 3D House.`,
  );

  const commands: Array<() => void> = [];
  const addStep = (action: () => void) => commands.push(action);

  for (let x = 0; x < width; x++) {
    for (let z = 0; z < length; z++) {
      addStep(() => {
        agent.place("DOWN", 1);
        agent.move("FORWARD", 1);
      });
    }
    addStep(() => {
      agent.turn("RIGHT");
      agent.move("FORWARD", 1);
      agent.turn("RIGHT");
    });
  }

  for (let y = 1; y <= height; y++) {
    addStep(() => agent.move("UP", 1));

    [width, length, width, length].forEach((wallLength, side) => {
      for (let step = 0; step < wallLength; step++) {
        addStep(() => {
          const isDoorGap =
            y <= 2 && side === 0 && step === Math.floor(width / 2);
          if (!isDoorGap) {
            agent.place("DOWN", 2);
          }
          agent.move("FORWARD", 1);
        });
      }
      addStep(() => agent.turn("RIGHT"));
    });
  }

  addStep(() => agent.move("UP", 1));
  for (let r = 0; r < Math.ceil(width / 2); r++) {
    addStep(() => {
      agent.log(`[Roof Layer ${r + 1}] Placing roof tier...`);
      agent.place("DOWN", 3);
    });
  }

  agent.executePythonScript(commands);
  agent.log(
    `[Script Complete] Final Agent Position: ${JSON.stringify(agent.getPosition())}`,
  );

  return {
    position: agent.getPosition(),
    placedCount: agent.getPlacedBlocks().length,
  };
}

export function createStockedHouseBuilderAgent(
  start: AgentPosition = { x: 0, y: 64, z: 0, facing: "NORTH" },
): EducationAgentEmulator {
  const agent = new EducationAgentEmulator(start);
  agent.setItem(1, "minecraft:cobblestone", 64);
  agent.setItem(2, "minecraft:oak_planks", 128);
  agent.setItem(3, "minecraft:stone_brick_stairs", 64);
  return agent;
}
