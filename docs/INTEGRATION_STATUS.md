# Integration status

Updated November 6, 2026. This matrix describes implemented actions rather than a
claim that each provider holds a record or has deleted it. It covers all **43 reference
routes** in the public catalog; some are registrations or provider preferences rather
than broker-record deletion services.

**Current supported path:** users type initial missing fields inside Erase Me for
15 standard companion routes, plus thirteen separate transient form actions. These include four limited association/relative forms, two first-number marketing preferences and two directory-suppression prefills added in this release. CMA is a marketing registration, not broker deletion. Reviewed initial submission is available only where a specific
contract exists. FastPeopleSearch additionally has a reviewed in-app missing-information
collector and one final matching-form submission attempt after its authenticated
continuation. A submit attempt, email confirmation or matching form is not removal.

**Mail availability:** public users can install the local connector and authorize their
own separate Gmail account for on-demand receipt checks. A local browser setup screen handles
connection reuse, file selection and companion registration without copying secrets into the app. No operator key or hosted
credential upload is required for that transport. It requires one-time native-host and
installed-client OAuth setup. The existing hosted shared-mailbox relay remains a private
operator pilot. Personal inboxes stay disconnected. No polling, recurring schedule or automatic
resubmission is enabled. The existing USPhonebook and FastPeopleSearch live pilots remain held.

In the table, **Yes** means the approved initial fields can be entered in Erase Me and
filled by the desktop Chrome companion. Privacy-email rows keep **No** in that form-filling column; their separate own-record message review can still send once. NumaraAra supports both its guarded form and reviewed email alternative. **Not integrated** means the app has no executable
contract for that stage. **None** in the last column means no independently verified
deletion has been established or should be inferred from the other columns.

