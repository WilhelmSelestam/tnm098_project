"use client"

import { Dispatch, SetStateAction, useEffect, useRef } from "react"
import * as d3 from "d3"
import { NetworkData, NetworkNode, NetworkLink } from "@/lib/types"
import {
  getEntityId,
  findCircularRelationships,
  isWeirdRelationship,
  isHighlightedPath,
} from "@/lib/graphAlgorithms"

export type NetworkProps = {
  data: NetworkData
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

/**
 * Visualizes the entity relationship network graph using D3.js force-directed simulation inside an SVG canvas.
 * Implements zooming, dragging, type-based link forces, circular ownership/membership detection,
 * and visual highlighting.
 */
export default function Network({
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
}: NetworkProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!data || !data.nodes || !data.links || !svgRef.current) return

    const width = 2230 //1455
    const height = 1300 //814

    // Clean up any existing elements before redrawing
    d3.select(svgRef.current).selectAll("*").remove()

    // Create shallow copies of links and nodes to preserve raw state across simulation ticks
    const links: NetworkLink[] = data.links.map((d) => ({ ...d }))
    const nodes: NetworkNode[] = data.nodes.map((d) => ({ ...d }))

    const svg = d3
      .select<SVGSVGElement, unknown>(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .style("background-color", "#111")
      .on("click", () => {
        setHoveredNode(null)
      })

    const mainGroup = svg.append("g").attr("class", "main-group")

    // Configure zooming behaviors on the outer SVG canvas
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on("zoom", (event) => {
        mainGroup.attr("transform", event.transform)
      })

    svg.call(zoom)

    // Setup multiple arrow markers for different link highlight colors
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
    createMarker("arrowhead-blue", "#3b82f6")

    const defaultLinkStrength = 0.1

    // Initialize D3 Force-Directed Simulation
    const simulation = d3
      .forceSimulation<NetworkNode, NetworkLink>(nodes)
      .force(
        "link",
        d3
          .forceLink<NetworkNode, NetworkLink>(links)
          .id((d) => d.id as number | string)
          .strength((l) => {
            if (!l.type) return defaultLinkStrength

            const types = l.type.split(",").map((t) => t.trim())
            let totalForce = 0
            let count = 0

            types.forEach((t) => {
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

    // Draw links
    const linkElements = mainGroup
      .append("g")
      .selectAll<SVGLineElement, NetworkLink>("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", "#6666")
      .attr("stroke-width", (d) => Math.max(1, d.count ?? 1))
      .attr("marker-end", "url(#arrowhead)")

    linkElements.append("title").text((d) => {
      const sourceId = getEntityId(d.source)
      const targetId = getEntityId(d.target)
      return `${sourceId} - ${targetId}\nType: ${d.type}\nEdges bundled: ${d.count ?? 1}`
    })

    // Draw node containers with drag handles
    const nodeGroupElements = mainGroup
      .append("g")
      .attr("class", "nodes")
      .selectAll<SVGGElement, NetworkNode>("g.node-group")
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

    // Style the circular node nodes based on entity types
    nodeGroupElements
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

    // Add identifier text to the nodes
    nodeGroupElements
      .append("text")
      .text((d) => String(d.id))
      .attr("x", 8)
      .attr("y", "0.31em")
      .style("font-size", "10px")
      .style("fill", "#ccc")
      .style("pointer-events", "none")

    nodeGroupElements
      .append("title")
      .text(
        (d) =>
          `${d.id}\nType: ${d.type || "Unknown"}\nCountry: ${d.country || "N/A"}`,
      )

    // Tick callback updates node and link positions dynamically
    simulation.on("tick", () => {
      linkElements
        .attr("x1", (d) => (d.source as NetworkNode).x ?? 0)
        .attr("y1", (d) => (d.source as NetworkNode).y ?? 0)
        .attr("x2", (d) => (d.target as NetworkNode).x ?? 0)
        .attr("y2", (d) => (d.target as NetworkNode).y ?? 0)

      nodeGroupElements.attr(
        "transform",
        (d) => `translate(${d.x ?? 0},${d.y ?? 0})`,
      )
    })

    return () => {
      simulation.stop()
    }
  }, [data, setHoveredNode, onDoubleClickNode, force, linkTypeForces])

  // Effect to apply dynamic visual highlights on hover or search query changes
  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)

    const hasHighlightQuery = highlightedNodeIDs && highlightedNodeIDs.size > 0
    const connectedNodes = new Set<string | number>()

    if (hoveredNode) {
      connectedNodes.add(hoveredNode)
      svg.selectAll<SVGLineElement, NetworkLink>("line").each((d) => {
        const sourceId = getEntityId(d.source)
        const targetId = getEntityId(d.target)
        if (sourceId === hoveredNode) connectedNodes.add(targetId)
        if (targetId === hoveredNode) connectedNodes.add(sourceId)
      })
    }

    svg
      .selectAll<SVGGElement, NetworkNode>("g.node-group")
      .attr("opacity", () => 1)

    // Adjust stroke and radius of circles based on selection/highlights
    svg
      .selectAll<SVGCircleElement, NetworkNode>("g.node-group circle")
      .attr("stroke", (d) => {
        if (d.id === hoveredNode) return "white"
        if (hasHighlightQuery && highlightedNodeIDs.has(d.id)) return "#f59e0b"
        return null
      })
      .attr("stroke-width", (d) => {
        if (d.id === hoveredNode) return 2
        if (hasHighlightQuery && highlightedNodeIDs.has(d.id)) return 3
        return null
      })
      .attr("r", (d) => {
        const isHighlighted = hasHighlightQuery && highlightedNodeIDs.has(d.id)
        const baseRadius = isHighlighted ? 7 : 5
        return d.id === hoveredNode ? baseRadius + 3 : baseRadius
      })

    // Compute circular relationship cycles via Tarjan's algorithm
    const linksArray: NetworkLink[] = []
    svg.selectAll<SVGLineElement, NetworkLink>("line").each((d) => {
      linksArray.push(d)
    })
    const cyclicLinks = showCircularRelationships
      ? findCircularRelationships(linksArray)
      : new Set<NetworkLink>()

    // Apply styles (opacity, color, thickness, and dashed outlines) to links
    svg
      .selectAll<SVGLineElement, NetworkLink>("line")
      .attr("opacity", (d) => {
        if (hoveredNode) {
          const sourceId = getEntityId(d.source)
          const targetId = getEntityId(d.target)
          return sourceId === hoveredNode || targetId === hoveredNode ? 1 : 0.05
        }
        return 1
      })
      .attr("stroke", (d) => {
        if (showCircularRelationships && cyclicLinks.has(d)) return "#ef4444"
        if (isHighlightedPath(d, highlightedPathLinks)) return "#3b82f6"
        return "#6666" // Base color
      })
      .attr("stroke-width", (d) => {
        const baseWidth = Math.max(1, d.count ?? 1)
        if (showCircularRelationships && cyclicLinks.has(d))
          return baseWidth + 2
        if (showWeirdRelationships && isWeirdRelationship(d))
          return baseWidth + 1
        if (isHighlightedPath(d, highlightedPathLinks)) return baseWidth + 1
        return baseWidth
      })
      .attr("stroke-dasharray", (d) => {
        if (showWeirdRelationships && isWeirdRelationship(d)) return "5,5"
        return "none"
      })
      .attr("marker-end", (d) => {
        if (!showArrows) return null
        if (showCircularRelationships && cyclicLinks.has(d))
          return "url(#arrowhead-red)"
        if (isHighlightedPath(d, highlightedPathLinks))
          return "url(#arrowhead-blue)"
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
    linkTypeForces,
    force,
    onDoubleClickNode,
  ])

  return (
    <div className="network-container">
      <svg ref={svgRef}></svg>
    </div>
  )
}

/**
 * Static utility function to configure D3 drag gestures for network nodes.
 * Declared at the module level to avoid hoisting and closure re-creation issues inside React.
 */
function drag(simulationInstance: d3.Simulation<NetworkNode, NetworkLink>) {
  function dragstarted(
    event: d3.D3DragEvent<SVGGElement, NetworkNode, NetworkNode>,
  ) {
    if (!event.active) simulationInstance.alphaTarget(0.3).restart()
    event.subject.fx = event.subject.x
    event.subject.fy = event.subject.y
  }
  function dragged(
    event: d3.D3DragEvent<SVGGElement, NetworkNode, NetworkNode>,
  ) {
    event.subject.fx = event.x
    event.subject.fy = event.y
  }
  function dragended(
    event: d3.D3DragEvent<SVGGElement, NetworkNode, NetworkNode>,
  ) {
    if (!event.active) simulationInstance.alphaTarget(0)
    event.subject.fx = null
    event.subject.fy = null
  }
  return d3
    .drag<SVGGElement, NetworkNode>()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended)
}
