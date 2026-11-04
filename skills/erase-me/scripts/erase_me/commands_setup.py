"""Handlers: init, consent, intake, laws, accounts, validate."""
from __future__ import annotations

import argparse

from . import accounts, consent, jurisdiction, paths, profile, validate
from .context import Result
from .errors import UsageError
from .output import format_law

EXIT_VALIDATION_FAILED = 2


def cmd_init(args: argparse.Namespace) -> Result:
    root = paths.init_home()
    data = {"home": str(root), "dir_mode": "700", "file_mode": "600"}
    return Result(data, f"Erase Me home is ready at {root} (folders 700, files 600).")


def cmd_consent(args: argparse.Namespace) -> Result:
    record = consent.build_consent(
        args.person, args.relationship, args.method,
        authorization_file=args.authorization_file, agent_name=args.agent_name, operator_email=args.operator_email,
    )
    consent.save_consent(record, replace=args.replace)
    data = {
        "person_id": record["person_id"], "relationship": record["relationship"], "method": record["method"],
        "consented_on": record["consented_on"], "has_authorization_file": record["authorization_file"] is not None,
        "authorization_sha256": record["authorization_sha256"],
    }
    human = (
        f"Consent recorded for {record['person_id']} ({record['relationship']}, {record['method']}) "
        f"on {record['consented_on']}."
    )
    return Result(data, human)


def cmd_intake(args: argparse.Namespace) -> Result:
    consent.require_consent(args.person)
    record = profile.build_profile(
        args.person, args.name, args.country, region=args.region, cities=args.city or [],
        age_range=args.age_range, phones=args.phone or [], emails=args.email or [],
        variants=args.variant or [], language=args.language,
    )
    profile.save_profile(record)
    data = {
        "person_id": record["person_id"], "country": record["country"], "region": record["region"],
        "cities": len(record["cities"]), "phones": len(record["phones"]), "emails": len(record["emails"]),
        "name_variants": len(record["name_variants"]),
    }
    human = (
        f"Profile saved for {record['person_id']}: country {record['country']}, {data['cities']} cities, "
        f"{data['phones']} phones, {data['emails']} emails. Stored locally only."
    )
    return Result(data, human)


def _laws_location(args: argparse.Namespace):
    if args.person and args.country:
        raise UsageError("Use either laws <person> or laws --country CC, not both.")
    if args.person:
        consent.require_consent(args.person)
        record = profile.load_profile(args.person)
        return record["country"], record.get("region")
    if not args.country:
        raise UsageError("Give a person (laws mom) or a country (laws --country GB).")
    country = profile.normalize_country(args.country)
    return country, profile.normalize_region(args.region, country)


def cmd_laws(args: argparse.Namespace) -> Result:
    country, region = _laws_location(args)
    regimes = jurisdiction.match_regimes(jurisdiction.load_regimes(paths.references_dir()), country, region)
    laws = [jurisdiction.summarize(r, country, region) for r in regimes]
    data = {"country": country, "region": region, "laws": laws}
    if not laws:
        human = (
            f"No privacy law in the Erase Me data covers {region or country} yet. "
            "Global channels and site opt-outs still work."
        )
        return Result(data, human)
    lines = []
    for law in laws:
        lines.extend(format_law(law))
    return Result(data, "\n".join(lines))


def cmd_accounts(args: argparse.Namespace) -> Result:
    data_file = accounts.load_accounts(paths.references_dir())
    hits = accounts.search(data_file, args.search, limit=args.limit)
    data = {
        "query": args.search, "sites": hits, "source": data_file.get("source"),
        "license": data_file.get("license"), "attribution": data_file.get("attribution"),
    }
    if not hits:
        return Result(data, "No account deletion entry matches that search.")
    lines = [f"{s.get('name')} ({s.get('difficulty')}): {s.get('url') or s.get('email') or 'no link'}" for s in hits]
    lines.append(f"Data from {data_file.get('attribution')} ({data_file.get('license')}).")
    return Result(data, "\n".join(lines))


def cmd_validate(args: argparse.Namespace) -> Result:
    skill = paths.skill_dir()
    errors = validate.validate_skill(skill)
    data = {"skill_dir": str(skill), "errors": errors, "error_count": len(errors)}
    if not errors:
        return Result(data, "All reference files and templates are valid.")
    human = "\n".join(errors + [f"{len(errors)} problems found."])
    return Result(data, human, EXIT_VALIDATION_FAILED)
