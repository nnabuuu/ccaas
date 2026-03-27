import { SkillPanel } from '@/components/SkillPanel'
import { useChatCore } from '@/context/ChatCoreContext'

export function ChatInterfaceSkillPanel() {
  const { serverUrl, tenantId, apiKey, skillPanelOpen, setSkillPanelOpen } = useChatCore()

  return (
    <SkillPanel
      serverUrl={serverUrl}
      tenantId={tenantId}
      apiKey={apiKey}
      open={skillPanelOpen}
      onClose={() => setSkillPanelOpen(false)}
    />
  )
}
