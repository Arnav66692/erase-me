# Jurisdiction files

> Not legal advice. These files summarize privacy laws so Erase Me can draft requests and track deadlines. Each was checked against official sources on 2026-10-21. Laws change, and a file marked verified false has at least one field that could not be confirmed. Read its verification_note before relying on it.

The schema is in docs/ARCHITECTURE.md, section "Jurisdiction file". A file marked verified false still loads, but the engine shows a warning and never uses it in public claims. A not_in_force file is reported only. The engine never drafts a legal request from it.

"Deadline" is the controller's response time for a request. "None fixed" means the law sets no number of days, so the engine schedules a follow-up date instead of a legal due date.

## Index

| Code | Law | Status | Deadline | Regulator | Verified |
|---|---|---|---|---|---|
| us-ca-ccpa | CCPA, with Delete Act DROP | in_force | 45 calendar + 45 | California Privacy Protection Agency (CalPrivacy) | true |
| us-tx-tdpsa | TDPSA | in_force | 45 calendar + 45 | Texas Attorney General | true |
| us-nj-njdpa | NJDPA | in_force | 45 calendar + 45 | New Jersey Division of Consumer Affairs | false |
| us-va-vcdpa | VCDPA | in_force | 45 calendar + 45 | Virginia Attorney General | true |
| us-tn-tipa | TIPA | in_force | 45 calendar + 45 | Tennessee Attorney General | false |
| us-in-icdpa | ICDPA | in_force | 45 calendar + 45 | Indiana Attorney General | true |
| us-md-modpa | MODPA | in_force | 45 calendar + 45 | Maryland Attorney General | true |
| us-co-cpa | CPA | in_force | 45 calendar + 45 | Colorado Attorney General | true |
| us-mn-mcdpa | MCDPA | in_force | 45 calendar + 45 | Minnesota Attorney General | true |
| us-ky-kcdpa | KCDPA | in_force | 45 calendar + 45 | Kentucky Attorney General | true |
| us-or-ocpa | OCPA | in_force | 45 calendar + 45 | Oregon Department of Justice | true |
| eu-gdpr | GDPR (27 EU states plus IS, LI, NO) | in_force | one month + 2 months | One national authority per country | false |
| gb-ukgdpr | UK GDPR and DPA 2018 | in_force | one month + 2 months | Information Commission (ICO) | true |
| ch-nfadp | nFADP | in_force | 30 calendar, access only | FDPIC | false |
| tr-kvkk | KVKK | in_force | 30 calendar | KVKK Board | false |
| ca-pipeda | PIPEDA | partial | 30 calendar + 30 | Office of the Privacy Commissioner of Canada | true |
| ca-qc-law25 | Quebec private sector act (Law 25) | in_force | 30 calendar | Commission d'accès à l'information | true |
| br-lgpd | LGPD | in_force | none fixed | ANPD | true |
| mx-lfpdppp | LFPDPPP (2025 law) | in_force | 20 business + 20 | Secretaría Anticorrupción y Buen Gobierno | true |
| jp-appi | APPI | in_force | none fixed | Personal Information Protection Commission | true |
| kr-pipa | PIPA | in_force | 10 calendar | PIPC, through the KISA report center | true |
| au-privacy | Privacy Act 1988 | partial | none fixed | OAIC | true |
| nz-privacy | Privacy Act 2020 | partial | 20 working days | Office of the Privacy Commissioner | false |
| sg-pdpa | PDPA | partial | 30 calendar, correction notice | PDPC | false |
| za-popia | POPIA | in_force | none fixed | Information Regulator | true |
| in-dpdp | DPDP Act 2023 and Rules 2025 | not_in_force until 2027-05-13 | 90 calendar | Data Protection Board of India | false |

Status partial means the law has no general erasure right. The file describes the closest routes, such as withdrawing consent, correction, or the business's duty to stop keeping data it no longer needs.

## Other US states in force without a file

These state laws are reported as in force on 2026-10-21, but the dates below come from search results that cite official pages. The pages themselves were not fetched, so treat every row as unverified. Each needs its own file before Erase Me drafts a request under it.

| State | Law | Reported effective date | Verified |
|---|---|---|---|
| Connecticut | Connecticut Data Privacy Act (CTDPA) | 2023-07-01 | false |
| Utah | Utah Consumer Privacy Act (UCPA) | 2023-12-31 | false |
| Montana | Montana Consumer Data Privacy Act (MCDPA) | 2024-10-01 | false |
| Iowa | Iowa Code ch. 715D | 2025-01-01 | false |
| Delaware | Delaware Personal Data Privacy Act (DPDPA) | 2025-01-01 | false |
| Nebraska | Nebraska Data Privacy Act (NDPA) | 2025-01-01 | false |
| New Hampshire | RSA 507-H | 2025-01-01 | false |
| Rhode Island | Rhode Island Data Transparency and Privacy Protection Act | 2026-01-01 | false |

A secondary source reports that Connecticut Public Act 26-64, in force 2026-10-01, changes how the CTDPA treats publicly available information and deletion. This was not confirmed from a primary source. Check it first when writing the Connecticut file. The Utah Legislature site also shows the UCPA rights section (Utah Code 13-61-201) replaced on 2026-07-01, and the new text was not read.

Excluded as narrow laws, not checked against primary text. The Florida Digital Bill of Rights covers only very large businesses. An Arkansas law reported in force from July 2026 appears to be a children's privacy law. Massachusetts passed a bill in both chambers by June 2026, but no signature was found.

## US laws enacted but not yet in force

Also unverified. They come from the same search results.

| State | Law | Reported effective date |
|---|---|---|
| Oklahoma | SB 546 | 2027-01-01 |
| Louisiana | SB 386, Act 502 | 2027-01-01 |
| Alabama | HB 351, Act 2026-552 | 2027-05-01 |
| Vermont | S.71, Act 145 | 2028-01-01 |

## Things to know across files

- Most US state laws exclude publicly available information from personal data. That limits deletion requests to people-search sites built from public records. Each US file's public_records_note quotes its state's rule.
- GDPR-family files (eu-gdpr, gb-ukgdpr, ch-nfadp) use an objection as well as erasure, because people-search sites usually rely on legitimate interests.
- Search delisting forms from Google and Bing are listed as special channels where an official page confirmed them.
- India's erasure right starts 2027-05-13 by calculation from the Gazette notification. The file explains a possible one-day difference.
