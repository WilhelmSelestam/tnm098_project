import { promises as fs } from "fs"
import path from "path"
import Dashboard from "./Dashboard"

export interface link extends d3.SimulationLinkDatum<node> {
  source: string | number | node
  target: string | number | node
  type?: string
  dataset?: string
  key?: number
  count?: number
}

export interface node extends d3.SimulationNodeDatum {
  id: string | number
  type?: string
  country?: string
  dataset?: string
}

export type networkData = {
  directed?: boolean
  multigraph?: boolean
  graph?: any
  links: link[]
  nodes: node[]
}

export default async function Home() {
  const data: networkData = JSON.parse(
    await fs.readFile("./public/MC1.json", "utf8"),
  )

  // console.log(episodeNetworkData)

  return <Dashboard data={data} />
}
