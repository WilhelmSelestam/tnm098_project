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

  const [showArrows, setShowArrows] = useState<boolean>(true)
  const [showLabels, setShowLabels] = useState<boolean>(false)

  const [showWeirdRelationships, setShowWeirdRelationships] =
    useState<boolean>(false)
  const [showCircularRelationships, setShowCircularRelationships] =
    useState<boolean>(false)

  const [linkTypeForces, setLinkTypeForces] = useState<Record<string, number>>(
    {},
  )

  const selectedNodeDetails = hoveredNode
    ? data.nodes.find((n: node) => n.id === hoveredNode)
    : null

  const {
    filteredData,
    highlightedPathLinks,
    matchedNodeIDs,
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
  } = useNetworkFilter(data)

  useEffect(() => {
    if (!allEdgeTypes || allEdgeTypes.length === 0) return
    setLinkTypeForces((prev) => {
      const next = { ...prev }
      allEdgeTypes.forEach((t) => {
        if (next[t] == null) next[t] = 0.04
      })
      return next
    })
  }, [allEdgeTypes])

  const setLinkTypeForce = (type: string, value: number) => {
    setLinkTypeForces((prev) => ({ ...prev, [type]: value }))
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

              <input
                type="checkbox"
                id="showSecondDegree"
                checked={showSecondDegree}
                onChange={(e) => setShowSecondDegree(e.target.checked)}
                className="ml-4"
              />
              <label
                htmlFor="showSecondDegree"
                className="text-sm cursor-pointer select-none"
              >
                2nd Degree
              </label>
            </div>

            <h3 className="font-semibold mb-2">Locate & Highlight Nodes</h3>
            <input
              type="text"
              placeholder="e.g. Mar de la Vida, Oceanfront"
              value={locateSearchQuery}
              onChange={(e) => setLocateSearchQuery(e.target.value)}
              className="w-full p-2 border rounded text-sm mb-4"
            />

            <h3 className="font-semibold mb-2">Path Search (Connect Nodes)</h3>
            <input
              type="text"
              placeholder="e.g. Mar de la Vida, Oceanfront"
              value={pathSearchQuery}
              onChange={(e) => setPathSearchQuery(e.target.value)}
              className="w-full p-2 border rounded text-sm mb-2"
            />

            <div className="flex flex-wrap items-center gap-2 mb-4 mt-2">
              <div className="w-full flex items-center mb-1">
                <label htmlFor="pathSearchDepth" className="text-sm w-36">
                  Max Depth (Hops):
                </label>
                <input
                  type="number"
                  id="pathSearchDepth"
                  value={pathSearchDepth}
                  min={1}
                  max={6}
                  onChange={(e) =>
                    setPathSearchDepth(parseInt(e.target.value) || 1)
                  }
                  className="w-16 p-1 border rounded text-sm"
                />
              </div>

              <div className="w-full flex items-center mb-2">
                <label htmlFor="maxPathsCount" className="text-sm w-36">
                  Max # Paths To Display:
                </label>
                <input
                  type="number"
                  id="maxPathsCount"
                  value={maxPathsCount}
                  min={1}
                  max={10}
                  onChange={(e) =>
                    setMaxPathsCount(parseInt(e.target.value) || 1)
                  }
                  className="w-16 p-1 border rounded text-sm"
                />
              </div>

              <div className="w-full flex items-center gap-2 mt-1">
                <input
                  type="checkbox"
                  id="showPathNeighbors"
                  checked={showPathNeighbors}
                  onChange={(e) => setShowPathNeighbors(e.target.checked)}
                />
                <label
                  htmlFor="showPathNeighbors"
                  className="text-sm cursor-pointer select-none"
                >
                  Show Connected Neighbor Nodes
                </label>
              </div>
            </div>

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
                          {(linkTypeForces[type] ?? 0.04).toFixed(2)}
                        </span>
                      </div>
                      <Slider
                        value={[linkTypeForces[type] ?? 0.04]}
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
          <div className="mt-6 pt-4 border-t">
            <h3 className="font-semibold mb-2">Visual Settings</h3>
            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="showArrows"
                checked={showArrows}
                onChange={(e) => setShowArrows(e.target.checked)}
              />
              <label
                htmlFor="showArrows"
                className="text-sm cursor-pointer select-none"
              >
                Show Arrowheads
              </label>

              <input
                type="checkbox"
                id="showLabels"
                checked={showLabels}
                onChange={(e) => setShowLabels(e.target.checked)}
                className="ml-4"
              />
              <label
                htmlFor="showLabels"
                className="text-sm cursor-pointer select-none"
              >
                Show Node IDs
              </label>
            </div>
            <div className="flex items-center gap-2 w-full mt-2">
              <input
                type="checkbox"
                id="showWeird"
                checked={showWeirdRelationships}
                onChange={(e) => setShowWeirdRelationships(e.target.checked)}
              />
              <label
                htmlFor="showWeird"
                className="text-sm cursor-pointer select-none text-amber-600"
              >
                Highlight Weird Relations
              </label>
            </div>

            <div className="flex items-center gap-2 w-full">
              <input
                type="checkbox"
                id="showCircular"
                checked={showCircularRelationships}
                onChange={(e) => setShowCircularRelationships(e.target.checked)}
              />
              <label
                htmlFor="showCircular"
                className="text-sm cursor-pointer select-none text-red-600"
              >
                Detect Circular Entities
              </label>
            </div>
          </div>
          <div className="mt-auto bg-white p-4 rounded border">
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
              <p className="text-sm text-gray-500 italic"></p>
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
            showArrows={showArrows}
            showLabels={showLabels}
            force={100}
            linkTypeForces={linkTypeForces}
            highlightedNodeIDs={matchedNodeIDs}
            highlightedPathLinks={highlightedPathLinks}
            showWeirdRelationships={showWeirdRelationships}
            showCircularRelationships={showCircularRelationships}
          />
        </div>
      </div>
    </div>
  )
}
