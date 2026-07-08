import { Outlet } from "react-router-dom";

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Connected Monitor v1</p>
          <h1>External Account Signal Monitor</h1>
          <p className="header-subtitle">
            Local monitoring of active registered public sources. This is not full external-world coverage.
          </p>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
