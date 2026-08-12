import { describe, expect, it } from "vitest";

import { getPerspectiveFitDistance } from "./scene-camera";

describe("getPerspectiveFitDistance", () => {
  it("moves the camera farther away when the canvas becomes narrow", () => {
    const landscape = getPerspectiveFitDistance({ radius: 8, verticalFovDegrees: 42, aspect: 1.5 });
    const portrait = getPerspectiveFitDistance({ radius: 8, verticalFovDegrees: 42, aspect: 0.65 });

    expect(portrait).toBeGreaterThan(landscape);
  });

  it("reserves the requested framing margin", () => {
    const fitted = getPerspectiveFitDistance({ radius: 8, verticalFovDegrees: 42, aspect: 1 });
    const padded = getPerspectiveFitDistance({ radius: 8, verticalFovDegrees: 42, aspect: 1, padding: 1.16 });

    expect(padded).toBeCloseTo(fitted * 1.16);
  });
});
