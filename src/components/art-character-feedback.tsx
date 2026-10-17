import { rateCharacter, type CharacterDocument } from "../../packages/grout-art/index.mjs";

export function ArtCharacterFeedback({ document, onChange, onError }: {
  document: CharacterDocument; onChange: (next: CharacterDocument) => void; onError: (error: unknown) => void;
}) {
  const feedback = document.creator.feedback ?? { enabled: true, ratings: [] };
  function rate(decision: "keep" | "reject") {
    try { onChange(rateCharacter(document, decision)); } catch (error) { onError(error); }
  }
  return <section className="art-character-feedback" aria-label="Generation feedback">
    <div className="art-character-actions">
      <button type="button" onClick={() => rate("keep")}>Keep this look</button>
      <button type="button" onClick={() => rate("reject")}>Reject this look</button>
    </div>
    <label><input type="checkbox" checked={feedback.enabled} onChange={event => onChange({ ...document, creator: { ...document.creator, feedback: { ...feedback, enabled: event.currentTarget.checked } } })} /> Use my preferences</label>
    <p className="art-craft-note">{feedback.ratings.filter(r => r.decision === "keep").length} kept · {feedback.ratings.filter(r => r.decision === "reject").length} rejected. Future rolls favor similar kept choices and skip rejected combinations.</p>
    {feedback.ratings.length > 0 && <details><summary>Review history</summary><ol>{feedback.ratings.map((rating, index) => <li key={rating.key}>
      <span>{rating.decision === "keep" ? "Kept" : "Rejected"} · {rating.selection.build} / {rating.selection.style} / {rating.selection.palette}</span>
      <div className="art-character-actions"><button type="button" onClick={() => onChange({ ...document, ...rating.selection })} aria-label={`Restore reviewed look ${index + 1}`}>Restore</button>
        <button type="button" onClick={() => onChange({ ...document, creator: { ...document.creator, feedback: { ...feedback, ratings: feedback.ratings.filter(r => r.key !== rating.key) } } })} aria-label={`Remove review ${index + 1}`}>Remove review</button></div>
    </li>)}</ol></details>}
  </section>;
}
