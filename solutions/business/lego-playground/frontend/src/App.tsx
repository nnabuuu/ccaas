import React, { useCallback, useEffect } from 'react';
import { useMosaicStore } from './hooks/useStore';
import { useCatalog } from './hooks/useCatalog';
import { useMosaicSync } from './hooks/useMosaicSync';
import Header from './components/Header';
import ConfigPanel from './components/config/ConfigPanel';
import CanvasWorkspace from './components/canvas/CanvasWorkspace';
import ChatPanel from './components/chat/ChatPanel';

export default function App() {
  const sessionId = useMosaicStore((s) => s.sessionId);
  const currentIteration = useMosaicStore((s) => s.currentIteration);
  const maxIterations = useMosaicStore((s) => s.maxIterations);
  const generationStatus = useMosaicStore((s) => s.generationStatus);
  const resetAll = useMosaicStore((s) => s.resetAll);
  const setSessionId = useMosaicStore((s) => s.setSessionId);

  useCatalog();
  const { sendMessage, chat } = useMosaicSync(sessionId);

  const handleNewSession = useCallback(() => {
    resetAll();
    const newId = `lego-${Date.now().toString(36)}`;
    setSessionId(newId);
  }, [resetAll, setSessionId]);

  useEffect(() => {
    if (!sessionId) handleNewSession();
  }, [sessionId, handleNewSession]);

  return (
    <div className="h-screen flex flex-col bg-zinc-50 overflow-hidden">
      <Header
        sessionId={sessionId}
        currentIteration={currentIteration}
        maxIterations={maxIterations}
        status={generationStatus}
        onNewSession={handleNewSession}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Config Panel */}
        <div className="w-72 flex-shrink-0 border-r border-zinc-200 bg-white overflow-y-auto">
          <ConfigPanel />
        </div>

        {/* Center: Canvas Workspace */}
        <div className="flex-1 flex flex-col min-w-0 bg-zinc-100">
          <CanvasWorkspace />
        </div>

        {/* Right: Chat Panel */}
        <div className="w-96 flex-shrink-0 border-l border-zinc-200 bg-white flex flex-col">
          <ChatPanel sendMessage={sendMessage} messages={chat.messages} isProcessing={chat.isProcessing} />
        </div>
      </div>
    </div>
  );
}
