export interface Category {
  id: string
  name: string
  icon: string
  color: string
  deleted_at?: string | null
}

export interface Item {
  id: string
  name: string
  description: string | null
  category_id: string | null
  stock: number
  image_url: string | null
  created_at: string
  deleted_at?: string | null
  carbon_kg_per_item?: number | null
  carbon_kg_total?: number | null
  carbon_summary?: string | null
  categories?: Category | null
}

export interface Group {
  id: string
  name: string
  member_count: number
  created_at: string
}

export interface Log {
  id: string
  item_id: string
  direction: 'in' | 'out'
  amount: number
  comment: string | null
  group_id: string | null
  condition: 'good' | 'fair' | 'poor' | null
  created_at: string
  items?: (Item & { categories?: Category | null }) | null
  groups?: Group | null
}

export interface GroupStats extends Group {
  items_taken: number
  items_given: number
  total_movements: number
}
