/* Official read-only route audit. No person or request data belongs in this file. */
(function(root,factory){const data=factory();if(typeof module==='object'&&module.exports)module.exports=data;else root.EraseBrokerAudit=data;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const data = {
  "smartbackgroundchecks": {
    "status": "reviewed_initial_form",
    "checkedAt": "2026-11-05",
    "operationKind": "record_removal",
    "sources": [
      "https://www.smartbackgroundchecks.com/privacy",
      "https://www.smartbackgroundchecks.com/optout",
      "https://www.smartbackgroundchecks.com/remove"
    ],
    "summary": "The companion checks the official privacy page and its published opt-out link before opening the reviewed subject/name/email form. Optional guarded submission requires the exact agreement and genuine challenge response. No profile data is sent to the privacy entry page.",
    "limits": "Initial form only. Blocked or changed entry navigation stops without disclosure. Verification, matching, final acceptance and deletion remain unverified.",
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
    "status": "official_delegated_privacy_tools",
    "checkedAt": "2026-11-06",
    "operationKind": "record_removal",
    "sources": [
      "https://www.addresses.com/optout.php",
      "https://cppa.ca.gov/data_broker_registry/registry.csv",
      "https://www.addresses.com/",
      "https://www.intelius.com/privacy-center/"
    ],
    "summary": "The current official homepage footer links to Intelius’s privacy center for privacy-rights tools. Follow this published delegation instead of the stale former destination.",
    "limits": "The delegated center has separate association, retrieval, account and background-suppression tools. A footer link does not prove that the Intelius association form covers this brand’s complete records. No request is duplicated or completion propagated.",
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
    "checkedAt": "2026-11-05",
    "operationKind": "record_removal",
    "sources": [
      "https://www.advancedbackgroundchecks.com/opt-out",
      "https://cppa.ca.gov/data_broker_registry/registry.csv"
    ],
    "summary": "Enter and review the initial name/contact fields in Erase Me. Optional guarded native submission checks the exact communications agreement, policy links and subject purpose. The broker handles its ordinary reCAPTCHA. Email verification, the unobserved second form and final processing remain outstanding.",
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
    "status": "published_privacy_contact",
    "checkedAt": "2026-11-05",
    "operationKind": "record_removal",
    "sources": [
      "https://www.beenverified.com/app/optout/search",
      "https://www.beenverified.com/faq/privacy/"
    ],
    "summary": "The official privacy policy publishes an own-information deletion/opt-out contact. A reviewed one-shot email can request suppression of an explicitly identified public record; no accessible form contract or completed removal is established.",
    "limits": "Public-record suppression differs from account deletion. Identity verification, processing, broker acceptance and independently verified deletion remain unverified.",
    "requestAccepted": false,
    "deletionVerified": false,
    "privacyContact": {
      "email": "privacy@beenverified.com",
      "kind": "privacy",
      "source": "https://www.beenverified.com/faq/privacy/",
      "checkedAt": "2026-11-05",
      "restriction": "Own-information deletion/opt-out request only. Supply an accurate own-record reference and review the exact outgoing message. Agent requests require separate written authorization; this sender supports own requests only."
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
    "status": "reviewed_initial_form",
    "checkedAt": "2026-11-05",
    "operationKind": "record_removal",
    "sources": [
      "https://www.familytreenow.com/optout",
      "https://www.familytreenow.com/privacy"
    ],
    "summary": "The official privacy entry exposes a first name, last name and email form with subject-only selection, exact communications authorization and genuine hCaptcha. Erase Me can fill and optionally attempt the reviewed native initial submission.",
    "limits": "Initial verification attempt only. Later email continuation, record selection, broker acceptance and deletion are unverified.",
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
    "status": "reviewed_association_prefill",
    "checkedAt": "2026-11-06",
    "operationKind": "association_suppression",
    "sources": [
      "https://suppression.peopleconnect.us/login",
      "https://app.instantcheckmate.com/privacy-center/"
    ],
    "summary": "A separate private review can fill the official association/relative opt-out fields for this brand. This is distinct from complete background-report suppression and account deletion.",
    "limits": "Only the exact reviewed own-name, birth date, city, state and contact email are filled. Other account/retrieval/deletion controls remain untouched. Verification and final submission stay on the official site; no accepted request or deletion was established.",
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
    "status": "reviewed_association_prefill",
    "checkedAt": "2026-11-06",
    "operationKind": "association_suppression",
    "sources": [
      "https://suppression.peopleconnect.us/login",
      "https://app.intelius.com/privacy-center/"
    ],
    "summary": "A separate private review can fill the official association/relative opt-out fields for this brand. This is distinct from complete background-report suppression and account deletion.",
    "limits": "Only the exact reviewed own-name, birth date, city, state and contact email are filled. Other account/retrieval/deletion controls remain untouched. Verification and final submission stay on the official site; no accepted request or deletion was established.",
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
    "status": "reviewed_transient_prefill",
    "checkedAt": "2026-11-05",
    "operationKind": "record_removal",
    "sources": [
      "https://www.mylife.com/privacyrequest",
      "https://mylife.jotform.com/260284407610047"
    ],
    "summary": "The official privacy-request page links the pinned deletion/opt-out JotForm. A separate transient review fills first/last name, state, city, ZIP and birth year after own-information authorization.",
    "limits": "Prefill only; no submission or identity upload. No email, phone or street address is filled. Genuine challenge, matching and subsequent verification remain manual or unverified.",
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
    "status": "reviewed_transient_prefill",
    "checkedAt": "2026-11-05",
    "operationKind": "record_removal",
    "sources": [
      "https://www.peoplefinders.com/opt-out"
    ],
    "summary": "A separate transient own-record review fills only first name, last name and the required US street, city and state matching fields on the reviewed official form.",
    "limits": "Prefill only. Middle name, email, phone and date of birth stay empty. Accuracy certification, genuine challenge, submission, matching and deletion remain manual or unverified.",
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
    "status": "published_privacy_contact",
    "checkedAt": "2026-11-05",
    "operationKind": "record_removal",
    "sources": [
      "https://www.peoplelooker.com/opt-out",
      "https://www.peoplelooker.com/privacy-policy/"
    ],
    "summary": "The official privacy policy publishes an own-information deletion/opt-out contact. A reviewed one-shot email can request suppression of an explicitly identified public record; no accessible form contract or completed removal is established.",
    "limits": "Public-record suppression differs from account deletion. Identity verification, processing, broker acceptance and independently verified deletion remain unverified.",
    "requestAccepted": false,
    "deletionVerified": false,
    "privacyContact": {
      "email": "privacy@peoplelooker.com",
      "kind": "privacy",
      "source": "https://www.peoplelooker.com/privacy-policy/",
      "checkedAt": "2026-11-05",
      "restriction": "Own-information deletion/opt-out request only. Supply an accurate own-record reference and review the exact outgoing message. Agent requests require separate written authorization; this sender supports own requests only."
    }
  },
  "thatsthem": {
    "status": "reviewed_transient_prefill",
    "checkedAt": "2026-11-05",
    "operationKind": "record_removal",
    "sources": [
      "https://thatsthem.com/optout"
    ],
    "summary": "A separate transient review fills the approved own name, contact email, street, city, state, ZIP and phone fields on the reviewed official opt-out form.",
    "limits": "Prefill only. Extra identity values are excluded from saved state and backups. Genuine challenge, submission, matched-record acceptance and deletion remain manual or unverified.",
    "requestAccepted": false,
    "deletionVerified": false
  },
  "truepeoplesearch": {
    "status": "reviewed_initial_form",
    "checkedAt": "2026-11-06",
    "operationKind": "record_removal",
    "sources": [
      "https://www.truepeoplesearch.com/privacy",
      "https://www.truepeoplesearch.com/removal"
    ],
    "summary": "The companion checks the official privacy page and published Opt-Out Form link before the initial name/email verification form. Optional submission requires exact own-request/contact authorization and the genuine hCaptcha response.",
    "limits": "Only the initial verification step is implemented. Optional middle/agent fields stay empty, hidden fallback and challenge tokens remain intact. No live request was submitted; email continuation, matching, acceptance and deletion remain unverified.",
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
    "status": "reviewed_association_prefill",
    "checkedAt": "2026-11-06",
    "operationKind": "association_suppression",
    "sources": [
      "https://suppression.peopleconnect.us/login",
      "https://app.truthfinder.com/privacy-center/"
    ],
    "summary": "A separate private review can fill the official association/relative opt-out fields for this brand. This is distinct from complete background-report suppression and account deletion.",
    "limits": "Only the exact reviewed own-name, birth date, city, state and contact email are filled. Other account/retrieval/deletion controls remain untouched. Verification and final submission stay on the official site; no accepted request or deletion was established.",
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
    "status": "reviewed_association_prefill",
    "checkedAt": "2026-11-06",
    "operationKind": "association_suppression",
    "sources": [
      "https://suppression.peopleconnect.us/login",
      "https://app.ussearch.com/privacy-center/"
    ],
    "summary": "A separate private review can fill the official association/relative opt-out fields for this brand. This is distinct from complete background-report suppression and account deletion.",
    "limits": "Only the exact reviewed own-name, birth date, city, state and contact email are filled. Other account/retrieval/deletion controls remain untouched. Verification and final submission stay on the official site; no accepted request or deletion was established.",
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
    "status": "reviewed_initial_form",
    "checkedAt": "2026-11-05",
    "operationKind": "record_removal",
    "sources": [
      "https://www.whitepages.com/suppression-requests",
      "https://www.whitepages.com/static/dist/standardizeWpUrl.js"
    ],
    "summary": "The normal desktop browser exposed the first suppression step. Enter and explicitly confirm your own direct Whitepages person URL inside Erase Me; the companion can prefill only that first-step field. It never clicks Next or initiates a phone verification.",
    "limits": "Listing URL syntax and your manual confirmation do not establish an automatic identity match. Later record selection, phone verification, submission and deletion remain manual or unverified.",
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
    "status": "official_delegated_privacy_tools",
    "checkedAt": "2026-11-06",
    "operationKind": "record_removal",
    "sources": [
      "https://suppression.peopleconnect.us/login",
      "https://cppa.ca.gov/data_broker_registry/registry.csv",
      "https://www.zabasearch.com/",
      "https://www.intelius.com/privacy-center/"
    ],
    "summary": "The current official homepage footer links to Intelius’s privacy center for privacy-rights tools. Follow this published delegation instead of the stale former destination.",
    "limits": "The delegated center has separate association, retrieval, account and background-suppression tools. A footer link does not prove that the Intelius association form covers this brand’s complete records. No request is duplicated or completion propagated.",
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
    "checkedAt": "2026-11-05",
    "operationKind": "marketing_suppression_registration",
    "sources": [
      "https://cmadnm.cawebhosting.ca/submit.asp"
    ],
    "summary": "Review your own exact Canadian mailing fields inside the separate private dialog. Prefill and an optional guarded marketing-registration attempt are supported; address values are not saved. This does not delete broker records.",
    "limits": "Suppresses new-contact addressed marketing among participating CMA members, not underlying broker records or unaddressed flyers. Public page states six years and around six weeks to take effect. No acceptance observed.",
    "requestAccepted": false,
    "deletionVerified": false
  },
  "ca-dncl": {
    "status": "reviewed_phone_preference_prefill",
    "checkedAt": "2026-11-06",
    "operationKind": "do_not_call_registration",
    "sources": [
      "https://www.lnnte-dncl.gc.ca/en/Consumer/Register-your-number"
    ],
    "summary": "Enter and review your own telephone number inside the private form. The companion fills only the first registration field. A shared-line registration affects everyone using that number.",
    "limits": "Marketing-call preference registration, not broker deletion. No number was submitted during inspection. Later registration, verification and acceptance remain manual and unverified.",
    "requestAccepted": false,
    "deletionVerified": false
  },
  "canada411": {
    "status": "reviewed_directory_prefill",
    "checkedAt": "2026-11-06",
    "operationKind": "directory_listing_removal",
    "sources": [
      "https://www.canada411.ca/help.html?key=faq"
    ],
    "summary": "The official FAQ publishes a web-only listing-removal modal. Review your own profile name, listed Canadian number and contact email before filling it once with the privacy reason selected.",
    "limits": "Web listing only; telephone-provider unlisting is separate. Optional comments and the image challenge stay untouched. Final submission, acceptance and deletion remain unverified.",
    "requestAccepted": false,
    "deletionVerified": false
  },
  "192com": {
    "status": "reviewed_directory_prefill",
    "checkedAt": "2026-11-06",
    "operationKind": "record_removal",
    "sources": [
      "https://www.192.com/c01/new-request/"
    ],
    "summary": "The official own-record suppression form is reachable in a normal browser. Review your first name, surname, full UK postcode and contact email inside Erase Me before one prefill.",
    "limits": "Optional telephone and other people’s fields stay blank. The genuine challenge, submit and email confirmation remain on the official service. No request acceptance or deletion was established.",
    "requestAccepted": false,
    "deletionVerified": false
  },
  "gb-bt-phonebook": {
    "status": "official_manual_channel_verified",
    "checkedAt": "2026-11-06",
    "operationKind": "provider_directory_preference",
    "sources": [
      "https://www.bt.com/help/home-phone/manage-service/how-do-i-sign-up-to-ex-directory-services-",
      "https://www.bt.com/privacy-policy/",
      "https://btprivacy.my.onetrust.com/webform/a0327856-31fc-4f51-b6d3-1c9e883e1ecf/064635fb-4ae0-40ad-a7fc-d2004310c918"
    ],
    "summary": "BT account holder calls the provider to choose Ex-directory No calls or Directory Enquiries Only.",
    "limits": "The two directory options are described as free but require a provider call. BT also publishes a general rights portal; no directory-specific choice was observed there, so it is not used for automatic account/contract deletion. No request or deletion was established.",
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
    "status": "reviewed_phone_preference_prefill",
    "checkedAt": "2026-11-06",
    "operationKind": "do_not_call_registration",
    "sources": [
      "https://www.tpsonline.org.uk/register",
      "https://www.tpsonline.org.uk/pages/contact"
    ],
    "summary": "Enter and review your own telephone number inside the private form. The companion fills only the first registration field. It selects Residential only before the TPS number step.",
    "limits": "Marketing-call preference registration, not broker deletion. No number was submitted during inspection. Later registration, verification and acceptance remain manual and unverified.",
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
    "status": "reviewed_privacy_email",
    "checkedAt": "2026-11-06",
    "operationKind": "provider_request",
    "sources": [
      "https://unternehmen.11880.com/faq",
      "https://unternehmen.11880.com/datenschutz"
    ],
    "summary": "The official privacy policy publishes a direct email for informal processing objections and describes erasure/objection rights. A separate own-public-record privacy message can be reviewed and sent once.",
    "limits": "This is an initial privacy/processing-objection request. The directory FAQ still directs source-feed removal to the subscriber’s telephone provider. Sending does not close an account or establish directory deletion.",
    "requestAccepted": false,
    "deletionVerified": false,
    "privacyContact": {
      "email": "datenschutz.solutions@11880.com",
      "kind": "privacy",
      "source": "https://unternehmen.11880.com/datenschutz",
      "checkedAt": "2026-11-06",
      "restriction": "Own-public-record privacy/processing-objection request only. Provider subscriber-feed changes remain separate; no account closure or verified directory removal is promised."
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
    "checkedAt": "2026-11-06",
    "operationKind": "subscriber_privacy_request",
    "sources": [
      "https://www.vodafone.com.tr/",
      "https://www.vodafone.com.tr/gizlilik-ve-guvenlik-politikalari"
    ],
    "summary": "Subscriber handles the operator’s directory preference or privacy request. Vodafone’s privacy notice permits email from an address already recorded and verified in its systems, or signed/physical channels. A shared service mailbox is not silently substituted.",
    "limits": "Vodafone’s ordinary email channel requires a previously recorded and verified sender; signed postal/KEP alternatives have separate requirements. No new dedicated sender is substituted. Türk Telekom coverage and directory-specific acceptance remain unverified.",
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
    "checkedAt": "2026-11-05",
    "operationKind": "web_form",
    "sources": [
      "https://www.nosorgulama.com.tr/iletisim/"
    ],
    "summary": "Enter and review your own name, contact email and plain removal request inside Erase Me. Optional guarded submission checks the exact KVKK/privacy notice and policy sources. The honeypot and anti-forgery values remain page-owned; acceptance and deletion are unverified.",
    "limits": " No accepted request or deletion was observed.",
    "requestAccepted": false,
    "deletionVerified": false
  },
  "tr-numaraara": {
    "status": "reviewed_form_candidate",
    "checkedAt": "2026-11-05",
    "operationKind": "web_form",
    "sources": [
      "https://www.numaraara.com/iletisim"
    ],
    "summary": "Enter and review the own-number request inside Erase Me. Optional guarded submission checks the exact KVKK agreement and can use the separately installed free local helper for the reviewed five-character image code. Unresolved challenges stop the action; hidden CSRF/form fields remain page-owned.",
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
    "checkedAt": "2026-11-05",
    "operationKind": "web_form",
    "sources": [
      "https://www.numarasor.com/numara-kaldirma-talebi"
    ],
    "summary": "Enter and review your own target number, name, contact email and plain request inside Erase Me. Optional guarded submission checks the number-owner relationship and notice. Additional ownership documentation may be requested later; no ID upload is authorized or automated. Acceptance and deletion are unverified.",
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
