import { DataValidationError } from "../domain/validation";

export function InvalidDataState({ error }: { error: unknown }) {
  const issues = error instanceof DataValidationError ? error.issues : [String(error)];

  return (
    <section className="panel error-panel" role="alert">
      <p className="eyebrow">Invalid fixture data</p>
      <h2>Foundation v0 cannot load this dataset</h2>
      <ul>
        {issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
    </section>
  );
}
