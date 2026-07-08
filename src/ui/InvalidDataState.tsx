import { DataValidationError } from "../domain/validation";

export function InvalidDataState({ error }: { error: unknown }) {
  const issues = error instanceof DataValidationError ? error.issues : [String(error)];

  return (
    <section className="panel error-panel" role="alert">
      <p className="eyebrow">Application error</p>
      <h2>Connected Monitor v1 cannot load this view</h2>
      <ul>
        {issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
    </section>
  );
}
