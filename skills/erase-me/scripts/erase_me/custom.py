"""Input checks for the add command: sites found by search with no reference file."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from . import jurisdiction
from .errors import RefusalError, UsageError
from .profile import EMAIL_RE, clean_text
from .schema import DOMAIN_RE
from .sites import SITE_CATEGORIES

MAX_SITE_NAME = 80


def build_site(name: str, domain: str, email: Optional[str], category: Optional[str]) -> Dict[str, Any]:
    clean_domain = (domain or "").strip().lower()
    if not DOMAIN_RE.fullmatch(clean_domain):
        raise UsageError(f"Domain must be a bare name like example.com.br, not '{domain}'.")
    clean_email = email.strip().lower() if email else None
    if clean_email is not None and not EMAIL_RE.fullmatch(clean_email):
        raise UsageError(f"'{email}' does not look like an email address.")
    if category is not None and category not in SITE_CATEGORIES:
        raise UsageError(f"Unknown category '{category}'. Use one of: {', '.join(SITE_CATEGORIES)}.")
    clean_name = clean_text(name, "Site name", max_length=MAX_SITE_NAME)
    return {"name": clean_name, "domain": clean_domain, "email": clean_email, "category": category}


def email_domain_mismatch(site: Optional[Dict[str, Any]]) -> bool:
    """True when the email is not at the site's domain or one of its subdomains."""
    if not site or not site.get("email") or not site.get("domain"):
        return False
    email_domain = str(site["email"]).rsplit("@", 1)[-1].lower()
    domain = str(site["domain"]).lower()
    return not (email_domain == domain or email_domain.endswith("." + domain))


def pick_regime(regimes: List[Dict[str, Any]], record: Dict[str, Any], code: Optional[str]) -> Optional[str]:
    """The named regime, or the strongest in-force one for the person (the same choice plan makes)."""
    if code:
        regime = next((r for r in regimes if r.get("code") == code), None)
        if regime is None:
            raise UsageError(f"Unknown regime '{code}'. See laws --country CC for the codes.")
        if not jurisdiction.usable_for_requests(regime):
            raise RefusalError(f"{regime.get('name')} is not in force yet, so it cannot be used for requests.")
        return code
    matched = jurisdiction.match_regimes(regimes, record["country"], record.get("region"))
    primary = jurisdiction.primary_regime(matched, record.get("region"))
    return primary.get("code") if primary else None
