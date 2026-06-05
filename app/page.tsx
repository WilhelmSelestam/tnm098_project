import { promises as fs } from "fs"
import Dashboard from "./Dashboard"
import { NetworkData, NetworkNode, NetworkLink } from "@/lib/types"

export default async function Home() {
  const fileContent = await fs.readFile("./public/MC1.json", "utf8")
  const data: NetworkData = JSON.parse(fileContent)

  return <Dashboard data={data} />
}
export type { NetworkData }
export type {
  NetworkNode as node,
  NetworkLink as link,
  NetworkData as networkData,
}
