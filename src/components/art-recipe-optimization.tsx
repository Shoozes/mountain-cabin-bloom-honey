import { useEffect, useRef, useState } from "react";
import { measureRecipe, optimizeRecipe, type ArtRecipe, type OptimizationReport, type RecipeMetrics } from "../../packages/grout-art/index.mjs";
export function ArtRecipeOptimization({ recipe, disabled }: { recipe: ArtRecipe; disabled: boolean }) {
  const active = useRef<AbortController | null>(null);
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  const [result, setResult] = useState<{ report: OptimizationReport; metrics: RecipeMetrics } | null>(null);
  useEffect(() => { active.current?.abort(); setPending(false); setResult(null); setError(""); return () => active.current?.abort(); }, [recipe]);
  async function check() {
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    setPending(true); setError(""); setResult(null);
    try {
      const optimized = await optimizeRecipe(recipe, { signal: controller.signal });
      const metrics = await measureRecipe(recipe, { signal: controller.signal });
      controller.signal.throwIfAborted();
      setResult({ report: optimized.report, metrics });
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause));
    } finally { if (active.current === controller) setPending(false); }
  }
  return <details className="art-inspector-section art-recipe-optimization">
    <summary>Lossless recipe optimization</summary>
    <p>Share repeated drawing data while retaining all editable layers, poses and source metadata. Atlas kits include the optimized copy and its verification report.</p>
    <button type="button" disabled={disabled || pending} onClick={() => void check()}>Check lossless optimization</button>
    {pending && <button type="button" onClick={() => { active.current?.abort(); setPending(false); }}>Cancel optimization</button>}
    {result && <div role="status">
      <p>{result.report.verifiedFrames} frames verified; exact authoring data restored.</p>
      <dl className="art-metric-list">
        <div><dt>Compact source</dt><dd>{result.report.sourceBytes.toLocaleString()} bytes</dd></div>
        <div><dt>Optimized copy</dt><dd>{result.report.optimizedBytes.toLocaleString()} bytes</dd></div>
        <div><dt>Source / optimized gzip</dt><dd>{result.metrics.gzipBytes.toLocaleString()} / {result.metrics.optimizedGzipBytes.toLocaleString()} bytes</dd></div>
        <div><dt>Shared SDK source</dt><dd>{result.metrics.runtimeBytes?.toLocaleString() ?? "unmeasured"} bytes</dd></div>
        <div><dt>Source / optimized + SDK gzip</dt><dd>{result.metrics.bundleGzipBytes?.toLocaleString() ?? "unmeasured"} / {result.metrics.optimizedBundleGzipBytes?.toLocaleString() ?? "unmeasured"} bytes</dd></div>
      </dl>
      {result.report.savedBytes === 0 && <p>Sharing adds overhead here; the original compact recipe is retained.</p>}
    </div>}
    {error && <p role="alert">Optimization failed; the editable source remains open. {error}</p>}
  </details>;
}
