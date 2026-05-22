"use client"

import Network from "./Network"
import { networkData, node } from "./page"
import { useState, useEffect } from "react"
import { Slider } from "@/components/ui/slider"
import { UNKNOWN_NODE_TYPE, useNetworkFilter } from "./useNetworkFilter"

type DashboardProps = {
  data: networkData
}

export default function Dashboard({ data }: DashboardProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)

  // Get node details for sidebar
  const selectedNodeDetails = hoveredNode
    ? data.nodes.find((n: node) => n.id === hoveredNode)
    : null

  const {
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
    intersectionMode,
    setIntersectionMode,
  } = useNetworkFilter(data)

  const [linkTypeForces, setLinkTypeForces] = useState<Record<string, number>>(
    {},
  )

  useEffect(() => {
    if (!allEdgeTypes || allEdgeTypes.length === 0) return
    setLinkTypeForces((prev) => {
      const next = { ...prev }
      allEdgeTypes.forEach((t) => {
        if (next[t] == null) next[t] = 0.2
      })
      return next
    })
  }, [allEdgeTypes])

  const setLinkTypeForce = (type: string, value: number) => {
    setLinkTypeForces((prev) => ({ ...prev, [type]: value }))
  }

  function interactionSliderChange(numbers: number[]) {
    setMinWeight(numbers[0])
    setMaxWeight(numbers[1])
  }

  const toggleType = (type: string) => {
    const next = new Set(selectedTypes)
    if (next.has(type)) {
      next.delete(type)
    } else {
      next.add(type)
    }
    setSelectedTypes(next)
  }

  const renderNodeTypeLabel = (type: string) =>
    type === UNKNOWN_NODE_TYPE ? "Unknown / No type" : type

  const toggleEdgeType = (type: string) => {
    const next = new Set(selectedEdgeTypes)
    if (next.has(type)) {
      next.delete(type)
    } else {
      next.add(type)
    }
    setSelectedEdgeTypes(next)
  }

  const handleDoubleClickNode = (nodeId: string) => {
    setEgoSearchQuery((prev) => {
      const parts = prev
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
      const alreadyIncluded = parts.some(
        (p) => p.toLowerCase() === nodeId.toLowerCase(),
      )
      if (!alreadyIncluded) {
        return prev ? `${prev}, ${nodeId}` : String(nodeId)
      }
      return prev
    })
  }

  return (
    <div
      className="flex flex-col h-screen"
      style={{ padding: "2rem", fontFamily: "sans-serif" }}
    >
      <div className="flex flex-col lg:flex-row mt-4 grow gap-6 h-full overflow-hidden">
        <div className="flex flex-col w-full lg:w-1/4 border-solid border-2 p-5 rounded-2xl bg-amber-50 text-black overflow-y-auto">
          <h2 className="text-xl font-bold mb-4 border-b pb-2">Filters</h2>

          <div className="mb-6">
            <h3 className="font-semibold mb-2">Ego-Network Search</h3>
            <input
              type="text"
              placeholder="e.g. Mar de la Vida, Oceanfront"
              value={egoSearchQuery}
              onChange={(e) => setEgoSearchQuery(e.target.value)}
              className="w-full p-2 border rounded text-sm mb-2"
            />
            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="intersectionMode"
                checked={intersectionMode}
                onChange={(e) => setIntersectionMode(e.target.checked)}
              />
              <label
                htmlFor="intersectionMode"
                className="text-sm cursor-pointer select-none"
              >
                Intersection
              </label>
            </div>

            <h3 className="font-semibold mb-2">Locate & Highlight Nodes</h3>
            <input
              type="text"
              placeholder="e.g. Mar de la Vida, Oceanfront"
              value={locateSearchQuery}
              onChange={(e) => setLocateSearchQuery(e.target.value)}
              className="w-full p-2 border rounded text-sm mb-2"
            />

            <div className="flex flex-wrap gap-2 mt-4">
              <h4 className="text-sm font-semibold w-full">Node Types:</h4>
              {allNodeTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`px-2 py-1 text-xs rounded-full border ${selectedTypes.has(type) ? "bg-blue-500 text-white border-blue-500" : "bg-white text-gray-700"}`}
                >
                  {renderNodeTypeLabel(type)}
                </button>
              ))}
              {selectedTypes.size > 0 && (
                <button
                  onClick={() => setSelectedTypes(new Set())}
                  className="px-2 py-1 text-xs rounded-full border bg-red-100 text-red-700"
                >
                  Clear Node Types
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <h4 className="text-sm font-semibold w-full">Edge Types:</h4>
              {allEdgeTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => toggleEdgeType(type)}
                  className={`px-2 py-1 text-xs rounded-full border ${selectedEdgeTypes.has(type) ? "bg-green-500 text-white border-green-500" : "bg-white text-gray-700"}`}
                >
                  {type}
                </button>
              ))}
              {selectedEdgeTypes.size > 0 && (
                <button
                  onClick={() => setSelectedEdgeTypes(new Set())}
                  className="px-2 py-1 text-xs rounded-full border bg-red-100 text-red-700"
                >
                  Clear Edge Types
                </button>
              )}
            </div>
            {allEdgeTypes.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold mb-2">
                  Link Strengths (per type)
                </h4>
                <div className="space-y-3">
                  {allEdgeTypes.map((type) => (
                    <div key={`force-${type}`} className="text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="truncate mr-2">{type}</span>
                        <span className="text-xs text-gray-600">
                          {(linkTypeForces[type] ?? 0.2).toFixed(2)}
                        </span>
                      </div>
                      <Slider
                        value={[linkTypeForces[type] ?? 0.2]}
                        onValueChange={(vals: number[]) =>
                          setLinkTypeForce(type, vals[0])
                        }
                        min={0}
                        max={1}
                        step={0.01}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="mt-auto bg-white p-4 rounded border grow overflow-y-auto">
            <h3 className="font-bold border-b pb-2 mb-2">Entity Details</h3>
            {selectedNodeDetails ? (
              <div className="text-sm wrap-break-word">
                <p>
                  <strong>ID:</strong> {selectedNodeDetails.id}
                </p>
                <p>
                  <strong>Type:</strong> {selectedNodeDetails.type || "Unknown"}
                </p>
                {selectedNodeDetails.country && (
                  <p>
                    <strong>Country:</strong> {selectedNodeDetails.country}
                  </p>
                )}

                <p className="mt-2">
                  <strong>Connections in view:</strong>{" "}
                  {filteredData.links.reduce((acc, l) => {
                    const sourceId =
                      typeof l.source === "object" ? l.source.id : l.source
                    const targetId =
                      typeof l.target === "object" ? l.target.id : l.target
                    return (
                      acc +
                      (sourceId === selectedNodeDetails.id ||
                      targetId === selectedNodeDetails.id
                        ? 1
                        : 0)
                    )
                  }, 0)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">
                Click or hover (if implemented) a node in the graph to see
                details.
              </p>
            )}
          </div>

          <div className="mt-4 pt-4 border-t text-sm text-gray-500">
            Nodes: {filteredData.nodes.length} | Edges:{" "}
            {filteredData.links.length}
          </div>
        </div>

        <div className="w-full bg-gray-900 rounded-2xl flex items-center justify-center overflow-hidden border-2">
          <Network
            data={filteredData}
            hoveredNode={hoveredNode}
            setHoveredNode={setHoveredNode}
            onDoubleClickNode={handleDoubleClickNode}
            force={100}
            linkTypeForces={linkTypeForces}
            highlightedNodeIDs={matchedNodeIDs}
          />
        </div>
      </div>
    </div>
  )
}
