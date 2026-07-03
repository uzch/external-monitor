import { Link, useSearchParams } from "react-router-dom";
import { getApplicationServices } from "../services/applicationServices";
import { rankingRuleSummary } from "../services/rankingConfig";
import { formatDate, formatScore } from "./format";
import { InvalidDataState } from "./InvalidDataState";

export function PortfolioPage() {
  try {
    const { portfolioService } = getApplicationServices();
    const [searchParams, setSearchParams] = useSearchParams();
    const scopeId = searchParams.get("scope") ?? portfolioService.getDefaultScopeId();
    const portfolio = portfolioService.getPortfolio(scopeId);

    return (
      <section className="page-grid">
        <div className="panel controls-panel">
          <label htmlFor="scope-select">Hierarchy scope</label>
          <select
            id="scope-select"
            value={portfolio.selectedScope.id}
            onChange={(event) => setSearchParams({ scope: event.target.value })}
          >
            {portfolio.scopeOptions.map((scope) => (
              <option key={scope.id} value={scope.id}>
                {scope.pathLabel}
              </option>
            ))}
          </select>
          <div className="scope-meta">
            <span>{portfolio.selectedScope.level}</span>
            <strong>{portfolio.selectedScope.pathLabel}</strong>
          </div>
        </div>

        <div className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Ranked mapped accounts</p>
              <h2>{portfolio.accounts.length} accounts in scope</h2>
            </div>
            <p className="ranking-note">{rankingRuleSummary}</p>
          </div>

          {portfolio.hasIncompleteMapping ? (
            <div className="notice" role="status">
              Mapped accounts only. Some loaded mappings are illustrative or partial, so this view
              does not claim complete territory coverage or account ownership.
            </div>
          ) : (
            <div className="notice muted" role="status">
              Validated loaded mapping. This is still limited to the synthetic fixture scope.
            </div>
          )}

          {portfolio.emptyReason ? (
            <div className="empty-state">{portfolio.emptyReason}</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Hierarchy path</th>
                    <th>Rank score</th>
                    <th>Highest priority</th>
                    <th>Latest qualifying event</th>
                    <th>Signals</th>
                    <th>Mapping</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.accounts.map((rankedAccount) => (
                    <tr key={rankedAccount.account.id}>
                      <td>
                        <Link
                          to={`/accounts/${rankedAccount.account.id}?scope=${portfolio.selectedScope.id}`}
                          className="account-link"
                        >
                          {rankedAccount.account.name}
                        </Link>
                        <span>{rankedAccount.account.sector}</span>
                      </td>
                      <td>{rankedAccount.hierarchyPaths.join("; ")}</td>
                      <td>{formatScore(rankedAccount.rankingScore)}</td>
                      <td>{formatScore(rankedAccount.highestPriority)}</td>
                      <td>
                        {rankedAccount.latestQualifyingEvent ? (
                          <>
                            <strong>{rankedAccount.latestQualifyingEvent.title}</strong>
                            <span>
                              {formatDate(rankedAccount.latestQualifyingEvent.publicationDate)}
                            </span>
                          </>
                        ) : (
                          <span className="muted-text">No qualifying signal</span>
                        )}
                      </td>
                      <td>
                        {rankedAccount.signalCount} total /{" "}
                        {rankedAccount.qualifyingSignalCount} qualifying
                      </td>
                      <td>
                        <span className={`badge ${rankedAccount.mappingStatus}`}>
                          {rankedAccount.mappingLabel}
                        </span>
                        <span>{rankedAccount.mappingDetail}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    );
  } catch (error) {
    return <InvalidDataState error={error} />;
  }
}
