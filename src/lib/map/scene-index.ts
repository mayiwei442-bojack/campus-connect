export const PLACE_NODE_PREFIX = "PLACE_";
export const ANCHOR_NODE_PREFIX = "ANCHOR_";

export type SceneNodePair = {
  id: string;
  placeNodeName: string;
  anchorNodeName: string;
  label: string;
  category: string;
};

type NamedSceneNode = {
  name?: string;
  parent?: NamedSceneNode | null;
};

function getNodeId(name: string, prefix: string) {
  if (!name.startsWith(prefix)) {
    return null;
  }

  const id = name.slice(prefix.length).trim();
  return id.length > 0 ? id : null;
}

function formatNodeLabel(id: string) {
  return id.replaceAll("_", " ").replace(/\s+/g, " ").trim();
}

function getNodeCategory(id: string) {
  const [category] = formatNodeLabel(id).split(" ");
  return category || "place";
}

export function buildSceneNodePairs(nodeNames: Iterable<string>): SceneNodePair[] {
  const placeIds = new Set<string>();
  const anchorIds = new Set<string>();

  for (const name of nodeNames) {
    const placeId = getNodeId(name, PLACE_NODE_PREFIX);
    const anchorId = getNodeId(name, ANCHOR_NODE_PREFIX);

    if (placeId) {
      placeIds.add(placeId);
    }
    if (anchorId) {
      anchorIds.add(anchorId);
    }
  }

  return [...placeIds]
    .filter((id) => anchorIds.has(id))
    .sort((left, right) => left.localeCompare(right, "en", { numeric: true }))
    .map((id) => ({
      id,
      placeNodeName: `${PLACE_NODE_PREFIX}${id}`,
      anchorNodeName: `${ANCHOR_NODE_PREFIX}${id}`,
      label: formatNodeLabel(id),
      category: getNodeCategory(id),
    }));
}

export function findPlaceIdInHierarchy(node: NamedSceneNode | null) {
  let current = node;

  while (current) {
    const id = current.name ? getNodeId(current.name, PLACE_NODE_PREFIX) : null;
    if (id) {
      return id;
    }
    current = current.parent ?? null;
  }

  return null;
}
