import { describe, expect, it } from "vitest";

import { buildSceneNodePairs, findPlaceIdInHierarchy } from "./scene-index";

describe("buildSceneNodePairs", () => {
  it("only returns exact Place and Anchor pairs", () => {
    expect(
      buildSceneNodePairs([
        "PLACE_library",
        "ANCHOR_library",
        "PLACE_orphan",
        "ANCHOR_internship center",
        "PLACE_internship center",
        "Node_86",
      ]),
    ).toEqual([
      {
        id: "internship center",
        placeNodeName: "PLACE_internship center",
        anchorNodeName: "ANCHOR_internship center",
        label: "internship center",
        category: "internship",
      },
      {
        id: "library",
        placeNodeName: "PLACE_library",
        anchorNodeName: "ANCHOR_library",
        label: "library",
        category: "library",
      },
    ]);
  });

  it("keeps numeric node names in natural order", () => {
    const names = ["10", "2", "1"].flatMap((id) => [`PLACE_dormitory_${id}`, `ANCHOR_dormitory_${id}`]);

    expect(buildSceneNodePairs(names).map((item) => item.id)).toEqual([
      "dormitory_1",
      "dormitory_2",
      "dormitory_10",
    ]);
  });
});

describe("findPlaceIdInHierarchy", () => {
  it("walks from a mesh child to its Place node", () => {
    const place = { name: "PLACE_ground track field_1", parent: null };
    const mesh = { name: "mesh", parent: place };

    expect(findPlaceIdInHierarchy(mesh)).toBe("ground track field_1");
  });

  it("returns null when no Place node exists", () => {
    expect(findPlaceIdInHierarchy({ name: "Node_86", parent: null })).toBeNull();
  });
});
