# Reproducible synthetic simulations

The suite in `tests/test_seeded_simulations.cjs` runs **6,000 independent seeded cases**.
The default seed is `0x45524153`; the fixed reference date is November 5, 2026.

```sh
node --test tests/test_seeded_simulations.cjs
```

| Family | Cases | Independent expectations |
| --- | ---: | --- |
| Identity details | 2,400 | Valid canonical values, Gregorian calendar/adult-range oracle, Unicode normalization, exact field union and native requirement combinations, malformed descriptors, secret-free failures |
| Workspace workflows | 1,200 | Explicit consent, profile/receipt drift, held/paused requests, failed persistence, one-shot references, replay refusal, imported-proof downgrade, forged-outcome rejection and transient-only identity values |
| Cleanup plans | 2,400 | JSON/quoted CSV roundtrips, unsafe URL/credential rejection, own-action/export/closure gates, non-mutating reducers, untrusted histories and separate search-result/source outcomes |

Each case receives fresh synthetic values or state. A case is counted once even when
it checks several invariants. The three Node tests group the cases to keep CI output
short; their diagnostics state the counts. Failures identify the seed, family and case
index so the same input can be reproduced. Generated names, addresses, emails, phone
numbers and URLs are synthetic; no live person or broker request is involved.

The requirements oracle treats the approved method as a set of supplied fields and
checks it against native required flags. The date oracle uses a Gregorian month table
and birthday comparison independently from the production validator's Date roundtrip.
Workflow fixtures begin from an explicit synthetic authenticated-continuation state;
they do not authenticate real mail. Restored backups are tested through the real import
path and may not restore trusted proof. Every workflow preserves the synthetic
USPhonebook hold and verifies that no submission is promoted to accepted or deleted.

These tests run locally with no network, inbox connection, browser navigation, paid
service or scheduled work. They exercise deterministic validators and state machines.
They do **not** establish correct live broker selectors, universal challenge completion,
mail delivery, record ownership, broker acceptance or an actual deletion. Those require
separate contract checks, native-browser QA and an authorized real-record pilot.
