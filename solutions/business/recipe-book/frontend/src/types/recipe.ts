export interface Recipe {
  id: string
  title: string
  cuisine: string
  difficulty: string
  prep_time: number
  cook_time: number
  servings: number
  status: string
  blocks: Block[]
}

export interface Block {
  type: 'section' | 'text' | 'ingredient' | 'list' | 'timeline' | 'table' | 'callout'
  content: Record<string, unknown>
}

export interface IngredientItem {
  name: string
  amount: string
  note?: string
}
