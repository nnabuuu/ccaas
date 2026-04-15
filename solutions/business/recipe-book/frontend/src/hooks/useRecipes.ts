import { useState, useEffect, useCallback } from 'react'
import type { Recipe } from '../types/recipe'
import { RECIPE_BACKEND_URL } from '../config'

export function useRecipes(q?: string) {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRecipes = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      const url = `${RECIPE_BACKEND_URL}/api/recipes${params.toString() ? `?${params}` : ''}`
      const res = await fetch(url)
      const data = await res.json()
      setRecipes(Array.isArray(data) ? data : data.items ?? data.data ?? [])
    } catch {
      setRecipes([])
    } finally {
      setLoading(false)
    }
  }, [q])

  useEffect(() => {
    fetchRecipes()
  }, [fetchRecipes])

  return { recipes, loading, refresh: fetchRecipes }
}

export function useRecipe(id: string | undefined) {
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [document, setDocument] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)

    const recipeReq = fetch(`${RECIPE_BACKEND_URL}/api/recipes/${id}`)
      .then((r) => r.ok ? r.json() : null)
    const docReq = fetch(`${RECIPE_BACKEND_URL}/context/entity/recipe/${id}/document`)
      .then((r) => r.json())
      .catch(() => null)

    Promise.all([recipeReq, docReq])
      .then(([recipeData, docData]) => {
        setRecipe(recipeData && recipeData.id ? recipeData : null)
        setDocument(docData?.document ?? null)
      })
      .catch(() => {
        setRecipe(null)
        setDocument(null)
      })
      .finally(() => setLoading(false))
  }, [id])

  return { recipe, document, loading }
}
