import { useMemo, useState } from "react";
import {
  ART_WORKBENCH_EXAMPLES,
  GROUT_LIBRARY_COMMIT,
  GROUT_LIBRARY_EXAMPLE_GROUPS,
  GROUT_LIBRARY_EXAMPLES,
  type ArtWorkbenchExample,
  type DonorExample,
} from "@/art/examples.mjs";
import "@/art/studio.css";

type Migration = "all" | "migrated" | "partial" | "source-only";
const BASE_URL = import.meta.env.BASE_URL;

function appPath(path: string) {
  return `${BASE_URL}${path.replace(/^\/+/, "")}`;
}

function includesText(value: string, query: string) {
  return value.toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

function ExampleRow({ example }: { example: ArtWorkbenchExample | DonorExample }) {
  const local = "workflow" in example;
  const launchId = local ? example.id : example.localExampleId;
  const source = local ? undefined : example.sourceUrl;
  const sourcePath = local ? undefined : example.sourcePath;
  const status = local ? "migrated" : example.migration;
  const backends = example.backends.join(" · ");

  return (
    <li className="art-example-row">
      <div className="art-example-copy">
        <div className="art-example-name-line">
          <h3>{example.title}</h3>
          <span className={`art-status art-status-${status}`}>{status}</span>
        </div>
        <p>{example.summary}</p>
        <div className="art-example-facts">
          <span>{local ? `Workflow: ${example.workflow}` : `Group: ${example.primaryGroup}`}</span>
          <span>Backends: {backends}</span>
          <span>{example.tags.join(" · ")}</span>
        </div>
        {source && sourcePath && (
          <p className="art-example-source">
            Source <a href={source} target="_blank" rel="noreferrer">{sourcePath}</a> · Grout-Library {GROUT_LIBRARY_COMMIT}
          </p>
        )}
        <p className="art-example-provenance">{example.provenance}</p>
      </div>
      {launchId ? (
        <a className="art-row-action" href={appPath(`studio?example=${encodeURIComponent(launchId)}`)}>
          Open local example
        </a>
      ) : (
        <span className="art-source-only">Source only</span>
      )}
    </li>
  );
}

export function ArtExamples() {
  const [query, setQuery] = useState("");
  const [workflow, setWorkflow] = useState("all");
  const [backend, setBackend] = useState("all");
  const [migration, setMigration] = useState<Migration>("all");
  const q = query.trim();

  const localItems = useMemo(() => ART_WORKBENCH_EXAMPLES.filter((example) => {
    const text = `${example.title} ${example.summary} ${example.workflow} ${example.tags.join(" ")} ${example.provenance}`;
    return (!q || includesText(text, q))
      && (workflow === "all" || example.workflow === workflow)
      && (backend === "all" || example.backends.includes(backend))
      && (migration === "all" || migration === "migrated");
  }), [backend, migration, q, workflow]);

  const donorItems = useMemo(() => GROUT_LIBRARY_EXAMPLES.filter((example) => {
    const text = `${example.title} ${example.summary} ${example.primaryGroup} ${example.tags.join(" ")} ${example.backends.join(" ")} ${example.sourcePath}`;
    return (!q || includesText(text, q))
      && (workflow === "all" || example.primaryGroup === workflow)
      && (backend === "all" || example.backends.includes(backend))
      && (migration === "all" || example.migration === migration);
  }), [backend, migration, q, workflow]);

  const backends = useMemo(() => [...new Set([
    ...ART_WORKBENCH_EXAMPLES.flatMap((example) => example.backends),
    ...GROUT_LIBRARY_EXAMPLES.flatMap((example) => example.backends),
  ])].sort(), []);
  const total = localItems.length + donorItems.length;

  return (
    <main className="art-examples">
      <header className="art-page-head">
        <div>
          <p className="art-eyebrow">Grout Art · catalog</p>
          <h1>Examples and techniques</h1>
          <p className="art-page-intro">
            Six working local recipes lead the catalog. The remaining pages are indexed as study references with their original group, backend needs and migration state.
          </p>
        </div>
        <nav aria-label="Art tools" className="art-page-nav">
          <a href={appPath("studio")}>Open Studio</a>
          <a href={appPath("")}>Texture mill</a>
        </nav>
      </header>

      <section className="art-catalog-controls" aria-label="Filter examples">
        <label className="art-search-field">
          <span>Search examples and techniques</span>
          <input value={query} onChange={(event) => setQuery(event.currentTarget.value)} type="search" placeholder="atlas, palette, WebGPU…" />
        </label>
        <label>
          <span>Workflow</span>
          <select value={workflow} onChange={(event) => setWorkflow(event.currentTarget.value)}>
            <option value="all">All workflows</option>
            {ART_WORKBENCH_EXAMPLES.map((example) => (
              <option key={example.workflow} value={example.workflow}>{example.workflow}</option>
            ))}
            {GROUT_LIBRARY_EXAMPLE_GROUPS.map((group) => (
              <option key={group.id} value={group.id}>{group.title}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Backend</span>
          <select value={backend} onChange={(event) => setBackend(event.currentTarget.value)}>
            <option value="all">Any backend</option>
            {backends.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>Migration</span>
          <select value={migration} onChange={(event) => setMigration(event.currentTarget.value as Migration)}>
            <option value="all">All states</option>
            <option value="migrated">Working local</option>
            <option value="partial">Partly rebuilt</option>
            <option value="source-only">Source only</option>
          </select>
        </label>
        <p className="art-result-count" aria-live="polite">{total} matching entries · {GROUT_LIBRARY_EXAMPLES.length} donor pages inventoried</p>
      </section>

      {localItems.length > 0 && (
        <section className="art-list-section" aria-labelledby="local-recipes-title">
          <div className="art-section-heading">
            <h2 id="local-recipes-title">Local workbench examples</h2>
            <span>Editable recipes · local renderers · current implementation</span>
          </div>
          <ul className="art-example-list">
            {localItems.map((example) => <ExampleRow key={example.id} example={example} />)}
          </ul>
        </section>
      )}

      {donorItems.length > 0 && (
        <section className="art-list-section" aria-labelledby="donor-title">
          <div className="art-section-heading">
            <h2 id="donor-title">Grout-Library study index</h2>
            <span>Read-only donor references · commit {GROUT_LIBRARY_COMMIT}</span>
          </div>
          <ul className="art-example-list">
            {donorItems.map((example) => <ExampleRow key={example.id} example={example} />)}
          </ul>
        </section>
      )}

      {total === 0 && <p className="art-empty-state">No examples match those filters. Clear a filter or search a broader technique.</p>}
    </main>
  );
}
