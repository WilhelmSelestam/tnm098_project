import { NetworkLink, NetworkNode } from "./types"

export function getEntityId(
  nodeOrId: string | number | NetworkNode,
): string | number {
  if (nodeOrId && typeof nodeOrId === "object" && "id" in nodeOrId) {
    return nodeOrId.id
  }
  return nodeOrId as string | number
}

export function getResolvedNode(
  nodeOrId: string | number | NetworkNode,
): NetworkNode | null {
  if (nodeOrId && typeof nodeOrId === "object" && "id" in nodeOrId) {
    return nodeOrId as NetworkNode
  }
  return null
}

/**
 * Identifies links that form circular entity relationships using Tarjan's strongly
 * connected components (SCC) algorithm. Only considers "ownership" and "membership" links.
 */
export function findCircularRelationships(
  links: NetworkLink[],
): Set<NetworkLink> {
  const cyclicLinks = new Set<NetworkLink>()
  const adj = new Map<
    string | number,
    { target: string | number; link: NetworkLink }[]
  >()
  const nodesInvolved = new Set<string | number>()

  // Build the adjacency list for "ownership" and "membership" links
  links.forEach((l) => {
    const types = (l.type || "")
      .toLowerCase()
      .split(",")
      .map((x) => x.trim())

    if (types.includes("ownership") || types.includes("membership")) {
      const sourceId = getEntityId(l.source)
      const targetId = getEntityId(l.target)

      if (!adj.has(sourceId)) {
        adj.set(sourceId, [])
      }
      adj.get(sourceId)!.push({ target: targetId, link: l })
      nodesInvolved.add(sourceId)
      nodesInvolved.add(targetId)
    }
  })

  // Tarjan's Strongly Connected Components Algorithm
  let index = 0
  const indices = new Map<string | number, number>()
  const lowlinks = new Map<string | number, number>()
  const stack: (string | number)[] = []
  const onStack = new Set<string | number>()
  const sccs: (string | number)[][] = []

  function strongconnect(v: string | number) {
    indices.set(v, index)
    lowlinks.set(v, index)
    index++
    stack.push(v)
    onStack.add(v)

    const neighbors = adj.get(v) || []
    for (const edge of neighbors) {
      const w = edge.target
      if (!indices.has(w)) {
        strongconnect(w)
        lowlinks.set(v, Math.min(lowlinks.get(v)!, lowlinks.get(w)!))
      } else if (onStack.has(w)) {
        lowlinks.set(v, Math.min(lowlinks.get(v)!, indices.get(w)!))
      }
    }

    // If v is a root node, pop the stack and generate an SCC
    if (lowlinks.get(v) === indices.get(v)) {
      const scc: (string | number)[] = []
      let w: string | number
      do {
        w = stack.pop()!
        onStack.delete(w)
        scc.push(w)
      } while (w !== v)

      // Only consider components containing cycles (more than 1 node)
      if (scc.length > 1) {
        sccs.push(scc)
      }
    }
  }

  // Run strongconnect for each unvisited node in the relevant subgraph
  nodesInvolved.forEach((v) => {
    if (!indices.has(v)) {
      strongconnect(v)
    }
  })

  // Map nodes to their respective SCC identifier
  const sccMap = new Map<string | number, number>()
  sccs.forEach((scc, sccIndex) => {
    scc.forEach((nodeId) => sccMap.set(nodeId, sccIndex))
  })

  // Highlight links connecting nodes in the exact same SCC of size > 1
  links.forEach((l) => {
    const sourceId = getEntityId(l.source)
    const targetId = getEntityId(l.target)

    if (
      sccMap.has(sourceId) &&
      sccMap.has(targetId) &&
      sccMap.get(sourceId) === sccMap.get(targetId)
    ) {
      cyclicLinks.add(l)
    }
  })

  return cyclicLinks
}

/**
 * Validates relationships based on semantic entity types to identify logical anomalies
 * (e.g. an organization "owning" a human person, non-person entities having "family" ties,
 * or a boat "owning" something).
 */
export function isWeirdRelationship(link: NetworkLink): boolean {
  const sourceNode = getResolvedNode(link.source)
  const targetNode = getResolvedNode(link.target)
  if (!sourceNode || !targetNode) return false

  const sourceType = (sourceNode.type || "").toLowerCase()
  const targetType = (targetNode.type || "").toLowerCase()
  const linkTypes = (link.type || "")
    .toLowerCase()
    .split(",")
    .map((x) => x.trim())

  for (const linkType of linkTypes) {
    // A company/organization owning/membership a person (normally ownership is reversed)
    if (
      (linkType === "ownership" || linkType === "membership") &&
      targetType === "person"
    ) {
      if (
        ["company", "organization", "political_organization"].includes(
          sourceType,
        )
      ) {
        return true
      }
    }
    // Family relationships between non-persons
    if (
      linkType === "family_relationship" &&
      (sourceType !== "person" || targetType !== "person")
    ) {
      return true
    }
    // A vessel owning an entity (boats are assets, not owners)
    if (linkType === "ownership" && sourceType === "vessel") {
      return true
    }
  }

  return false
}

/**
 * Checks if the given link lies along the path(s) selected by the connect/pathfinding query.
 */
export function isHighlightedPath(
  link: NetworkLink,
  highlightedPathLinks?: Set<string>,
): boolean {
  if (!highlightedPathLinks) return false
  const sourceId = getEntityId(link.source)
  const targetId = getEntityId(link.target)
  return (
    highlightedPathLinks.has(`${sourceId}->${targetId}`) ||
    highlightedPathLinks.has(`${targetId}->${sourceId}`)
  )
}
