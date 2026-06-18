import { useRef, useEffect } from 'react'
import type { ImperativePanelHandle } from 'react-resizable-panels'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { TitleBar } from './TitleBar'
import { MenuBar } from './MenuBar'
import { AppDialogs } from './AppDialogs'
import { StatusBar } from './StatusBar'
import { LeftPanel } from './LeftPanel'
import { MidPanel } from './MidPanel'
import { RightPanel } from './RightPanel'
import { BottomPanel } from './BottomPanel'
import { useLayoutStore } from '@/store/layout.store'
import { useMenuEvents } from '@/hooks/useMenuEvents'

const isMac = navigator.userAgent.includes('Mac')

export function AppLayout() {
  const bottomRef = useRef<ImperativePanelHandle>(null)
  const { bottomCollapsed, setBottomCollapsed } = useLayoutStore()
  useMenuEvents()

  useEffect(() => {
    if (bottomCollapsed) bottomRef.current?.collapse()
    else bottomRef.current?.expand()
  }, [bottomCollapsed])

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <TitleBar />
      {!isMac && <MenuBar />}
      <AppDialogs />

      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1 overflow-hidden"
        autoSaveId="jkauto-main-layout"
      >
        {/* Left: Explorer */}
        <ResizablePanel
          id="left"
          order={1}
          defaultSize={18}
          minSize={12}
          maxSize={32}
          className="bg-sidebar"
        >
          <LeftPanel />
        </ResizablePanel>

        <ResizableHandle />

        {/* Mid: Content + Bottom */}
        <ResizablePanel id="mid" order={2} defaultSize={62}>
          <ResizablePanelGroup direction="vertical" autoSaveId="jkauto-mid-layout">
            <ResizablePanel id="content" order={1} defaultSize={72} minSize={30}>
              <MidPanel />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel
              ref={bottomRef}
              id="bottom"
              order={2}
              defaultSize={28}
              minSize={4}
              maxSize={55}
              collapsible
              collapsedSize={4}
              onCollapse={() => setBottomCollapsed(true)}
              onExpand={() => setBottomCollapsed(false)}
            >
              <BottomPanel />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle />

        {/* Right: Jobs + Agent */}
        <ResizablePanel
          id="right"
          order={3}
          defaultSize={20}
          minSize={15}
          maxSize={36}
          className="bg-sidebar"
        >
          <RightPanel />
        </ResizablePanel>
      </ResizablePanelGroup>

      <StatusBar />
    </div>
  )
}
