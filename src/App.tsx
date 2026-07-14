import { Link, Outlet } from "react-router-dom";

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-content">
          <p className="eyebrow">Connected Monitor v1</p>
          <h1>External Account Signal Monitor</h1>
          <p className="header-subtitle">
            Local monitoring of active registered public sources. This is not full external-world coverage.
          </p>
          <div className="header-pills" aria-label="Product boundaries">
            <span>Evidence first</span>
            <span>Local runtime</span>
            <span>No intent claims</span>
          </div>
          <nav className="header-pills" aria-label="Product views">
            <Link to="/">V1 monitor</Link>
            <Link to="/research">Autonomous research</Link>
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
