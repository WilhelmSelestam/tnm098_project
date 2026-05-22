import { useMemo, useState } from "react"
import { networkData, node, link } from "./page"

export const UNKNOWN_NODE_TYPE = "__unknown_node_type__"

export const useNetworkFilter = (initialData: networkData) => {
  const [minWeight, setMinWeight] = useState<number>(0)
  const [maxWeight, setMaxWeight] = useState<number>(1)
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set())
  const [selectedEdgeTypes, setSelectedEdgeTypes] = useState<Set<string>>(
    new Set(),
  )
  const [egoSearchQuery, setEgoSearchQuery] = useState<string>("")
  const [locateSearchQuery, setLocateSearchQuery] = useState<string>("")
  const [pathSearchQuery, setPathSearchQuery] = useState<string>("")
  const [pathSearchDepth, setPathSearchDepth] = useState<number>(3)
  const [intersectionMode, setIntersectionMode] = useState<boolean>(false)
  const [showSecondDegree, setShowSecondDegree] = useState<boolean>(true)

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
    if (hasUnknownTypeNodes) sortedTypes.push(UNKNOWN_NODE_TYPE)
    return sortedTypes
  }, [initialData])

  const allEdgeTypes = useMemo(() => {
    if (!initialData?.links) return []
    const types = new Set<string>()
    initialData.links.forEach((l) => {
      if (l.type) types.add(l.type)
    })
    return Array.from(types).sort()
  }, [initialData])

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
          .filter((node) => {
            const isUnknownNodeType =
              !node.type || node.type.trim().length === 0
            return (
              selectedTypes.size === 0 ||
              (isUnknownNodeType
                ? selectedTypes.has(UNKNOWN_NODE_TYPE)
                : selectedTypes.has(node.type as string))
            )
          })
          .map((n) => n.id)
      })
      .flat()

    return new Set(matches)
  }, [initialData, locateSearchQuery, selectedTypes])

  const filteredData = useMemo<networkData>(() => {
    if (!initialData || !initialData.nodes || !initialData.links) {
      return { nodes: [], links: [] }
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

    const evaluateNodeTypes = (node: node) => {
      const isUnknownNodeType = !node.type || node.type.trim().length === 0
      return (
        selectedTypes.size === 0 ||
        (isUnknownNodeType
          ? selectedTypes.has(UNKNOWN_NODE_TYPE)
          : selectedTypes.has(node.type as string))
      )
    }

    const evaluateLinkTypes = (link: link) => {
      return (
        selectedEdgeTypes.size === 0 ||
        (link.type && selectedEdgeTypes.has(link.type))
      )
    }

    let coreNodesToDisplay = new Set<string | number>()
    let finalConnectedNodeIDs = new Set<string | number>()
    let validLinks: link[] = []

    if (pathQueries.length > 0) {
      // Path Search Mode
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

      if (allPTargets.size > 1) {
        // Build adjacency list for BFS
        const adj = new Map<string | number, (string | number)[]>()
        initialData.links.forEach((l) => {
          if (!evaluateLinkTypes(l)) return
          const u = typeof l.source === "object" ? l.source.id : l.source
          const v = typeof l.target === "object" ? l.target.id : l.target
          if (!adj.has(u)) adj.set(u, [])
          if (!adj.has(v)) adj.set(v, [])
          adj.get(u)!.push(v)
          adj.get(v)!.push(u)
        })

        const targetArray = Array.from(allPTargets)
        const distances = new Map<
          string | number,
          Map<string | number, number>
        >()

        targetArray.forEach((t) => {
          const dist = new Map<string | number, number>()
          const queue: [string | number, number][] = [[t, 0]]
          dist.set(t, 0)

          let head = 0
          while (head < queue.length) {
            const [curr, d] = queue[head++]
            if (d >= pathSearchDepth) continue

            const neighbors = adj.get(curr) || []
            for (const n of neighbors) {
              if (!dist.has(n)) {
                dist.set(n, d + 1)
                queue.push([n, d + 1])
              }
            }
          }
          distances.set(t, dist)
        })

        const nodesOnPath = new Set<string | number>(allPTargets)

        targetArray.forEach((u, i) => {
          for (let j = i + 1; j < targetArray.length; j++) {
            const v = targetArray[j]
            const distU = distances.get(u)!
            const distV = distances.get(v)!

            distU.forEach((d_u, nodeX) => {
              if (distV.has(nodeX)) {
                const d_v = distV.get(nodeX)!
                if (d_u + d_v <= pathSearchDepth) {
                  nodesOnPath.add(nodeX)
                }
              }
            })
          }
        })

        nodesOnPath.forEach((n) => finalConnectedNodeIDs.add(n))
        allPTargets.forEach((n) => coreNodesToDisplay.add(n))

        validLinks = initialData.links.filter((link) => {
          if (!evaluateLinkTypes(link)) return false
          const sourceId =
            typeof link.source === "object" ? link.source.id : link.source
          const targetId =
            typeof link.target === "object" ? link.target.id : link.target
          return (
            finalConnectedNodeIDs.has(sourceId) &&
            finalConnectedNodeIDs.has(targetId)
          )
        })
      } else {
        // Fallback if only 1 target matched, just display it
        allPTargets.forEach((n) => coreNodesToDisplay.add(n))
        validLinks = [] // No connecting links for 1 node
      }
    } else if (queries.length > 0) {
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
          const sourceId =
            typeof link.source === "object" ? link.source.id : link.source
          const targetId =
            typeof link.target === "object" ? link.target.id : link.target

          if (matchSet.has(sourceId)) neighborSet.add(targetId)
          if (matchSet.has(targetId)) neighborSet.add(sourceId)
        })

        if (!showSecondDegree) return neighborSet

        const secondDegreeSet = new Set(neighborSet)
        initialData.links.forEach((link) => {
          if (!evaluateLinkTypes(link)) return
          const sourceId =
            typeof link.source === "object" ? link.source.id : link.source
          const targetId =
            typeof link.target === "object" ? link.target.id : link.target

          if (neighborSet.has(sourceId)) secondDegreeSet.add(targetId)
          if (neighborSet.has(targetId)) secondDegreeSet.add(sourceId)
        })
        return secondDegreeSet
      })

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

        const sourceId =
          typeof link.source === "object" ? link.source.id : link.source
        const targetId =
          typeof link.target === "object" ? link.target.id : link.target

        const isSourceRelevant =
          coreNodesToDisplay.has(sourceId) ||
          finalConnectedNodeIDs.has(sourceId)
        const isTargetRelevant =
          coreNodesToDisplay.has(targetId) ||
          finalConnectedNodeIDs.has(targetId)

        return isSourceRelevant && isTargetRelevant
      })
    } else {
      const validNodes = initialData.nodes.filter(evaluateNodeTypes)
      const validNodeIds = new Set(validNodes.map((n) => n.id))

      validLinks = initialData.links.filter((link) => {
        if (!evaluateLinkTypes(link)) return false

        const sourceId =
          typeof link.source === "object" ? link.source.id : link.source
        const targetId =
          typeof link.target === "object" ? link.target.id : link.target

        // FIX: Strictly require BOTH source and target to be in the valid node set
        return validNodeIds.has(sourceId) && validNodeIds.has(targetId)
      })

      coreNodesToDisplay = validNodeIds
    }

    const allDisplayedNodesIds = new Set([
      ...coreNodesToDisplay,
      ...finalConnectedNodeIDs,
    ])

    const bundledLinksMap = new Map<string, link>()
    validLinks.forEach((l) => {
      const sourceId = typeof l.source === "object" ? l.source.id : l.source
      const targetId = typeof l.target === "object" ? l.target.id : l.target
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
      ...initialData,
      nodes: filteredNodes.map((n) => ({ ...n })),
      links: finalLinks,
    }
  }, [
    initialData,
    minWeight,
    maxWeight,
    selectedTypes,
    selectedEdgeTypes,
    egoSearchQuery,
    intersectionMode,
    showSecondDegree,
  ])

  return {
    filteredData,
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
    intersectionMode,
    setIntersectionMode,
    showSecondDegree,
    setShowSecondDegree,
  }
}
