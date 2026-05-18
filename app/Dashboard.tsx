"use client"

import Network from "./Network"
import { networkData, node } from "./page"
import { useState } from "react"
import { Slider } from "@/components/ui/slider"
import { useNetworkFilter } from "./useNetworkFilter"

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
  } = useNetworkFilter(data)

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

  return (
    <div
      className="flex flex-col h-screen"
      style={{ padding: "2rem", fontFamily: "sans-serif" }}
    >
      <h1>MC1 Knowledge Graph</h1>
      <p>
        Visualizing entities and relationships from the VAST 2023 MC1 dataset.
      </p>

      <div className="flex flex-col lg:flex-row mt-4 flex-grow gap-6 h-full overflow-hidden">
        {/* Sidebar Controls */}
        <div className="flex flex-col w-full lg:w-1/4 border-solid border-2 p-5 rounded-2xl bg-amber-50 text-black overflow-y-auto">
          <h2 className="text-xl font-bold mb-4 border-b pb-2">Filters</h2>

          {/* Search */}
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Search Entities</h3>
            <input
              type="text"
              placeholder="e.g. Mar de la Vida, Oceanfront"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-2 border rounded text-sm mb-2"
            />
            <p className="text-xs text-gray-500 mb-2">
              Tip: Separate multiple entities with commas.
            </p>
            <div className="flex items-center gap-2">
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
                Show Common Connections Only (Intersection)
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {allNodeTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`px-2 py-1 text-xs rounded-full border ${selectedTypes.has(type) ? "bg-blue-500 text-white border-blue-500" : "bg-white text-gray-700"}`}
                >
                  {type}
                </button>
              ))}
              {selectedTypes.size > 0 && (
                <button
                  onClick={() => setSelectedTypes(new Set())}
                  className="px-2 py-1 text-xs rounded-full border bg-red-100 text-red-700"
                >
                  Clear Types
                </button>
              )}
            </div>
          </div>

          {/* Edge Weight */}
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Edge Weight</h3>
            <div className="flex items-center gap-4 mb-2">
              <span className="text-sm font-medium">
                Min: {minWeight.toFixed(2)}
              </span>
              <span className="text-sm font-medium">
                Max: {maxWeight.toFixed(2)}
              </span>
            </div>
            <Slider
              className="w-full"
              value={[minWeight, maxWeight]}
              onValueChange={(values: number[]) =>
                interactionSliderChange(values)
              }
              max={1}
              step={0.01}
            />
          </div>

          {/* Info Panel */}
          <div className="mt-auto bg-white p-4 rounded border flex-grow overflow-y-auto">
            <h3 className="font-bold border-b pb-2 mb-2">Entity Details</h3>
            {selectedNodeDetails ? (
              <div className="text-sm break-words">
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

                {/* Find neighbors stats */}
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

        {/* Network View */}
        <div className="w-full bg-gray-900 rounded-2xl flex items-center justify-center overflow-hidden border-2">
          <Network
            data={filteredData}
            hoveredNode={hoveredNode}
            setHoveredNode={setHoveredNode}
            force={100}
          />
        </div>
      </div>
    </div>
  )
}
