"use client"

import { Dispatch, SetStateAction, useEffect, useRef } from "react"
import * as d3 from "d3"
import { node, networkData, link } from "./page"

type StarWarsNetworkProps = {
  data: networkData
  hoveredNode?: string | null
  setHoveredNode?: Dispatch<SetStateAction<string | null>>
  force: number
}

type NormalizedLink = d3.SimulationLinkDatum<node> & {
  source: string | number | node
  target: string | number | node
  type?: string
  weight?: number
  dataset?: string
}

export default function StarWarsNetwork({
  data,
  hoveredNode,
  setHoveredNode,
  force,
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
        setHoveredNode?.(null)
      })

    const simulation = d3
      .forceSimulation<node, NormalizedLink>(nodes)
      .force(
        "link",
        d3
          .forceLink<node, NormalizedLink>(links)
          .id((d) => d.id as number | string),
      )
      .force("charge", d3.forceManyBody().strength(-force))
      .force("center", d3.forceCenter(width / 2, height / 2))

    const link = svg
      .append("g")
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", "#6666")
      // use weight for thickness if available
      .attr("stroke-width", (d) => Math.sqrt(Math.sqrt(d.weight ?? 1)))

    link.append("title").text((d) => {
      const sourceId = typeof d.source === "object" ? d.source.id : d.source
      const targetId = typeof d.target === "object" ? d.target.id : d.target
      return `${sourceId} - ${targetId}\nType: ${d.type}\nWeight: ${d.weight}`
    })

    const node = svg
      .append("g")
      .selectAll("circle")
      .data(nodes)
      .enter()
      .append("circle")
      // adjust radius to be uniform for now, can be configured later
      .attr("r", 5)
      // color by type
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
        event.stopPropagation() // no svg background click
        setHoveredNode?.((prev) => (prev === d.id ? null : (d.id as string)))
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
  }, [data, setHoveredNode, force])

  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)

    if (!hoveredNode) {
      svg
        .selectAll<SVGCircleElement, node>("circle")
        .attr("opacity", 1)
        .attr("stroke", null)
        .attr("stroke-width", null)
        .attr("r", 5)
      svg.selectAll("line").attr("opacity", 1)
      return
    }

    const connectedNodes = new Set<string | number>()
    connectedNodes.add(hoveredNode)

    svg.selectAll("line").each((d: any) => {
      const sourceId = typeof d.source === "object" ? d.source.id : d.source
      const targetId = typeof d.target === "object" ? d.target.id : d.target
      if (sourceId === hoveredNode) connectedNodes.add(targetId)
      if (targetId === hoveredNode) connectedNodes.add(sourceId)
    })

    svg
      .selectAll("circle")
      .attr("opacity", (d: any) => (connectedNodes.has(d.id) ? 1 : 0.1))
      .attr("stroke", (d: any) => (d.id === hoveredNode ? "white" : null))
      .attr("stroke-width", (d: any) => (d.id === hoveredNode ? 2 : null))
      .attr("r", (d: any) => {
        const baseRadius = 5
        return d.id === hoveredNode ? baseRadius + 3 : baseRadius
      })

    svg.selectAll("line").attr("opacity", (d: any) => {
      const sourceId = typeof d.source === "object" ? d.source.id : d.source
      const targetId = typeof d.target === "object" ? d.target.id : d.target
      return sourceId === hoveredNode || targetId === hoveredNode ? 1 : 0.05
    })
  }, [hoveredNode, data])

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
