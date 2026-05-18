import { useMemo, useState } from "react"
import { networkData, node, link } from "./page"

export const useNetworkFilter = (initialData: networkData) => {
  const [minWeight, setMinWeight] = useState<number>(0)
  const [maxWeight, setMaxWeight] = useState<number>(1)
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [intersectionMode, setIntersectionMode] = useState<boolean>(false)

  const allNodeTypes = useMemo(() => {
    if (!initialData?.nodes) return []
    const types = new Set<string>()
    initialData.nodes.forEach((n) => {
      if (n.type) types.add(n.type)
    })
    return Array.from(types).sort()
  }, [initialData])

  const filteredData = useMemo<networkData>(() => {
    if (!initialData || !initialData.nodes || !initialData.links) {
      return { nodes: [], links: [] }
    }

    const query = searchQuery.toLowerCase().trim()

    // 1. Parse search query for multiple terms
    const queries = query
      .split(",")
      .map((q) => q.trim())
      .filter((q) => q.length > 0)

    // Evaluate validity of nodes based on type
    const evaluateNodeTypes = (node: node) => {
      return (
        selectedTypes.size === 0 || (node.type && selectedTypes.has(node.type))
      )
    }

    let coreNodesToDisplay = new Set<string | number>()
    let finalConnectedNodeIDs = new Set<string | number>()
    let validLinks: link[] = []

    if (queries.length > 0) {
      // Find matching nodes for each distinct query
      const queryMatches = queries.map((q) => {
        return initialData.nodes
          .filter(
            (node) =>
              String(node.id).toLowerCase().includes(q) &&
              evaluateNodeTypes(node),
          )
          .map((n) => n.id)
      })

      // For each set of matches, find their 1st-degree neighbors
      const queryNeighborsList = queryMatches.map((matchingIds) => {
        const neighborSet = new Set<string | number>()
        const matchSet = new Set(matchingIds)

        initialData.links.forEach((link) => {
          const linkW = link.weight ?? 1
          if (linkW < minWeight || linkW > maxWeight) return
          const sourceId =
            typeof link.source === "object" ? link.source.id : link.source
          const targetId =
            typeof link.target === "object" ? link.target.id : link.target

          if (matchSet.has(sourceId)) neighborSet.add(targetId)
          if (matchSet.has(targetId)) neighborSet.add(sourceId)
        })
        return neighborSet
      })

      if (intersectionMode && queries.length > 1) {
        // Intersection mode: keep only neighbors that appear in ALL query neighbor sets
        if (queryNeighborsList.length > 0) {
          let intersection = new Set(queryNeighborsList[0])
          for (let i = 1; i < queryNeighborsList.length; i++) {
            const nextSet = queryNeighborsList[i]
            intersection = new Set(
              [...intersection].filter((x) => nextSet.has(x)),
            )
          }

          // Also keep the originally searched nodes so we can see what connects them
          const allCoreMatches = new Set(queryMatches.flat())

          // The final display set
          finalConnectedNodeIDs = intersection
          coreNodesToDisplay = allCoreMatches
        }
      } else {
        // Union mode (or single query): just combine all core nodes and their neighbors
        const allCoreMatches = new Set(queryMatches.flat())
        coreNodesToDisplay = allCoreMatches

        const allNeighbors = new Set<string | number>()
        queryNeighborsList.forEach((ns) =>
          ns.forEach((id) => allNeighbors.add(id)),
        )

        finalConnectedNodeIDs = allNeighbors
      }

      // Filter links to only those between nodes in our final display sets
      const allDisplayedNodes = new Set([
        ...coreNodesToDisplay,
        ...finalConnectedNodeIDs,
      ])

      validLinks = initialData.links.filter((link) => {
        const linkW = link.weight ?? 1
        if (linkW < minWeight || linkW > maxWeight) return false

        const sourceId =
          typeof link.source === "object" ? link.source.id : link.source
        const targetId =
          typeof link.target === "object" ? link.target.id : link.target

        // For ego/union network, we show links from core to neighbor.
        // In intersection, it helps to show links connecting core to intersection, and intersection to intersection
        const isSourceRelevant =
          coreNodesToDisplay.has(sourceId) ||
          finalConnectedNodeIDs.has(sourceId)
        const isTargetRelevant =
          coreNodesToDisplay.has(targetId) ||
          finalConnectedNodeIDs.has(targetId)

        return isSourceRelevant && isTargetRelevant
      })
    } else {
      // No search query: apply only type and weight filters
      const validNodes = initialData.nodes.filter(evaluateNodeTypes)
      const validNodeIds = new Set(validNodes.map((n) => n.id))

      validLinks = initialData.links.filter((link) => {
        const linkW = link.weight ?? 1
        if (linkW < minWeight || linkW > maxWeight) return false

        const sourceId =
          typeof link.source === "object" ? link.source.id : link.source
        const targetId =
          typeof link.target === "object" ? link.target.id : link.target

        return (
          validNodeIds.size === 0 ||
          validNodeIds.has(sourceId) ||
          validNodeIds.has(targetId)
        )
      })

      validLinks.forEach((link) => {
        const sourceId =
          typeof link.source === "object" ? link.source.id : link.source
        const targetId =
          typeof link.target === "object" ? link.target.id : link.target
        finalConnectedNodeIDs.add(sourceId)
        finalConnectedNodeIDs.add(targetId)
      })
      coreNodesToDisplay = validNodeIds
    }

    const allDisplayedNodesIds = new Set([
      ...coreNodesToDisplay,
      ...finalConnectedNodeIDs,
    ])

    // Also ensuring isolated core nodes without ties are displayed
    const filteredNodes = initialData.nodes.filter((node) =>
      allDisplayedNodesIds.has(node.id),
    )

    return {
      ...initialData,
      nodes: filteredNodes.map((n) => ({ ...n })),
      links: validLinks.map((l) => ({ ...l })),
    }
  }, [
    initialData,
    minWeight,
    maxWeight,
    selectedTypes,
    searchQuery,
    intersectionMode,
  ])

  return {
    filteredData,
    minWeight,
    maxWeight,
    setMinWeight,
    setMaxWeight,
    allNodeTypes,
    selectedTypes,
    setSelectedTypes,
    searchQuery,
    setSearchQuery,
    intersectionMode,
    setIntersectionMode,
  }
}
