import React from 'react';
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '@/components/resizable/resizable';
import { SidePanel } from './side-panel/side-panel';
import { Canvas } from './canvas/canvas';
import { useLayout } from '@/hooks/use-layout';
import type { Diagram } from '@/lib/domain/diagram';
import { SidebarProvider } from '@/components/sidebar/sidebar';

export interface EditorDesktopLayoutProps {
    initialDiagram?: Diagram;
}
export const EditorDesktopLayout: React.FC<EditorDesktopLayoutProps> = ({
    initialDiagram,
}) => {
    const { isSidePanelShowed } = useLayout();

    return (
        <SidebarProvider
            defaultOpen={false}
            open={false}
            className="h-full min-h-0"
        >
            {/* <EditorSidebar /> */}
            <ResizablePanelGroup direction="horizontal">
                <ResizablePanel
                    defaultSize={0}
                    minSize={0}
                    maxSize={isSidePanelShowed ? 99 : 0}
                    // className={cn('transition-[flex-grow] duration-200', {
                    //     'min-w-[350px]': isSidePanelShowed,
                    // })}
                >
                    <SidePanel />
                </ResizablePanel>
                <ResizableHandle
                    disabled={!isSidePanelShowed}
                    className={!isSidePanelShowed ? 'hidden' : ''}
                />
                <ResizablePanel defaultSize={100}>
                    <Canvas initialTables={initialDiagram?.tables ?? []} />
                </ResizablePanel>
            </ResizablePanelGroup>
        </SidebarProvider>
    );
};

export default EditorDesktopLayout;
