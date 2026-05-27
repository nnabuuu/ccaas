import { createContext, useContext } from 'react'
import type { WorkspaceTabKey } from '../lib/dynamic-tabs'

/**
 * ChatBridge — surface for non-chat components (audit report renderer,
 * future deep-link patterns) to drive the left-side AiPanel and the
 * workspace-tab switcher.
 *
 * Why a context: the audit report renderer is rendered deep inside
 * the dynamic-tab content area, but `action://` / `nav://` link
 * targets live in the top-level ProjectEditorPage (which owns the
 * tabs state + AiPanel reference). A context lets us reach across
 * the tree without prop-drilling through 4 layers.
 *
 * Implementation contract — `null` value means "no bridge available
 * in this render tree" (e.g. unit tests of the renderer in isolation).
 * Consumers should treat absent bridge as "render links as inert"
 * (the same fallback the renderer used before chat-bridge existed).
 */

export interface ChatBridge {
  /**
   * Fill the left-side AiPanel input with `text` and auto-submit.
   * Returns immediately; the actual LLM response stream is handled
   * by the chat hook inside AiPanel.
   */
  sendMessage(text: string): void

  /**
   * Switch the active workspace tab. Optional `anchor` will eventually
   * scroll the target tab to a specific step / req id — for v1 it's
   * accepted but unused (tab switch only).
   */
  switchToWorkspace(key: WorkspaceTabKey, anchor?: string): void
}

export const ChatBridgeContext = createContext<ChatBridge | null>(null)

/** Hook accessor. Returns null when not provided. */
export function useChatBridge(): ChatBridge | null {
  return useContext(ChatBridgeContext)
}
