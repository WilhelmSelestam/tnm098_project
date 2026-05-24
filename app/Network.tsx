"use client"

import { Dispatch, SetStateAction, useEffect, useRef } from "react"
import * as d3 from "d3"
import { node, networkData, link } from "./page"

type StarWarsNetworkProps = {
  data: networkData
  hoveredNode?: string | null
  setHoveredNode: Dispatch<SetStateAction<string | null>>
  onDoubleClickNode?: (nodeId: string) => void
  force: number
  linkTypeForces?: Record<string, number>
  highlightedNodeIDs?: Set<string | number>
  highlightedPathLinks?: Set<string>
  showArrows?: boolean
  showLabels?: boolean
  showWeirdRelationships?: boolean
  showCircularRelationships?: boolean
}

type NormalizedLink = d3.SimulationLinkDatum<node> & {
  source: string | number | node
  target: string | number | node
  type?: string
  weight?: number
  dataset?: string
  count?: number
}

export default function StarWarsNetwork({
  data,
  hoveredNode,
  setHoveredNode,
  onDoubleClickNode,
  force,
  linkTypeForces,
  highlightedNodeIDs,
  highlightedPathLinks,
  showArrows = true,
  showLabels = false,
  showWeirdRelationships = false,
  showCircularRelationships = false,
}: StarWarsNetworkProps) {
  const svgRef = useRef(null)

  useEffect(() => {
    if (!data || !data.nodes || !data.links || !svgRef.current) return

    const width = 1455
    const height = 814

    d3.select(svgRef.current).selectAll("*").remove()

    const links: NormalizedLink[] = data.links.map((d) => ({ ...d }))
    const nodes = data.nodes.map((d) => ({ ...d }))

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .style("background-color", "#111")
      .on("click", () => {
        setHoveredNode(null)
      })

    const mainGroup = svg.append("g").attr("class", "main-group")

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on("zoom", (event) => {
        mainGroup.attr("transform", event.transform)
      })

    // @ts-ignore
    svg.call(zoom)

    // Setup multiple arrow markers for different line colors
    const defs = svg.append("defs")
    const createMarker = (id: string, color: string) => {
      defs
        .append("marker")
        .attr("id", id)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 20)
        .attr("refY", 0)
        .attr("orient", "auto")
        .attr("markerWidth", 8)
        .attr("markerHeight", 8)
        .attr("markerUnits", "userSpaceOnUse")
        .attr("xoverflow", "visible")
        .append("svg:path")
        .attr("d", "M 0,-5 L 10 ,0 L 0,5")
        .attr("fill", color)
        .style("stroke", "none")
    }

    createMarker("arrowhead", "#666")
    createMarker("arrowhead-red", "#ef4444")
    // createMarker("arrowhead-amber", "#666") //"#f59e0b")
    createMarker("arrowhead-blue", "#3b82f6")

    const defaultLinkStrength = 0.1

    const simulation = d3
      .forceSimulation<node, NormalizedLink>(nodes)
      .force(
        "link",
        d3
          .forceLink<node, NormalizedLink>(links)
          .id((d) => d.id as number | string)
          .strength((l: any) => {
            if (!l.type) return defaultLinkStrength

            const types = l.type.split(",").map((t: string) => t.trim())
            let totalForce = 0
            let count = 0

            types.forEach((t: string) => {
              if (linkTypeForces && linkTypeForces[t] != null) {
                totalForce += linkTypeForces[t]
                count++
              }
            })

            const v = count > 0 ? totalForce / count : defaultLinkStrength
            return Math.max(0.0001, v)
          }),
      )
      .force("charge", d3.forceManyBody().strength(-force))
      .force("center", d3.forceCenter(width / 2, height / 2))

    const link = mainGroup
      .append("g")
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", "#6666")
      .attr("stroke-width", (d) => Math.max(1, d.count ?? 1))
      .attr("marker-end", "url(#arrowhead)")

    link.append("title").text((d) => {
      const sourceId = typeof d.source === "object" ? d.source.id : d.source
      const targetId = typeof d.target === "object" ? d.target.id : d.target
      return `${sourceId} - ${targetId}\nType: ${d.type}\nEdges bundled: ${d.count ?? 1}`
    })

    const nodeGroup = mainGroup
      .append("g")
      .attr("class", "nodes")
      .selectAll("g.node-group")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "node-group")
      .style("cursor", "pointer")
      .call(drag(simulation))
      .on("click", (event, d) => {
        event.stopPropagation()
        setHoveredNode((prev) => (prev === d.id ? null : (d.id as string)))
      })
      .on("dblclick", (event, d) => {
        event.stopPropagation()
        onDoubleClickNode?.(String(d.id))
      })

    const node = nodeGroup
      .append("circle")
      .attr("r", 5)
      .attr("fill", (d) => {
        switch (d.type) {
          case "person":
            return "#ff7f0e"
          case "organization":
            return "#1f77b4"
          case "company":
            return "#2ca02c"
          case "political_organization":
            return "#d62728"
          case "location":
            return "#9467bd"
          case "vessel":
            return "#8c564b"
          case "event":
            return "#e377c2"
          case "movement":
            return "#7f7f7f"
          default:
            return "#fff"
        }
      })

    nodeGroup
      .append("text")
      .text((d) => String(d.id))
      .attr("x", 8)
      .attr("y", "0.31em")
      .style("font-size", "10px")
      .style("fill", "#ccc")
      .style("pointer-events", "none")

    nodeGroup
      .append("title")
      .text(
        (d) =>
          `${d.id}\nType: ${d.type || "Unknown"}\nCountry: ${d.country || "N/A"}`,
      )

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as node).x ?? 0)
        .attr("y1", (d) => (d.source as node).y ?? 0)
        .attr("x2", (d) => (d.target as node).x ?? 0)
        .attr("y2", (d) => (d.target as node).y ?? 0)

      nodeGroup.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    return () => {
      simulation.stop()
    }
  }, [data, setHoveredNode, onDoubleClickNode, force, linkTypeForces])

  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)

    const hasHighlightQuery = highlightedNodeIDs && highlightedNodeIDs.size > 0
    const connectedNodes = new Set<string | number>()

    if (hoveredNode) {
      connectedNodes.add(hoveredNode)
      svg.selectAll("line").each((d: any) => {
        const sourceId = typeof d.source === "object" ? d.source.id : d.source
        const targetId = typeof d.target === "object" ? d.target.id : d.target
        if (sourceId === hoveredNode) connectedNodes.add(targetId)
        if (targetId === hoveredNode) connectedNodes.add(sourceId)
      })
    }

    svg
      .selectAll<SVGGElement, node>("g.node-group")
      .attr("opacity", (d: any) => {
        if (
          hoveredNode &&
          !connectedNodes.has(d.id) &&
          !(hasHighlightQuery && highlightedNodeIDs.has(d.id))
        )
          return 1
        if (hasHighlightQuery && !highlightedNodeIDs.has(d.id) && !hoveredNode)
          return 1
        return 1
      })

    svg
      .selectAll<SVGCircleElement, node>("g.node-group circle")
      .attr("stroke", (d: any) => {
        if (d.id === hoveredNode) return "white"
        if (hasHighlightQuery && highlightedNodeIDs.has(d.id)) return "#f59e0b"
        return null
      })
      .attr("stroke-width", (d: any) => {
        if (d.id === hoveredNode) return 2
        if (hasHighlightQuery && highlightedNodeIDs.has(d.id)) return 3
        return null
      })
      .attr("r", (d: any) => {
        const isHighlighted = hasHighlightQuery && highlightedNodeIDs.has(d.id)
        const baseRadius = isHighlighted ? 7 : 5
        return d.id === hoveredNode ? baseRadius + 3 : baseRadius
      })

    // --- ALGORITHMS: Detect Circular and Weird Relationships ---

    const cyclicLinks = new Set<any>()
    if (showCircularRelationships) {
      const adj = new Map<string | number, any[]>()
      const nodesInvolved = new Set<string | number>()

      svg.selectAll("line").each((d: any) => {
        const types = (d.type || "")
          .toLowerCase()
          .split(",")
          .map((x: string) => x.trim())
        if (types.includes("ownership") || types.includes("membership")) {
          const sourceId = typeof d.source === "object" ? d.source.id : d.source
          const targetId = typeof d.target === "object" ? d.target.id : d.target
          if (!adj.has(sourceId)) adj.set(sourceId, [])
          adj.get(sourceId)!.push({ target: targetId, link: d })
          nodesInvolved.add(sourceId)
          nodesInvolved.add(targetId)
        }
      })

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

        if (lowlinks.get(v) === indices.get(v)) {
          const scc: (string | number)[] = []
          let w: string | number
          do {
            w = stack.pop()!
            onStack.delete(w)
            scc.push(w)
          } while (w !== v)
          if (scc.length > 1) {
            sccs.push(scc)
          }
        }
      }

      for (const v of nodesInvolved) {
        if (!indices.has(v)) strongconnect(v)
      }

      const sccMap = new Map<string | number, number>()
      sccs.forEach((scc, i) => {
        scc.forEach((node) => sccMap.set(node, i))
      })

      svg.selectAll("line").each((d: any) => {
        const sourceId = typeof d.source === "object" ? d.source.id : d.source
        const targetId = typeof d.target === "object" ? d.target.id : d.target
        if (
          sccMap.has(sourceId) &&
          sccMap.has(targetId) &&
          sccMap.get(sourceId) === sccMap.get(targetId)
        ) {
          cyclicLinks.add(d)
        }
      })
    }

    const isWeirdRelationship = (d: any) => {
      const s = typeof d.source === "object" ? d.source : null
      const t = typeof d.target === "object" ? d.target : null
      if (!s || !t) return false

      const sourceType = (s.type || "").toLowerCase()
      const targetType = (t.type || "").toLowerCase()
      const linkTypes = (d.type || "")
        .toLowerCase()
        .split(",")
        .map((x: string) => x.trim())

      for (const linkType of linkTypes) {
        if (
          (linkType === "ownership" || linkType === "membership") &&
          targetType === "person"
        ) {
          if (
            ["company", "organization", "political_organization"].includes(
              sourceType,
            )
          )
            return true
        }
        if (
          linkType === "family_relationship" &&
          (sourceType !== "person" || targetType !== "person")
        ) {
          return true
        }
        if (linkType === "ownership" && sourceType === "vessel") {
          return true
        }
      }
      return false
    }

    // Determine if this exact path should be blue
    const isHighlightedPath = (d: any) => {
      if (!highlightedPathLinks) return false
      const sourceId = typeof d.source === "object" ? d.source.id : d.source
      const targetId = typeof d.target === "object" ? d.target.id : d.target
      return (
        highlightedPathLinks.has(`${sourceId}->${targetId}`) ||
        highlightedPathLinks.has(`${targetId}->${sourceId}`)
      )
    }

    // Apply combined styles to links
    svg
      .selectAll("line")
      .attr("opacity", (d: any) => {
        if (hoveredNode) {
          const sourceId = typeof d.source === "object" ? d.source.id : d.source
          const targetId = typeof d.target === "object" ? d.target.id : d.target
          return sourceId === hoveredNode || targetId === hoveredNode ? 1 : 0.05
        }
        return 1
      })
      .attr("stroke", (d: any) => {
        if (showCircularRelationships && cyclicLinks.has(d)) return "#ef4444"
        // if (showWeirdRelationships && isWeirdRelationship(d)) return "#6666" //"#f59e0b"
        if (isHighlightedPath(d)) return "#3b82f6"
        return "#6666" // Base color
      })
      .attr("stroke-width", (d: any) => {
        const baseWidth = Math.max(1, d.count ?? 1)
        if (showCircularRelationships && cyclicLinks.has(d))
          return baseWidth + 2
        if (showWeirdRelationships && isWeirdRelationship(d))
          return baseWidth + 1
        if (isHighlightedPath(d)) return baseWidth + 1
        return baseWidth
      })
      .attr("stroke-dasharray", (d: any) => {
        if (showWeirdRelationships && isWeirdRelationship(d)) return "5,5"
        return "none"
      })
      .attr("marker-end", (d: any) => {
        if (!showArrows) return null
        if (showCircularRelationships && cyclicLinks.has(d))
          return "url(#arrowhead-red)"
        // if (showWeirdRelationships && isWeirdRelationship(d))
        //   return "url(#arrowhead-amber)"
        if (isHighlightedPath(d)) return "url(#arrowhead-blue)"
        return "url(#arrowhead)"
      })

    svg
      .selectAll("g.node-group text")
      .style("display", showLabels ? "block" : "none")
  }, [
    hoveredNode,
    data,
    highlightedNodeIDs,
    highlightedPathLinks,
    showArrows,
    showLabels,
    showWeirdRelationships,
    showCircularRelationships,
  ])

  const drag = (simulation: d3.Simulation<node, NormalizedLink>) => {
    function dragstarted(event: d3.D3DragEvent<SVGGElement, node, node>) {
      if (!event.active) simulation.alphaTarget(0.3).restart()
      event.subject.fx = event.subject.x
      event.subject.fy = event.subject.y
    }
    function dragged(event: d3.D3DragEvent<SVGGElement, node, node>) {
      event.subject.fx = event.x
      event.subject.fy = event.y
    }
    function dragended(event: d3.D3DragEvent<SVGGElement, node, node>) {
      if (!event.active) simulation.alphaTarget(0)
      event.subject.fx = null
      event.subject.fy = null
    }
    return d3
      .drag<SVGGElement, node>()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended)
  }

  return (
    <div className="network-container">
      <svg ref={svgRef}></svg>
    </div>
  )
}
