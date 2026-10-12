# Project tests

Every repeatable test belongs under `tests/`. Foundation/controller regression
checks live in `tests/foundation/`; specification-owned behavior lives in
`tests/product/`; reusable test data lives in `tests/fixtures/`.

After the operator supplies the full project specification, add the smallest
test that proves the first runnable slice. Mirror the real source/runtime
boundaries only when that improves discovery—do not create empty framework
trees or move diagnostics here merely because they share a language with the
tests.

Each claimed behavior should have a success path, its material failure path,
and the supported runtime/platform lane. Generated reports belong under
`.artifacts/proof/`. Runtime/share exports exclude this entire tree.
