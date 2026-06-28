import { LeftSidebar } from './LeftSidebar';
import { CanvasArea } from './CanvasArea';
import { RightSidebar } from './RightSidebar';

export function AppLayout() {
  return (
    <div className="app-container">
      <LeftSidebar />
      <CanvasArea />
      <RightSidebar />
    </div>
  );
}