| Route | Region | Channel type | In-app fields + fill | Initial action | Email continuation | Final request action | Correct-record matching | Verified deletion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `peopledatalabs-form` · People Data Labs | * | Reviewed form | Yes | Initiates email verification | Manual; record-associated address | Not integrated | Manual/unobserved | None |
| `usphonebook` · USPhonebook | US | Reviewed form | Yes | Guarded native submit | Local connector or private operator pilot; second-form prefill | Not integrated | Manual/unobserved | None |
| `searchpeoplefree` · SearchPeopleFree | US | Reviewed form | Yes | Guarded native submit | Local-owned Gmail receipt checks; confirmation held | Not integrated | Manual/unobserved | None |
| `smartbackgroundchecks` · SmartBackgroundChecks | US | Reviewed privacy-entry form | Yes | Guarded native submit | Not integrated | Not integrated | Manual/unobserved | None |
| `fastpeoplesearch` · FastPeopleSearch | US | Reviewed form | Yes | Guarded native submit | Local connector or private operator pilot; authenticated matching form | Guarded matching-form attempt | Manual/unobserved | None |
| `spokeo` · Spokeo | US | Reviewed form | Yes | Manual submit after fill | Not integrated | Not integrated | Narrow structured listing check | None |
| `apollo` · Apollo | * | Reviewed form | Yes | Guarded native submit | Manual; record-associated business address | Not integrated | Manual/unobserved | None |
| `addresses` · Addresses.com | US | No current accessible form contract | No | Not integrated | Not integrated | Not integrated | Manual/unobserved | None |
| `advancedbackgroundchecks` · AdvancedBackgroundChecks | US | Reviewed form | Yes | Guarded native submit | Not integrated | Not integrated | Manual/unobserved | None |
| `beenverified` · BeenVerified | US | Reviewed privacy-email sending | No | Reviewed email send; Provider acceptance only | Not integrated | Not integrated | Manual/unobserved | None |
| `clustrmaps` · ClustrMaps | US | No current accessible form contract | No | Not integrated | Not integrated | Not integrated | Manual/unobserved | None |
| `cyberbackgroundchecks` · CyberBackgroundChecks | US | No current accessible form contract | No | Not integrated | Not integrated | Not integrated | Manual/unobserved | None |
| `familytreenow` · FamilyTreeNow | US | Reviewed initial privacy form | Yes | Guarded native submit | Not integrated | Not integrated | Manual/unobserved | None |
| `instantcheckmate` · Instant Checkmate | US | Limited association/relative form | Yes | Prefill only; manual submit | Not integrated | Not integrated | Manual/unobserved | None |
| `intelius` · Intelius (PeopleConnect suppression center) | US | Limited association/relative form | Yes | Prefill only; manual submit | Not integrated | Not integrated | Manual/unobserved | None |
| `mylife` · MyLife | US | Reviewed transient form | Yes | Prefill only; manual submit | Not integrated | Not integrated | Manual/unobserved | None |
| `nuwber` · Nuwber | US | No current accessible form contract | No | Not integrated | Not integrated | Not integrated | Manual/unobserved | None |
| `peoplefinders` · PeopleFinders | US | Reviewed transient form | Yes | Prefill only; manual submit | Not integrated | Not integrated | Manual/unobserved | None |
| `peoplelooker` · PeopleLooker | US | Reviewed privacy-email sending | No | Reviewed email send; Provider acceptance only | Not integrated | Not integrated | Manual/unobserved | None |
| `thatsthem` · That's Them | US | Reviewed transient form | Yes | Prefill only; manual submit | Not integrated | Not integrated | Manual/unobserved | None |
| `truepeoplesearch` · TruePeopleSearch | US | Reviewed initial verification form | Yes | Guarded native submit | Not integrated | Not integrated | Manual/unobserved | None |
| `truthfinder` · TruthFinder | US | Limited association/relative form | Yes | Prefill only; manual submit | Not integrated | Not integrated | Manual/unobserved | None |
| `ussearch` · US Search | US | Limited association/relative form | Yes | Prefill only; manual submit | Not integrated | Not integrated | Manual/unobserved | None |
| `whitepages` · Whitepages | US | Reviewed first-step URL field | Yes | Prefill only; Next stays manual | Not integrated | Not integrated | Manual/unobserved | None |
| `zabasearch` · ZabaSearch | US | Restricted/manual PeopleConnect | No | Not integrated | Not integrated | Not integrated | Manual/unobserved | None |
| `ca-411` · 411.ca | CA | Reviewed privacy-email sending | No | Reviewed email send; Provider acceptance only | Not integrated | Not integrated | Manual/unobserved | None |
| `ca-cma-do-not-mail` · CMA Do Not Mail Service | CA | Marketing registration | Yes | Prefill or guarded marketing registration | Not integrated | Not integrated | Manual/unobserved | None |
| `ca-dncl` · National Do Not Call List (DNCL) | CA | First-step marketing registration | Yes | Phone prefill only; manual registration | Not integrated | Not integrated | Manual/unobserved | None |
| `canada411` · Canada411 | CA | Reviewed own-record directory form | Yes | Prefill only; manual challenge/submit | Not integrated | Not integrated | Manual/unobserved | None |
| `192com` · 192.com | GB | Reviewed own-record directory form | Yes | Prefill only; manual challenge/submit | Not integrated | Not integrated | Manual/unobserved | None |
| `gb-bt-phonebook` · BT Phone Book and 118 500 (ex-directory) | GB | Subscriber/provider action | No | Not integrated | Not integrated | Not integrated | Manual/unobserved | None |
| `gb-peopletraceuk` · People Trace UK | GB | Reviewed transient form | Yes | Prefill only; manual submit | Not integrated | Not integrated | Manual/unobserved | None |
| `gb-tps` · Telephone Preference Service (TPS) | GB | First-step marketing registration | Yes | Phone prefill only; manual registration | Not integrated | Not integrated | Manual/unobserved | None |
| `ukphonebook` · ukphonebook.com | GB | Reviewed privacy-email sending | No | Reviewed email send; Provider acceptance only | Not integrated | Not integrated | Manual/unobserved | None |
| `de-11880` · 11880.com | DE | Reviewed privacy-email sending | No | Reviewed email send; Provider acceptance only | Not integrated | Not integrated | Manual/unobserved | None |
| `de-teilnehmerverzeichnis-widerspruch` · Widerspruch through the phone provider (all directories) | DE | Reviewed privacy-email sending | No | Reviewed email send; Provider acceptance only | Not integrated | Not integrated | Manual/unobserved | None |
| `tr-ceptennumarasorgula` · Cepten Numara Sorgula 11877 (Mobilişim) | TR | Reviewed privacy-email sending | No | Reviewed email send; Provider acceptance only | Not integrated | Not integrated | Manual/unobserved | None |
| `tr-mobile-operator-rehber` · Vodafone and Türk Telekom directory (rehber) listing | TR | Subscriber/provider action | No | Not integrated | Not integrated | Not integrated | Manual/unobserved | None |
| `tr-nosorgulama` · No Sorgulama (nosorgulama.com.tr) | TR | Reviewed form | Yes | Guarded native submit | Not integrated | Not integrated | Manual/unobserved | None |
| `tr-numaraara` · NumaraAra | TR | Reviewed form | Yes | Guarded native submit | Not integrated | Not integrated | Manual/unobserved | None |
| `tr-numarasor` · numarasor.com | TR | Reviewed form | Yes | Guarded native submit | Not integrated | Not integrated | Manual/unobserved | None |
| `tr-telefonsorgulama` · TelefonSorgulama | TR | Reviewed form | Yes | Manual submit after fill | Not integrated | Not integrated | Manual/unobserved | None |
| `tr-turkcell-rehber` · Turkcell Rehber and Bilinmeyen Numaralar | TR | Subscriber/provider action | No | Not integrated | Not integrated | Not integrated | Manual/unobserved | None |

