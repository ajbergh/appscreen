/**
 * Main application layout for the React editor.
 *
 * The app keeps the three original work zones from the vanilla implementation:
 * project/screenshot management on the left, the live canvas in the center, and
 * property controls on the right. State ownership stays outside this component;
 * it only composes the shell so each pane can subscribe to the Zustand slices it
 * needs.
 */
import { LeftSidebar } from './LeftSidebar';
import { CanvasArea } from './CanvasArea';
import { RightSidebar } from './RightSidebar';

/**
 * Renders the fixed three-column editor workspace.
 */
export function AppLayout() {
  return (
    <div className="app-container">
      <LeftSidebar />
      <CanvasArea />
      <RightSidebar />
    </div>
  );
}
