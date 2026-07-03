import { Outlet } from "react-router-dom";

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Foundation v0</p>
          <h1>External Account Signal Monitor</h1>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