## Why the remaining stages differ

- Fifteen routes have no reviewed form-filling contract. Seven of those have the separate reviewed privacy-email alternative below; eight remain guidance only. Some official
  pages were blocked or unavailable in the inspected browser; that is not proof of
  universal unavailability. Other published contact alternatives remain drafts where offered.
- Four named PeopleConnect brands share manual personal-use guidance with explicit
  portal restrictions. Historical affiliation does not establish ZabaSearch coverage.
  The app neither submits for every brand nor propagates a completion state between them.
- CMA Do Not Mail, DNCL and TPS are preference/marketing registrations. Subscriber
  directory changes, provider calls/SMS and postal instructions are distinct operations.
  Do not count them as a broker-record deletion or invoke paid lookup services.
- People Trace UK has an executable transient prefill, excluded from standard batches.
  DOB, telephone and postcode must be supplied accurately inside its private review;
  address components are optional on the observed form. Matching, challenge, submission
  and outcome remain manual or unverified. The German DTM deletion page has a conflicting submit label and stays manual.
- Shared mailbox substitution is not offered where a provider requires a personally
  owned or previously recorded address. A free public tool still needs authenticated
  access, quotas and abuse controls before a shared-mail service can be public.

## Last-pass commitments

| Commitment | State | Practical boundary |
| --- | --- | --- |
| In-app FastPeopleSearch missing information | Implemented | Proof-bound existing continuation; exact fields and certification reviewed before disclosure |
| One approved final fill/submit attempt | Implemented for FastPeopleSearch | Native validation and genuine challenge preserved; no acceptance or deletion claim |
| Transient extra identity details | Implemented | DOB/address/phone excluded from saved ledger, backups and companion result metadata |
| Lost-result read without resubmission | Implemented | Reads the original reserved action; interrupted work never automatically repeats |
| Local cleanup planner | Implemented | Own-list JSON/CSV import, keep/export/remove choice, export acknowledgement and self-reports |
| Google/Reddit/DROP distinctions | Guidance implemented | Search-result removal differs from source deletion; content deletion precedes account closure; DROP is California-specific |
| Account/social/company/preference execution | Staged | Local planning is not account closure, content deletion or delivered company requests |
| Local browser email setup | Implemented | Launcher opens a private local form with file selection and existing-account reuse; separate account and Google client still required |
| CMA marketing registration | Implemented | Private Canadian mailing-field review and optional native attempt; no broker deletion claim |
| SmartBackgroundChecks privacy entry | Implemented | Exact public privacy link and canonical form checked before disclosure; no challenge bypass |
| People Trace UK transient form | Implemented for prefill | Exact private review; no identity details in saved state; challenge and submit stay manual |
| Per-user removal-only mail | Implemented with setup | Own dedicated Gmail, local native host and OAuth client; supported confirmations only |
| Managed zero-setup mailbox service | Not implemented | Hosted shared-mail relay remains private; no anonymous shared credential access |
| Reviewed privacy-email sending | Implemented for eight fixed privacy contacts | Optional fresh sending consent and exact own-record message review; provider acceptance is not delivery or deletion |
| FamilyTreeNow initial action | Implemented | Subject-only name/email, exact communications authorization and genuine challenge; later stages unverified |
| MyLife, PeopleFinders and That’s Them | Implemented for transient prefill | Exact own-information review; no extra identity values in saved state; final site actions stay manual |
| Remaining route-specific final actions | Staged | Need observed official contracts and consented live validation |
| Real matched-record removal verification | Unverified | Needs a previously matched record plus correlated completion and independent absence evidence |

