/* Official read-only route audit. No person or request data belongs in this file. */
(function(root,factory){const data=factory();if(typeof module==='object'&&module.exports)module.exports=data;else root.EraseBrokerAudit=data;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const data = {
  "smartbackgroundchecks": {
    "status": "blocked_or_unavailable",
    "checkedAt": "2026-11-04",
    "operationKind": "record_removal",
    "sources": [
      "https://www.smartbackgroundchecks.com/remove",
      "https://cppa.ca.gov/data_broker_registry/registry.csv"
    ],
    "summary": "The official page was blocked or unavailable; no current removal form was validated.",
    "limits": "A reachable page or business contact does not establish request acceptance or deletion.",
    "requestAccepted": false,
    "deletionVerified": false,
    "privacyContact": {
      "email": "privacy@mtalley.zendesk.com",
      "kind": "support",
      "source": "https://cppa.ca.gov/data_broker_registry/registry.csv",
      "checkedAt": "2026-11-04",
      "restriction": "Registered business contact, not a validated automated consumer-removal endpoint. Ask for the official procedure without sending personal identifiers."
    }
  },
  "addresses": {
    "status": "blocked_or_unavailable",
    "checkedAt": "2026-11-04",
    "operationKind": "record_removal",
    "sources": [
      "https://www.addresses.com/optout.php",
      "https://cppa.ca.gov/data_broker_registry/registry.csv"
    ],
    "summary": "The official page was blocked or unavailable; no current removal form was validated.",
    "limits": "A reachable page or business contact does not establish request acceptance or deletion.",
    "requestAccepted": false,
    "deletionVerified": false,
    "privacyContact": {
      "email": "legal@intelius.com",
      "kind": "support",
      "source": "https://cppa.ca.gov/data_broker_registry/registry.csv",
      "checkedAt": "2026-11-04",
      "restriction": "Registered business contact, not a validated automated consumer-removal endpoint. Ask for the official procedure without sending personal identifiers."
    }
  },
  "advancedbackgroundchecks": {
    "status": "reviewed_initial_form",
    "checkedAt": "2026-11-04",
    "operationKind": "record_removal",
    "sources": [
      "https://www.advancedbackgroundchecks.com/opt-out",
      "https://cppa.ca.gov/data_broker_registry/registry.csv"
    ],
    "summary": "review consent and submit initial form; complete broker challenge if presented; open 24-hour verification link; complete unobserved second form; await final processing response",
    "limits": "Initial form only; final matching, acceptance, and deletion are unverified.",
    "requestAccepted": false,
    "deletionVerified": false,
    "privacyContact": {
      "email": "privacy@mtalley.zendesk.com",
      "kind": "support",
      "source": "https://cppa.ca.gov/data_broker_registry/registry.csv",
      "checkedAt": "2026-11-04",
      "restriction": "Registered business contact, not a validated automated consumer-removal endpoint. Ask for the official procedure without sending personal identifiers."
    },
    "manualContact": {
      "kind": "phone",
      "value": "855-240-6392",
      "source": "https://www.advancedbackgroundchecks.com/privacy",
      "purpose": "privacy requests/appeals"
    }
  },
  "beenverified": {
    "status": "blocked_or_unavailable",
    "checkedAt": "2026-11-04",
    "operationKind": "record_removal",
    "sources": [
      "https://www.beenverified.com/app/optout/search",
      "https://cppa.ca.gov/data_broker_registry/registry.csv"
    ],
    "summary": "The official page was blocked or unavailable; no current removal form was validated.",
    "limits": "A reachable page or business contact does not establish request acceptance or deletion.",
    "requestAccepted": false,
    "deletionVerified": false,
    "privacyContact": {
      "email": "privacy@beenverified.com",
      "kind": "support",
      "source": "https://cppa.ca.gov/data_broker_registry/registry.csv",
      "checkedAt": "2026-11-04",
      "restriction": "Registered business contact, not a validated automated consumer-removal endpoint. Ask for the official procedure without sending personal identifiers."
    }
  },
  "clustrmaps": {
    "status": "connection_refused",
    "checkedAt": "2026-11-04",
    "operationKind": "record_removal",
    "sources": [
      "https://clustrmaps.com/bl/opt-out"
    ],
    "summary": "Browser navigation failed with net::ERR_CONNECTION_REFUSED; no form was obtained. This is not evidence the site is universally unavailable.",
    "limits": "Browser navigation failed with net::ERR_CONNECTION_REFUSED; no form was obtained. This is not evidence the site is universally unavailable.",
    "requestAccepted": false,
    "deletionVerified": false
  },
  "cyberbackgroundchecks": {
    "status": "blocked_or_unavailable",
    "checkedAt": "2026-11-04",
    "operationKind": "record_removal",
    "sources": [
      "https://www.cyberbackgroundchecks.com/removal",
      "https://cppa.ca.gov/data_broker_registry/registry.csv"
    ],
    "summary": "The official page was blocked or unavailable; no current removal form was validated.",
    "limits": "A reachable page or business contact does not establish request acceptance or deletion.",
    "requestAccepted": false,
    "deletionVerified": false,
    "privacyContact": {
      "email": "privacy@mtalley.zendesk.com",
      "kind": "support",
      "source": "https://cppa.ca.gov/data_broker_registry/registry.csv",
      "checkedAt": "2026-11-04",
      "restriction": "Registered business contact, not a validated automated consumer-removal endpoint. Ask for the official procedure without sending personal identifiers."
    }
  },
  "familytreenow": {
    "status": "blocked_or_unavailable",
    "checkedAt": "2026-11-04",
    "operationKind": "record_removal",
    "sources": [
      "https://www.familytreenow.com/optout",
      "https://cppa.ca.gov/data_broker_registry/registry.csv"
    ],
    "summary": "The official page was blocked or unavailable; no current removal form was validated.",
    "limits": "A reachable page or business contact does not establish request acceptance or deletion.",
    "requestAccepted": false,
    "deletionVerified": false,
    "privacyContact": {
      "email": "privacy@familytreenow.com",
      "kind": "support",
      "source": "https://cppa.ca.gov/data_broker_registry/registry.csv",
      "checkedAt": "2026-11-04",
      "restriction": "Registered business contact, not a validated automated consumer-removal endpoint. Ask for the official procedure without sending personal identifiers."
    }
  },
  "instantcheckmate": {
    "status": "manual_self_service",
    "checkedAt": "2026-11-04",
    "operationKind": "record_removal",
    "sources": [
      "https://suppression.peopleconnect.us/login"
    ],
    "summary": "consumer self-service eligibility and terms; email/phone verification; additional matching; suppression request",
    "limits": "Portal explicitly names four brands and name-based Background Reports only. Terms restrict third-party service/commercial use and non-US access without approval.",
    "requestAccepted": false,
    "deletionVerified": false,
    "privacyContact": {
      "email": "privacy@peopleconnect.us",
      "kind": "support",
      "source": "https://suppression.peopleconnect.us/login",
      "checkedAt": "2026-11-04",
      "restriction": "privacy questions/denial appeals and assistance after suppression; this draft asks for the official procedure without personal identifiers."
    }
  },
  "intelius": {
    "status": "manual_self_service",
    "checkedAt": "2026-11-04",
    "operationKind": "record_removal",
    "sources": [
      "https://suppression.peopleconnect.us/login"
    ],
    "summary": "consumer self-service eligibility and terms; email/phone verification; additional matching; suppression request",
    "limits": "Portal explicitly names four brands and name-based Background Reports only. Terms restrict third-party service/commercial use and non-US access without approval.",
    "requestAccepted": false,
    "deletionVerified": false,
    "privacyContact": {
      "email": "privacy@peopleconnect.us",
      "kind": "support",
      "source": "https://suppression.peopleconnect.us/login",
      "checkedAt": "2026-11-04",
      "restriction": "privacy questions/denial appeals and assistance after suppression; this draft asks for the official procedure without personal identifiers."
    }
  },
  "mylife": {
    "status": "blocked_or_unavailable",
    "checkedAt": "2026-11-04",
    "operationKind": "record_removal",
    "sources": [
      "https://www.mylife.com/ccpa/index.pubview",
      "https://cppa.ca.gov/data_broker_registry/registry.csv"
    ],
    "summary": "The official page was blocked or unavailable; no current removal form was validated.",
    "limits": "A reachable page or business contact does not establish request acceptance or deletion.",
    "requestAccepted": false,
    "deletionVerified": false,
    "privacyContact": {
      "email": "membersupport@mylife.com",
      "kind": "support",
      "source": "https://cppa.ca.gov/data_broker_registry/registry.csv",
      "checkedAt": "2026-11-04",
      "restriction": "Registered business contact, not a validated automated consumer-removal endpoint. Ask for the official procedure without sending personal identifiers."
    }
  },
  "nuwber": {
    "status": "blocked_in_parent_research",
    "checkedAt": "2026-11-04",
    "operationKind": "record_removal",
    "sources": [
      "https://nuwber.com/removal/link",
      "https://cppa.ca.gov/data_broker_registry/registry.csv"
    ],
    "summary": "The official page was blocked or unavailable; no current removal form was validated.",
    "limits": "A reachable page or business contact does not establish request acceptance or deletion.",
    "requestAccepted": false,
    "deletionVerified": false,
    "privacyContact": {
      "email": "support@nuwber.com",
      "kind": "support",
      "source": "https://cppa.ca.gov/data_broker_registry/registry.csv",
      "checkedAt": "2026-11-04",
      "restriction": "Registered business contact, not a validated automated consumer-removal endpoint. Ask for the official procedure without sending personal identifiers."
    }
  },
  "peoplefinders": {
    "status": "blocked_or_unavailable",
    "checkedAt": "2026-11-04",
    "operationKind": "record_removal",
    "sources": [
      "https://www.peoplefinders.com/opt-out",
      "https://cppa.ca.gov/data_broker_registry/registry.csv"
    ],
    "summary": "The official page was blocked or unavailable; no current removal form was validated.",
    "limits": "A reachable page or business contact does not establish request acceptance or deletion.",
    "requestAccepted": false,
    "deletionVerified": false,
    "privacyContact": {
      "email": "customercare@peoplefinders.com",
      "kind": "support",
      "source": "https://cppa.ca.gov/data_broker_registry/registry.csv",
      "checkedAt": "2026-11-04",
      "restriction": "Registered business contact, not a validated automated consumer-removal endpoint. Ask for the official procedure without sending personal identifiers."
    }
  },
  "peoplelooker": {
    "status": "blocked_or_unavailable",
    "checkedAt": "2026-11-04",
    "operationKind": "record_removal",
    "sources": [
      "https://www.peoplelooker.com/opt-out",
      "https://cppa.ca.gov/data_broker_registry/registry.csv"
    ],
    "summary": "The official page was blocked or unavailable; no current removal form was validated.",
    "limits": "A reachable page or business contact does not establish request acceptance or deletion.",
    "requestAccepted": false,
    "deletionVerified": false,
    "privacyContact": {
      "email": "privacy@beenverified.com",
      "kind": "support",
      "source": "https://cppa.ca.gov/data_broker_registry/registry.csv",
      "checkedAt": "2026-11-04",
      "restriction": "Registered business contact, not a validated automated consumer-removal endpoint. Ask for the official procedure without sending personal identifiers."
    }
  },
  "thatsthem": {
    "status": "blocked_or_unavailable",
    "checkedAt": "2026-11-04",
    "operationKind": "record_removal",
    "sources": [
      "https://thatsthem.com/optout"
    ],
    "summary": "The official page was blocked or unavailable; no current removal form was validated.",
    "limits": "A reachable page or business contact does not establish request acceptance or deletion.",
    "requestAccepted": false,
    "deletionVerified": false
  },
  "truepeoplesearch": {
    "status": "removal_form_unavailable",
    "checkedAt": "2026-11-04",
    "operationKind": "record_removal",
    "sources": [
      "https://www.truepeoplesearch.com/removal"
    ],
    "summary": "Only search forms/footer observed; no removal-purpose form contract. Document title was Just a moment...",
    "limits": "Only search forms/footer observed; no removal-purpose form contract. Document title was Just a moment...",
    "requestAccepted": false,
    "deletionVerified": false,
    "privacyContact": {
      "email": "support@truepeoplesearch.com",
      "kind": "support",
      "source": "https://www.truepeoplesearch.com/removal",
      "checkedAt": "2026-11-04",
      "restriction": "official support assistance, not a validated automated privacy endpoint; this draft asks for the official procedure without personal identifiers."
    }
  },
  "truthfinder": {
    "status": "manual_self_service",
    "checkedAt": "2026-11-04",
    "operationKind": "record_removal",
    "sources": [
      "https://suppression.peopleconnect.us/login"
    ],
    "summary": "consumer self-service eligibility and terms; email/phone verification; additional matching; suppression request",
    "limits": "Portal explicitly names four brands and name-based Background Reports only. Terms restrict third-party service/commercial use and non-US access without approval.",
    "requestAccepted": false,
    "deletionVerified": false,
    "privacyContact": {
      "email": "privacy@peopleconnect.us",
      "kind": "support",
      "source": "https://suppression.peopleconnect.us/login",
      "checkedAt": "2026-11-04",
      "restriction": "privacy questions/denial appeals and assistance after suppression; this draft asks for the official procedure without personal identifiers."
    }
  },
  "ussearch": {
    "status": "manual_self_service",
    "checkedAt": "2026-11-04",
    "operationKind": "record_removal",
    "sources": [
      "https://suppression.peopleconnect.us/login"
    ],
    "summary": "consumer self-service eligibility and terms; email/phone verification; additional matching; suppression request",
    "limits": "Portal explicitly names four brands and name-based Background Reports only. Terms restrict third-party service/commercial use and non-US access without approval.",
    "requestAccepted": false,
    "deletionVerified": false,
    "privacyContact": {
      "email": "privacy@peopleconnect.us",
      "kind": "support",
      "source": "https://suppression.peopleconnect.us/login",
      "checkedAt": "2026-11-04",
      "restriction": "privacy questions/denial appeals and assistance after suppression; this draft asks for the official procedure without personal identifiers."
    }
  },
  "whitepages": {
    "status": "blocked_or_unavailable",
    "checkedAt": "2026-11-04",
    "operationKind": "record_removal",
    "sources": [
      "https://www.whitepages.com/suppression-requests",
      "https://cppa.ca.gov/data_broker_registry/registry.csv"
    ],
    "summary": "The official page was blocked or unavailable; no current removal form was validated.",
    "limits": "A reachable page or business contact does not establish request acceptance or deletion.",
    "requestAccepted": false,
    "deletionVerified": false,
    "privacyContact": {
      "email": "legal@whitepages.com",
      "kind": "support",
      "source": "https://cppa.ca.gov/data_broker_registry/registry.csv",
      "checkedAt": "2026-11-04",
      "restriction": "Registered business contact, not a validated automated consumer-removal endpoint. Ask for the official procedure without sending personal identifiers."
    }
  },
  "zabasearch": {
    "status": "manual_scope_unverified",
    "checkedAt": "2026-11-04",
    "operationKind": "record_removal",
    "sources": [
      "https://suppression.peopleconnect.us/login",
      "https://cppa.ca.gov/data_broker_registry/registry.csv"
    ],
    "summary": "Catalog destination is PeopleConnect login, but the observed portal explicitly names only TruthFinder, Instant Checkmate, Intelius and US Search. Do not infer ZabaSearch coverage.",
    "limits": "Catalog destination is PeopleConnect login, but the observed portal explicitly names only TruthFinder, Instant Checkmate, Intelius and US Search. Do not infer ZabaSearch coverage.",
    "requestAccepted": false,
    "deletionVerified": false,
    "privacyContact": {
      "email": "legal@intelius.com",
      "kind": "support",
      "source": "https://cppa.ca.gov/data_broker_registry/registry.csv",
      "checkedAt": "2026-11-04",
      "restriction": "Registered business contact, not a validated automated consumer-removal endpoint. Ask for the official procedure without sending personal identifiers."
    }
  },
  "ca-411": {
    "status": "official_contact_verified",
    "checkedAt": "2026-11-04",
    "operationKind": "privacy_request",
    "sources": [
      "https://www.411.ca/privacy-policy"
    ],
    "summary": "Send an authorized privacy request from a chosen removal account; identity or record matching may still be required.",
    "limits": "No request was sent; no acceptance or deletion observed. Policy cautions about copies elsewhere and backups.",
    "requestAccepted": false,
    "deletionVerified": false,
    "privacyContact": {
      "email": "privacy@411.ca",
      "kind": "privacy",
      "source": "https://www.411.ca/privacy-policy",
      "checkedAt": "2026-11-04",
      "restriction": "Privacy Officer; consent withdrawal, account deletion and privacy questions. Broker verification remains required; the app does not send mail."
    }
  },
  "ca-cma-do-not-mail": {
    "status": "form_inspected",
    "checkedAt": "2026-11-04",
    "operationKind": "marketing_suppression_registration",
    "sources": [
      "https://cmadnm.cawebhosting.ca/submit.asp"
    ],
    "summary": "Review the suppression effects and supply accurate full name and mailing address; submit only with explicit registration authorization.",
    "limits": "Suppresses new-contact addressed marketing among participating CMA members, not underlying broker records or unaddressed flyers. Public page states six years and around six weeks to take effect. No acceptance observed.",
    "requestAccepted": false,
    "deletionVerified": false
  },
  "ca-dncl": {
    "status": "first_form_inspected",
    "checkedAt": "2026-11-04",
    "operationKind": "do_not_call_registration",
    "sources": [
      "https://www.lnnte-dncl.gc.ca/en/Consumer/Register-your-number"
    ],
    "summary": "Provide the person’s own phone number and explicitly confirm registration; registration of a shared line affects everyone using it.",
    "limits": "Government marketing-call suppression registration, not broker-record deletion. Later confirmation/results were not inspected because no number was submitted.",
    "requestAccepted": false,
    "deletionVerified": false
  },
  "canada411": {
    "status": "blocked",
    "checkedAt": "2026-11-04",
    "operationKind": "directory_listing_removal",
    "sources": [
      "https://www.canada411.ca/help.html?key=faq"
    ],
    "summary": "Open the official FAQ in a normal personal browser; current automated inspection cannot validate the removal controls.",
    "limits": "Both FAQ and homepage returned CloudFront request blocked. Prior pack describes a web-only listing-removal form and separate provider unlisting, but neither was revalidated here.",
    "requestAccepted": false,
    "deletionVerified": false
  },
  "192com": {
    "status": "blocked",
    "checkedAt": "2026-11-04",
    "operationKind": "record_removal",
    "sources": [
      "https://www.192.com/c01/new-request/"
    ],
    "summary": "Official page needs a normal browser verification step. Do not invent selectors or send details to guessed contacts.",
    "limits": "Cloudflare verification page only. Existing pack URL and timelines were historically unverified; no current alternate contact or form observed.",
    "requestAccepted": false,
    "deletionVerified": false
  },
  "gb-bt-phonebook": {
    "status": "official_manual_channel_verified",
    "checkedAt": "2026-11-04",
    "operationKind": "provider_directory_preference",
    "sources": [
      "https://www.bt.com/help/home-phone/manage-service/how-do-i-sign-up-to-ex-directory-services-"
    ],
    "summary": "BT account holder calls the provider to choose Ex-directory No calls or Directory Enquiries Only.",
    "limits": "Official page says both choices are free, but this is a provider/account workflow and does not remove copies held by other brokers.",
    "requestAccepted": false,
    "deletionVerified": false,
    "manualContact": {
      "kind": "provider",
      "value": "https://www.bt.com/help/contact-bt/account-and-billing/home-phone",
      "source": "https://www.bt.com/help/home-phone/manage-service/how-do-i-sign-up-to-ex-directory-services-",
      "purpose": "The account holder contacts the provider directly."
    }
  },
  "gb-peopletraceuk": {
    "status": "form_inspected",
    "checkedAt": "2026-11-04",
    "operationKind": "record_removal",
    "sources": [
      "https://www.peopletraceuk.com/RequestRecordRemoval.asp",
      "https://www.peopletraceuk.com/Privacy_Policy.asp"
    ],
    "summary": "One form per true data subject/address, including birth date, phone, postcode and challenge. Person may need to establish identity; no ID-upload or identity step was executed.",
    "limits": "Full form contract is public but acceptance/success and record matching not observed. Post-only fallback is not a zero-postage-cost route. Privacy policy provides no email.",
    "requestAccepted": false,
    "deletionVerified": false,
    "manualContact": {
      "kind": "post",
      "value": "People Trace UK Ltd, Office 1b Swann Business Centre, 4 Higher Swan Lane, Bolton, Lancashire, United Kingdom, BL3 3AQ",
      "source": "https://www.peopletraceuk.com/Privacy_Policy.asp",
      "purpose": "Official notice requires written postal privacy requests."
    }
  },
  "gb-tps": {
    "status": "initial_category_step_inspected",
    "checkedAt": "2026-11-04",
    "operationKind": "do_not_call_registration",
    "sources": [
      "https://www.tpsonline.org.uk/register",
      "https://www.tpsonline.org.uk/pages/contact"
    ],
    "summary": "Choose the correct subscriber category and complete phone-registration steps directly; no category or phone number was submitted in this inspection.",
    "limits": "Free marketing-call opt-out register, not broker-record deletion. Later phone, postal-code and email contracts remain unobserved.",
    "requestAccepted": false,
    "deletionVerified": false
  },
  "ukphonebook": {
    "status": "manual_form_and_official_contact_verified",
    "checkedAt": "2026-11-04",
    "operationKind": "record_removal",
    "sources": [
      "https://www.ukphonebook.com/remove-me",
      "https://www.ukphonebook.com/privacy"
    ],
    "summary": "Official form explicitly allows privacy/removal services for clients but states automated tools are blocked and form completion must be manual. One person/address per form.",
    "limits": "Only initial step inspected, no request/confirmation/deletion observed. Data at original providers can remain and may require separate requests.",
    "requestAccepted": false,
    "deletionVerified": false,
    "privacyContact": {
      "email": "dpo@simunix.com",
      "kind": "privacy",
      "source": "https://www.ukphonebook.com/privacy",
      "checkedAt": "2026-11-04",
      "restriction": "Data Protection Officer, privacy rights and processing questions; privacy policy also directs listing removal to remove-me form. Broker verification remains required; the app does not send mail."
    }
  },
  "de-11880": {
    "status": "verified_provider_channel",
    "checkedAt": "2026-11-04",
    "operationKind": "provider_request",
    "sources": [
      "https://unternehmen.11880.com/faq",
      "https://unternehmen.11880.com/datenschutz"
    ],
    "summary": "Ask the subscriber’s telephone provider to remove the directory entry. The official FAQ directs deletion there; no deletion form was observed.",
    "limits": "The ordinary directory-information lookup is a paid product; do not invoke it. The FAQ is a business-services FAQ but explicitly directs directory-entry deletion to the telephone provider. No accepted request or deletion was observed.",
    "requestAccepted": false,
    "deletionVerified": false,
    "privacyContact": {
      "email": "bdsb@11880.com",
      "kind": "support",
      "source": "https://unternehmen.11880.com/faq",
      "checkedAt": "2026-11-04",
      "restriction": "11880 group data-protection officer, as published in privacy notice; not a promise of directory removal. No automatic sending or shared sender substitution."
    }
  },
  "de-teilnehmerverzeichnis-widerspruch": {
    "status": "verified_manual_alternative",
    "checkedAt": "2026-11-04",
    "operationKind": "manual_form_or_privacy_contact",
    "sources": [
      "https://www.dasoertliche.de/datenschutz",
      "https://www.dtme.de/ihr-eintrag/ihr-privater-eintrag/",
      "https://www.dtme.de/ihr-eintrag/privat-eintrag-loeschen/"
    ],
    "summary": "Keep this form manual: its page/title/path request deletion, but its submit label says Jetzt verbindlich anlegen. Verify intended action before any submission; do not infer that all directories are covered.",
    "limits": "The current privacy notice provides a direct DTM deletion route, beyond the older phone-only reference. Address/first-name fields exist, but contact-form aria-required markers identify surname, phone parts, contact type and email; HTML required flags are false. Provider directory preference remains an upstream channel; no global deletion was validated. No accepted request or deletion was observed.",
    "requestAccepted": false,
    "deletionVerified": false,
    "privacyContact": {
      "email": "datenschutz@dasoertliche-marketing.de",
      "kind": "privacy",
      "source": "https://www.dasoertliche.de/datenschutz",
      "checkedAt": "2026-11-04",
      "restriction": "Privacy notice explicitly directs entry deletion and data-subject requests here. No automatic sending or shared sender substitution."
    }
  },
  "tr-ceptennumarasorgula": {
    "status": "verified_privacy_contact",
    "checkedAt": "2026-11-04",
    "operationKind": "privacy_contact",
    "sources": [
      "https://www.ceptennumarasorgula.com/PrivacyPolicy",
      "https://www.ceptennumarasorgula.com/",
      "https://www.ceptennumarasorgula.com/gizlilik-ve-kisisel-verilerin-korunmasi"
    ],
    "summary": "Prepare a request about the person’s own number to the published Mobilişim contact; do not run the paid number-lookup service. Any further verification remains unvalidated.",
    "limits": "The legacy /PrivacyPolicy page has no direct contact details; the homepage links a current Turkish privacy notice. The homepage explicitly charges 7.95 TL per lookup, including unsuccessful lookup. No lookup was performed. No accepted request or deletion was observed.",
    "requestAccepted": false,
    "deletionVerified": false,
    "privacyContact": {
      "email": "mh@mobilisim.com.tr",
      "kind": "privacy",
      "source": "https://www.ceptennumarasorgula.com/PrivacyPolicy",
      "checkedAt": "2026-11-04",
      "restriction": "Official site’s company/contact address, also linked from the current Turkish privacy notice. No automatic sending or shared sender substitution."
    }
  },
  "tr-mobile-operator-rehber": {
    "status": "verified_privacy_channel_partial",
    "checkedAt": "2026-11-04",
    "operationKind": "subscriber_privacy_request",
    "sources": [
      "https://www.vodafone.com.tr/",
      "https://www.vodafone.com.tr/gizlilik-ve-guvenlik-politikalari"
    ],
    "summary": "Subscriber handles the operator’s directory preference or privacy request. Vodafone’s privacy notice permits email from an address already recorded and verified in its systems, or signed/physical channels. A shared service mailbox is not silently substituted.",
    "limits": "Official PDF request form linked: https://cms.vodafone.com.tr/static/files/25-01/23/kvkk-ilgili-kisi-talep-formu-1.pdf ; contents not separately inspected. No directory-specific public deletion form observed on the Vodafone pages. Türk Telekom procedures were not newly verified; do not infer that the Vodafone channel covers Türk Telekom. No accepted request or deletion was observed.",
    "requestAccepted": false,
    "deletionVerified": false,
    "privacyContact": {
      "email": "kisiselverilerinkorunmasi@vodafone.com",
      "kind": "privacy",
      "source": "https://www.vodafone.com.tr/",
      "checkedAt": "2026-11-04",
      "restriction": "Vodafone privacy requests, restricted by its policy to previously recorded/verified sender address for ordinary email. No automatic sending or shared sender substitution."
    }
  },
  "tr-nosorgulama": {
    "status": "reviewed_form_candidate",
    "checkedAt": "2026-11-04",
    "operationKind": "web_form",
    "sources": [
      "https://www.nosorgulama.com.tr/iletisim/"
    ],
    "summary": "Explicitly select own target number/listing and review a plain removal request. Do not fill the honeypot or hidden CSRF; no accepted request/deletion was observed.",
    "limits": " No accepted request or deletion was observed.",
    "requestAccepted": false,
    "deletionVerified": false
  },
  "tr-numaraara": {
    "status": "reviewed_form_candidate",
    "checkedAt": "2026-11-04",
    "operationKind": "web_form",
    "sources": [
      "https://www.numaraara.com/iletisim"
    ],
    "summary": "Review the own-number request, complete the security code and KVKK checkbox directly on the broker, then submit. Never alter the hidden CSRF/form fields.",
    "limits": " No accepted request or deletion was observed.",
    "requestAccepted": false,
    "deletionVerified": false,
    "privacyContact": {
      "email": "bilgi@numaraara.com",
      "kind": "privacy",
      "source": "https://www.numaraara.com/iletisim",
      "checkedAt": "2026-11-04",
      "restriction": "Official contact page labels this as its institutional request address. No automatic sending or shared sender substitution."
    }
  },
  "tr-numarasor": {
    "status": "reviewed_form_candidate",
    "checkedAt": "2026-11-04",
    "operationKind": "web_form",
    "sources": [
      "https://www.numarasor.com/numara-kaldirma-talebi"
    ],
    "summary": "Explicitly affirm ownership of the target number. The page warns that additional ownership documentation may be requested later; no ID upload is authorized or automated. No accepted outcome observed.",
    "limits": " No accepted request or deletion was observed.",
    "requestAccepted": false,
    "deletionVerified": false
  },
  "tr-telefonsorgulama": {
    "status": "reviewed_form_candidate",
    "checkedAt": "2026-11-04",
    "operationKind": "web_form",
    "sources": [
      "https://www.telefonsorgulama.com/iletisim.html"
    ],
    "summary": "Review a request for the subject’s own number and complete the broker’s verification/submission. Hidden reCAPTCHA token is page-owned, never supplied by the app.",
    "limits": " No accepted request or deletion was observed.",
    "requestAccepted": false,
    "deletionVerified": false
  },
  "tr-turkcell-rehber": {
    "status": "verified_subscriber_sms_channel",
    "checkedAt": "2026-11-04",
    "operationKind": "subscriber_sms",
    "sources": [
      "https://www.turkcell.com.tr/servisler/arama-fatura-tl/bilinmeyen-numaralar"
    ],
    "summary": "From the person’s own Turkcell line, the official page instructs REHBER IPTAL to 2200. The subscriber sends it themselves and preserves the response; no app SMS is sent.",
    "limits": "The official page offers REHBER to 2200 for registration status; do not confuse that with checking another person’s number. Number-lookup SMS costs 18 TL and 11832 calls cost 11.65 TL/minute on the inspected page. Never perform those paid queries. The page explicitly calls registration free; deletion-SMS price was not explicitly stated, so do not guarantee a free SMS or automatic completion. This confirms only the operator’s directory opt-out instruction, not suppression from every downstream website. No accepted request or deletion was observed.",
    "requestAccepted": false,
    "deletionVerified": false,
    "manualContact": {
      "kind": "subscriber_sms",
      "value": "REHBER IPTAL to 2200",
      "source": "https://www.turkcell.com.tr/servisler/arama-fatura-tl/bilinmeyen-numaralar",
      "purpose": "Only the subscriber sends this opt-out; no app SMS or paid lookup is used."
    }
  }
};
  const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
  return freeze(data);
});
