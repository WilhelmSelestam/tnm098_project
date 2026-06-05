import { useMemo, useState, useDeferredValue } from "react"
import { NetworkData, NetworkNode, NetworkLink } from "@/lib/types"
import { getEntityId } from "@/lib/graphAlgorithms"
import { findShortestPathsBetweenGroups } from "@/lib/networkHelpers"

export const UNKNOWN_NODE_TYPE = "__unknown_node_type__"

/**
 * Custom React Hook that manages the filtering state, search queries,
 * and graph queries (ego network, node highlighting, pathfinding).
 * Keeps the computation optimized using React's useMemo and useDeferredValue.
 *
 * @param initialData The raw graph data parsed from JSON.
 */
export const useNetworkFilter = (initialData: NetworkData) => {
  const [minWeight, setMinWeight] = useState<number>(0)
  const [maxWeight, setMaxWeight] = useState<number>(1)
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set())
  const [selectedEdgeTypes, setSelectedEdgeTypes] = useState<Set<string>>(
    new Set(),
  )

  // Search state initialized with key target companies for analysis
  const [egoSearchQuery, setEgoSearchQuery] = useState<string>(
    "8327, Mar de la Vida OJSC, 979893388, Oceanfront Oasis Inc Carriers",
  )
  const [locateSearchQuery, setLocateSearchQuery] = useState<string>(
    "8327, Mar de la Vida OJSC, 979893388, Oceanfront Oasis Inc Carriers",
  )
  const [pathSearchQuery, setPathSearchQuery] = useState<string>("")
  const [pathSearchDepth, setPathSearchDepth] = useState<number>(3)

  // Defer pathfinding search depth updates to keep UI sliders responsive
  const deferredPathSearchDepth = useDeferredValue(pathSearchDepth)

  const [maxPathsCount, setMaxPathsCount] = useState<number>(3)
  const [showPathNeighbors, setShowPathNeighbors] = useState<boolean>(false)

  const [intersectionMode, setIntersectionMode] = useState<boolean>(false)
  const [showSecondDegree, setShowSecondDegree] = useState<boolean>(false)

  /**
   * Extracted unique node types from the dataset.
   */
  const allNodeTypes = useMemo(() => {
    if (!initialData?.nodes) return []
    const types = new Set<string>()
    let hasUnknownTypeNodes = false

    initialData.nodes.forEach((n) => {
      if (n.type && n.type.trim().length > 0) {
        types.add(n.type)
      } else {
        hasUnknownTypeNodes = true
      }
    })

    const sortedTypes = Array.from(types).sort()
    if (hasUnknownTypeNodes) {
      sortedTypes.push(UNKNOWN_NODE_TYPE)
    }
    return sortedTypes
  }, [initialData])

  /**
   * Extracted unique edge (link) types from the dataset.
   */
  const allEdgeTypes = useMemo(() => {
    if (!initialData?.links) return []
    const types = new Set<string>()
    initialData.links.forEach((l) => {
      if (l.type) {
        types.add(l.type)
      }
    })
    return Array.from(types).sort()
  }, [initialData])

  /**
   * Evaluates if a node satisfies the active node type filters.
   */
  const evaluateNodeTypes = useMemo(() => {
    return (node: NetworkNode) => {
      const isUnknownNodeType = !node.type || node.type.trim().length === 0
      return (
        selectedTypes.size === 0 ||
        (isUnknownNodeType
          ? selectedTypes.has(UNKNOWN_NODE_TYPE)
          : selectedTypes.has(node.type as string))
      )
    }
  }, [selectedTypes])

  /**
   * Evaluates if a link satisfies the active edge type filters.
   */
  const evaluateLinkTypes = useMemo(() => {
    return (link: NetworkLink) => {
      return (
        selectedEdgeTypes.size === 0 ||
        (link.type !== undefined && selectedEdgeTypes.has(link.type))
      )
    }
  }, [selectedEdgeTypes])

  /**
   * Returns a set of node IDs that match the active Locate & Highlight query.
   */
  const matchedNodeIDs = useMemo(() => {
    if (!initialData?.nodes) return new Set<string | number>()

    const query = locateSearchQuery.toLowerCase().trim()
    const queries = query
      .split(",")
      .map((q) => q.trim())
      .filter((q) => q.length > 0)

    if (queries.length === 0) return new Set<string | number>()

    const matches = queries
      .map((q) => {
        return initialData.nodes
          .filter((node) => String(node.id).toLowerCase().includes(q))
          .filter((node) => evaluateNodeTypes(node))
          .map((n) => n.id)
      })
      .flat()

    return new Set(matches)
  }, [initialData, locateSearchQuery, evaluateNodeTypes])

  /**
   * Primary filter state memoization containing coordinates filtering,
   * pathfinding logic, ego network expansion, and edge bundling.
   */
  const filterState = useMemo(() => {
    if (!initialData || !initialData.nodes || !initialData.links) {
      return {
        filteredData: { nodes: [], links: [] },
        highlightedPathLinks: new Set<string>(),
      }
    }

    const egoQuery = egoSearchQuery.toLowerCase().trim()
    const pathQuery = pathSearchQuery.toLowerCase().trim()

    const queries = egoQuery
      .split(",")
      .map((q) => q.trim())
      .filter((q) => q.length > 0)

    const pathQueries = pathQuery
      .split(",")
      .map((q) => q.trim())
      .filter((q) => q.length > 0)

    let coreNodesToDisplay = new Set<string | number>()
    let finalConnectedNodeIDs = new Set<string | number>()
    let validLinks: NetworkLink[] = []
    let newHighlightedPathLinks = new Set<string>()

    // Case 1: Connect Nodes / Pathfinding Mode
    if (pathQueries.length > 0) {
      // Find all matching nodes grouped by their original query terms
      const pMatches = pathQueries.map((q) =>
        initialData.nodes
          .filter(
            (node) =>
              String(node.id).toLowerCase().includes(q) &&
              evaluateNodeTypes(node),
          )
          .map((n) => n.id),
      )

      const allPTargets = new Set(pMatches.flat())

      if (pMatches.length > 1) {
        // Run BFS search helper to identify path links and nodes
        const pathfinding = findShortestPathsBetweenGroups(
          initialData.nodes,
          initialData.links,
          pMatches,
          maxPathsCount,
          deferredPathSearchDepth,
          evaluateLinkTypes,
        )

        const nodesOnPath = pathfinding.nodesOnPath
        newHighlightedPathLinks = pathfinding.highlightedPathLinks

        nodesOnPath.forEach((n) => finalConnectedNodeIDs.add(n))

        if (showPathNeighbors) {
          initialData.links.forEach((l) => {
            if (!evaluateLinkTypes(l)) return
            const u = getEntityId(l.source)
            const v = getEntityId(l.target)
            if (nodesOnPath.has(u)) finalConnectedNodeIDs.add(v)
            if (nodesOnPath.has(v)) finalConnectedNodeIDs.add(u)
          })
        }

        allPTargets.forEach((n) => coreNodesToDisplay.add(n))

        validLinks = initialData.links.filter((link) => {
          if (!evaluateLinkTypes(link)) return false
          const sourceId = getEntityId(link.source)
          const targetId = getEntityId(link.target)
          return (
            finalConnectedNodeIDs.has(sourceId) &&
            finalConnectedNodeIDs.has(targetId)
          )
        })
      } else {
        // Fallback for 1 node match (ego behavior)
        allPTargets.forEach((n) => coreNodesToDisplay.add(n))
        validLinks = []
      }
    }
    // Case 2: Ego-Network Mode (1st or 2nd degree neighbors search)
    else if (queries.length > 0) {
      const queryMatches = queries.map((q) => {
        return initialData.nodes
          .filter(
            (node) =>
              String(node.id).toLowerCase() === q && evaluateNodeTypes(node),
          )
          .map((n) => n.id)
      })

      const queryNeighborsList = queryMatches.map((matchingIds) => {
        const neighborSet = new Set<string | number>()
        const matchSet = new Set(matchingIds)

        initialData.links.forEach((link) => {
          if (!evaluateLinkTypes(link)) return
          const sourceId = getEntityId(link.source)
          const targetId = getEntityId(link.target)

          if (matchSet.has(sourceId)) neighborSet.add(targetId)
          if (matchSet.has(targetId)) neighborSet.add(sourceId)
        })

        if (!showSecondDegree) return neighborSet

        // Expand to 2nd degree neighbors
        const secondDegreeSet = new Set(neighborSet)
        initialData.links.forEach((link) => {
          if (!evaluateLinkTypes(link)) return
          const sourceId = getEntityId(link.source)
          const targetId = getEntityId(link.target)

          if (neighborSet.has(sourceId)) secondDegreeSet.add(targetId)
          if (neighborSet.has(targetId)) secondDegreeSet.add(sourceId)
        })
        return secondDegreeSet
      })

      // Handle intersection of ego networks if matching multiple seeds
      if (intersectionMode && queries.length > 1) {
        if (queryNeighborsList.length > 0) {
          let intersection = new Set(queryNeighborsList[0])
          for (let i = 1; i < queryNeighborsList.length; i++) {
            const nextSet = queryNeighborsList[i]
            intersection = new Set(
              [...intersection].filter((x) => nextSet.has(x)),
            )
          }

          const allCoreMatches = new Set(queryMatches.flat())
          finalConnectedNodeIDs = intersection
          coreNodesToDisplay = allCoreMatches
        }
      } else {
        const allCoreMatches = new Set(queryMatches.flat())
        coreNodesToDisplay = allCoreMatches

        const allNeighbors = new Set<string | number>()
        queryNeighborsList.forEach((ns) =>
          ns.forEach((id) => allNeighbors.add(id)),
        )

        finalConnectedNodeIDs = allNeighbors
      }

      validLinks = initialData.links.filter((link) => {
        if (!evaluateLinkTypes(link)) return false

        const sourceId = getEntityId(link.source)
        const targetId = getEntityId(link.target)

        const isSourceRelevant =
          coreNodesToDisplay.has(sourceId) ||
          finalConnectedNodeIDs.has(sourceId)
        const isTargetRelevant =
          coreNodesToDisplay.has(targetId) ||
          finalConnectedNodeIDs.has(targetId)

        return isSourceRelevant && isTargetRelevant
      })
    }
    // Case 3: Complete Network Mode (Filtered by Node Types & Edge Types only)
    else {
      const validNodes = initialData.nodes.filter(evaluateNodeTypes)
      const validNodeIds = new Set(validNodes.map((n) => n.id))

      validLinks = initialData.links.filter((link) => {
        if (!evaluateLinkTypes(link)) return false

        const sourceId = getEntityId(link.source)
        const targetId = getEntityId(link.target)

        return validNodeIds.has(sourceId) && validNodeIds.has(targetId)
      })

      coreNodesToDisplay = validNodeIds
    }

    const allDisplayedNodesIds = new Set([
      ...coreNodesToDisplay,
      ...finalConnectedNodeIDs,
    ])

    // Bundle parallel links connecting the same nodes to keep the graph uncluttered
    const bundledLinksMap = new Map<string, NetworkLink>()
    validLinks.forEach((l) => {
      const sourceId = getEntityId(l.source)
      const targetId = getEntityId(l.target)
      const key = `${sourceId}->${targetId}`

      if (bundledLinksMap.has(key)) {
        const existing = bundledLinksMap.get(key)!
        existing.count = (existing.count ?? 1) + 1
        if (l.type && existing.type && !existing.type.includes(l.type)) {
          existing.type += `, ${l.type}`
        } else if (l.type && !existing.type) {
          existing.type = l.type
        }
      } else {
        bundledLinksMap.set(key, { ...l, count: 1 })
      }
    })

    const finalLinks = Array.from(bundledLinksMap.values())

    const filteredNodes = initialData.nodes.filter((node) =>
      allDisplayedNodesIds.has(node.id),
    )

    return {
      filteredData: {
        ...initialData,
        nodes: filteredNodes.map((n) => ({ ...n })),
        links: finalLinks,
      },
      highlightedPathLinks: newHighlightedPathLinks,
    }
  }, [
    initialData,
    egoSearchQuery,
    pathSearchQuery,
    deferredPathSearchDepth,
    maxPathsCount,
    showPathNeighbors,
    intersectionMode,
    showSecondDegree,
    evaluateNodeTypes,
    evaluateLinkTypes,
  ])

  return {
    filteredData: filterState.filteredData,
    highlightedPathLinks: filterState.highlightedPathLinks,
    matchedNodeIDs,
    minWeight,
    maxWeight,
    setMinWeight,
    setMaxWeight,
    allNodeTypes,
    selectedTypes,
    setSelectedTypes,
    allEdgeTypes,
    selectedEdgeTypes,
    setSelectedEdgeTypes,
    egoSearchQuery,
    setEgoSearchQuery,
    locateSearchQuery,
    setLocateSearchQuery,
    pathSearchQuery,
    setPathSearchQuery,
    pathSearchDepth,
    setPathSearchDepth,
    maxPathsCount,
    setMaxPathsCount,
    showPathNeighbors,
    setShowPathNeighbors,
    intersectionMode,
    setIntersectionMode,
    showSecondDegree,
    setShowSecondDegree,
  }
}