Source of truth: [route catalog](../webapp/static/broker-routes.js),
[channel assessments](../webapp/static/broker-audit.js),
[initial executor](../extension/broker-executor.js),
[guarded initial contracts](../extension/automatic-executor.js),
[final executor](../extension/final-executor.js), and
[broker observations](BROKER_ROUTE_RESEARCH.md). The broader sequence remains
[discover → choose → export → submit → verify → manually recheck](CLEANUP_ROADMAP.md).

## Public local-mail setup

The per-user connector supports local-owned contacts for FastPeopleSearch, USPhonebook
and SearchPeopleFree. It keeps credentials and durable grants on the person's computer.
Provider identity, primary-email exclusion, operation scope, quota and revocation checks
precede mail reads. SearchPeopleFree's shared-contact restriction remains enforced on
the hosted relay; only a personally owned local account can supply its new contact.
Its authenticated receipt does not yet release a confirmation link automatically.

This is a supported-desktop, self-configured software path, not automatic account creation
or an unlimited managed mail service. See [setup and limits](LOCAL_REMOVAL_MAIL.md).
TelefonSorgulama retains manual submission because its asynchronous native form.submit()
can bypass the current event guard; an unsafe automated adapter was not enabled.

Whitepages now has an executable first-step listing-URL prefill from the form exposed
in a normal desktop browser. The route requires explicit manual review of the exact
own person URL and a dedicated companion capability before reservation. Neither Next
nor phone verification is automated; URL shape never becomes identity or deletion proof.

## Reviewed privacy-email sending

Eight fixed, purpose-verified contacts support a separate native email action: 411.ca,
ukphonebook.com, Das Örtliche/DTM, Cepten Numara Sorgula, NumaraAra, BeenVerified,
PeopleLooker and 11880. This overlaps seven of the 15 routes without reviewed form fill and one
existing form route. It does not change the matrix’s form-stage or deletion evidence.

The person reviews the exact dedicated From address, fixed To address, subject and
body, and confirms an own-information request before one send. Optional `gmail.send`
requires fresh Google consent; read-only connections stay supported. A durable local
outbox records the attempt before Google is called. Unknown results are never retried.
Only provider message/thread references and evidence flags are saved, not message
bodies or record references. A Gmail-accepted result is not delivery, broker acceptance
or deletion. Support/registry contacts, Vodafone’s recorded-sender channel and both
held live pilots are excluded. See [mail delivery](LOCAL_REMOVAL_MAIL.md#reviewed-privacy-email-delivery).

## Connection and scope updates

Eligible users can choose a dedicated Gmail app password in the private local setup screen without preparing a Cloud client. Google 2-Step Verification and app-password availability remain prerequisites for that option. Google sign-in stays available for other accounts. App passwords have broader provider permissions; local sending remains separately opt-in. Credentials stay on the user’s computer. The SMTP transport records DATA 250 acceptance as a local receipt, never fabricated Gmail IDs or deletion proof.

The new association forms address relative/associate features only. Complete background-report suppression remains the separate manual PeopleConnect portal. DNCL/TPS are marketing preferences; Canada411’s form concerns its web listing only. None of these limited stages is a completed removal integration. Both held pilot requests remain held.
