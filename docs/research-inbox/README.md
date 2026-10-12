# Research inbox

This project-owned folder is a temporary intake lane for raw research notes,
source reviews, external recommendations, and design feedback. It is not a
progress log, a second TODO list, or a place for credentials.

Only open this route when there is an actual note to process. Use the
`research-inbox-review` workflow before accepting a claim that could change
source, tests, safety policy, dependencies, or project direction.

## Intake and ingestion

1. Name a note `YYYY-MM-DD-HHMM[-topic].md` and preserve enough source context
   to distinguish evidence from recommendation or speculation.
2. Classify the note as implemented state, forward work, pitfall, policy,
   contract, test gap, dependency candidate, external-runtime blocker, or a
   rejected idea.
3. Check it against the project safety and runtime-proof boundaries before
   changing behavior.
4. Move the accepted decision to exactly one durable owner: `docs/work/queue/`
   for selected executable work, `docs/TODO.md` for future work,
   status/review/history for completed state, a focused user
   or subsystem document for operating guidance, `docs/PITFALLS.md` for a
   recurring hazard, or source/tests for a locally provable contract.
5. Update `summary_bank.json` only when the decision introduces a durable
   feature, issue, subsystem, or proof route. Do not create a duplicate group
   for a one-off note.
6. Remove a fully ingested note in the same change. If only part is ingested,
   add a short review-status block naming what remains.

## Boundaries

- Keep every queue item actionable: What, Why, When, Where, How, Done when, and
  Verification. Keep future TODO entries concise until selected.
- Keep raw or unreviewed research out of runtime exports. Developer shares may
  retain tracked intake material for collaborators.
- Never put credentials, access tokens, model files, live captures, or other
  operator-private data here. Use ignored `.tools/secrets/` for credentials and
  `.artifacts/` for retained local output; neither is read into context or
  evidence.
- Do not claim runtime proof, publication readiness, or support based only on a
  research note.

## Partial-review marker

Use this at the top of a note that remains in the inbox:

```markdown
## Review status

- Status: unreviewed | partially-ingested | blocked | ready-to-remove
- Reviewed on: YYYY-MM-DD
- Ingested into: queue | TODO | status | pitfall | focused doc | summary bank | tests
- Remaining: evidence, decision, or follow-up still required
```
