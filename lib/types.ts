import type * as d3 from "d3"

export interface NetworkNode extends d3.SimulationNodeDatum {
  id: string | number
  type?: string
  country?: string
  dataset?: string
}

export interface NetworkLink extends d3.SimulationLinkDatum<NetworkNode> {
  source: string | number | NetworkNode
  target: string | number | NetworkNode
  type?: string
  dataset?: string
  key?: number
  count?: number
}

export interface NetworkData {
  graph?: Record<string, unknown>
  links: NetworkLink[]
  nodes: NetworkNode[]
}
