# Runtime and generated-output ownership

Read this reference when adding background workers, IPC, long-lived test
services, or recurring generated output. Ordinary synchronous commands need
only the existing bounded task adapter.

## Processes

Use the project's existing launch/status/stop helpers. A long-running launch
records its project/run owner, intended lifetime, PID with creation time and
executable path, owned endpoints, output root, and shutdown method. Keep the
receipt under the project's ignored runtime root, not in tracked instructions.
Record any service deliberately left available and who owns stopping it.

The shipped `.tools/task-runner.ps1` contains Windows children in a Job Object
from process creation and bounds execution/output. Use it for bounded tasks.
Application services keep their own lifecycle owner; do not turn the task runner
into an always-running global supervisor. The optional global `runtime-check`
skill can inspect Windows identities/listeners without launching or stopping
anything. Existing project formats and commands remain authoritative.

For owned shutdown: stop admission, cancel work and blocking IPC, drain within a
deadline, apply only an authorized identity-checked fallback, then verify child
exit and endpoint release. Handle normal close, cancellation, errors and abrupt
launcher death. UI reload or a missing parent alone is not a shutdown contract.
Shared/persistent services require their client and lifetime rules to be checked.

Test these paths with disposable child processes and endpoints, including
startup failure, timeout, a descendant holding a pipe, stale identities and an
unrelated same-name process. Never use blanket executable-name termination.

## Files and capacity

Classify each growing output root by its producer, lifetime, retained evidence
or data, cleanup command, retention bound/review trigger, and rebuild cost.
Use existing configuration and the repository's artifacts/runtime paths. Absolute
machine overrides remain ignored operator state. A documented cache outside the
repository is not automatically a leak.

- Scratch: unique per-run directory; clean exact owned paths after completion,
  failure and cancellation within authorized scope. Recheck links and containment.
- Build/dependency cache: rebuildable, but retain active consumers and referenced
  release inputs; prefer native cleanup and compatible filesystem placement.
- Proof/releases: retain accepted/current evidence; review superseded bulky
  copies separately from compact receipts.
- Persistent data: preserve unless a specific reset/migration is authorized.

Ignored, old, or rebuildable does not mean disposable. Preserve unknown owners,
source edits, credentials and referenced evidence. Logs should have a justified
size/count policy where recurring growth is demonstrated. Review storage after
large milestones; no blanket pruning or automatic scheduler is implied.

Before closeout, account for resources created by the task: stopped/removed,
deliberately retained with an owner, or blocked with the exact reason and path.
Measure actual resource recovery when it is part of the outcome. Record process
and storage proof separately from static guidance or agent behavior.
