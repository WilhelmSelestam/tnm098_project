import { NetworkLink, NetworkNode } from "./types"
import { getEntityId } from "./graphAlgorithms"

export interface PathfindingResult {
  nodesOnPath: Set<string | number>
  highlightedPathLinks: Set<string>
}

/**
 * Executes a multi-group BFS search to locate and highlight paths connecting nodes matching
 * different parts of the connect/path search query. Includes path pruning to keep paths at
 * the shortest possible hop distances.
 */
export function findShortestPathsBetweenGroups(
  nodes: NetworkNode[],
  links: NetworkLink[],
  pMatches: (string | number)[][],
  maxPathsCount: number,
  maxDepth: number,
  evaluateLinkTypes: (link: NetworkLink) => boolean,
): PathfindingResult {
  const nodesOnPath = new Set<string | number>()
  const highlightedPathLinks = new Set<string>()

  // Build temporary undirected adjacency list for pathfinding
  const adj = new Map<string | number, Set<string | number>>()
  links.forEach((l) => {
    if (!evaluateLinkTypes(l)) return
    const u = getEntityId(l.source)
    const v = getEntityId(l.target)

    if (!adj.has(u)) adj.set(u, new Set())
    if (!adj.has(v)) adj.set(v, new Set())
    adj.get(u)!.add(v)
    adj.get(v)!.add(u)
  })

  // BFS pathfinding between matching group components
  for (let i = 0; i < pMatches.length; i++) {
    for (let j = i + 1; j < pMatches.length; j++) {
      const groupA = pMatches[i]
      const groupB = pMatches[j]

      for (const start of groupA) {
        for (const end of groupB) {
          if (start === end) continue

          const queue: {
            current: string | number
            path: (string | number)[]
          }[] = [{ current: start, path: [start] }]
          const foundPaths: (string | number)[][] = []

          const distances = new Map<string | number, number>()
          distances.set(start, 0)

          while (queue.length > 0) {
            const currentElement = queue.shift()
            if (!currentElement) break
            const { current, path } = currentElement

            // Early exit if we reached the maximum path count for this specific pair
            if (foundPaths.length >= maxPathsCount) {
              break
            }

            if (current === end) {
              foundPaths.push(path)
              continue
            }

            if (path.length - 1 >= maxDepth) continue

            const neighbors = adj.get(current) || new Set()
            for (const n of neighbors) {
              if (!path.includes(n)) {
                const nextDepth = path.length
                const knownDepth = distances.get(n)

                // Only explore this node if it is the first time reaching it,
                // or if we reached it in the exact same number of steps (allows alternative paths of same length)
                if (knownDepth === undefined || nextDepth <= knownDepth) {
                  distances.set(n, nextDepth)
                  queue.push({ current: n, path: [...path, n] })
                }
              }
            }
          }

          if (foundPaths.length > 0) {
            const selectedPaths = foundPaths.slice(0, maxPathsCount)
            selectedPaths.forEach((p) => {
              for (let idx = 0; idx < p.length; idx++) {
                nodesOnPath.add(p[idx])
                if (idx < p.length - 1) {
                  highlightedPathLinks.add(`${p[idx]}->${p[idx + 1]}`)
                  highlightedPathLinks.add(`${p[idx + 1]}->${p[idx]}`)
                }
              }
            })
          }
        }
      }
    }
  }

  return { nodesOnPath, highlightedPathLinks }
}
