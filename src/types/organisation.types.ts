import type { PositionMode } from "@/core/entity/entity"

export type OrganisationType =
  | "holding"
  | "company"
  | "factory"
  | "design_bureau"
  | "research_institute"
  | "export_agency"
  | "state_corporation"
  | "government_agency"
  | "logistics_hub"
  | "test_facility"
  | "other"

export const ORGANISATION_TYPES: OrganisationType[] = [
  "holding",
  "company",
  "factory",
  "design_bureau",
  "research_institute",
  "export_agency",
  "state_corporation",
  "government_agency",
  "logistics_hub",
  "test_facility",
  "other",
]

export const ORGANISATION_TYPE_LABELS: Record<OrganisationType, string> = {
  holding: "Holding / Conglomerate",
  company: "Company / Subsidiary",
  factory: "Factory / Plant",
  design_bureau: "Design Bureau",
  research_institute: "Research Institute",
  export_agency: "Export Agency",
  state_corporation: "State Corporation",
  government_agency: "Government Agency",
  logistics_hub: "Logistics Hub",
  test_facility: "Test / Proving Facility",
  other: "Other",
}

export type Organisation = {
  id: string
  name: string
  type: OrganisationType
  parentId: string | null
  notes: string | null
  sources: string | null
  osmRelationId: number | null
  positionMode: PositionMode
  isExactPosition: boolean
}

export const INDUSTRY_LAYER_ID = "industry"
