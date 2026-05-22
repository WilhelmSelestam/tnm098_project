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
}: StarWarsNetworkProps) {
  const svgRef = useRef(null)

  useEffect(() => {
    if (!data || !data.nodes || !data.links || !svgRef.current) return

    const width = 1455
    const height = 814

    d3.select(svgRef.current).selectAll("*").remove()

    // Copy links so we don't mutate the original data
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

    // TypeScript might need any here if the types aren't perfectly matching, but doing it correctly:
    // @ts-ignore
    svg.call(zoom)

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

            // Handle bundled types by splitting the comma-separated string
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

    link.append("title").text((d) => {
      const sourceId = typeof d.source === "object" ? d.source.id : d.source
      const targetId = typeof d.target === "object" ? d.target.id : d.target
      return `${sourceId} - ${targetId}\nType: ${d.type}\nEdges bundled: ${d.count ?? 1}`
    })

    const node = mainGroup
      .append("g")
      .selectAll("circle")
      .data(nodes)
      .enter()
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

    node
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

      node.attr("cx", (d) => d.x ?? 0).attr("cy", (d) => d.y ?? 0)
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

    // 1. Calculate connections if a node is hovered
    if (hoveredNode) {
      connectedNodes.add(hoveredNode)
      svg.selectAll("line").each((d: any) => {
        const sourceId = typeof d.source === "object" ? d.source.id : d.source
        const targetId = typeof d.target === "object" ? d.target.id : d.target
        if (sourceId === hoveredNode) connectedNodes.add(targetId)
        if (targetId === hoveredNode) connectedNodes.add(sourceId)
      })
    }

    // 2. Apply combined styles to nodes
    svg
      .selectAll<SVGCircleElement, node>("circle")
      .attr("opacity", (d: any) => {
        // Dim if hovering, and this node isn't connected AND isn't explicitly highlighted
        if (
          hoveredNode &&
          !connectedNodes.has(d.id) &&
          !(hasHighlightQuery && highlightedNodeIDs.has(d.id))
        )
          return 0.1
        // Dim if we are searching for a highlight, and this node isn't it, and we aren't hovering
        if (hasHighlightQuery && !highlightedNodeIDs.has(d.id) && !hoveredNode)
          return 0.2
        return 1
      })
      .attr("stroke", (d: any) => {
        if (d.id === hoveredNode) return "white"
        if (hasHighlightQuery && highlightedNodeIDs.has(d.id)) return "#f59e0b" // Highlight color
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

    // 3. Apply combined styles to links
    svg.selectAll("line").attr("opacity", (d: any) => {
      if (hoveredNode) {
        const sourceId = typeof d.source === "object" ? d.source.id : d.source
        const targetId = typeof d.target === "object" ? d.target.id : d.target
        return sourceId === hoveredNode || targetId === hoveredNode ? 1 : 0.05
      }
      return 1
    })
  }, [hoveredNode, data, highlightedNodeIDs])

  const drag = (simulation: d3.Simulation<node, NormalizedLink>) => {
    function dragstarted(event: d3.D3DragEvent<SVGCircleElement, node, node>) {
      if (!event.active) simulation.alphaTarget(0.3).restart()
      event.subject.fx = event.subject.x
      event.subject.fy = event.subject.y
    }
    function dragged(event: d3.D3DragEvent<SVGCircleElement, node, node>) {
      event.subject.fx = event.x
      event.subject.fy = event.y
    }
    function dragended(event: d3.D3DragEvent<SVGCircleElement, node, node>) {
      if (!event.active) simulation.alphaTarget(0)
      event.subject.fx = null
      event.subject.fy = null
    }
    return d3
      .drag<SVGCircleElement, node>()
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
