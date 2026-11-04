from __future__ import annotations

import pytest

from erase_me import profile, regions, sites
from conftest import FIXTURE_SKILL_DIR

REFS = FIXTURE_SKILL_DIR / "references"


@pytest.fixture
def person():
    return profile.build_profile(
        "zelda", "Zelda Quuxington", "ZZ", region="ZZ-TV", cities=["Testville", "Old Town"],
        phones=["+99 (555) 0142"], emails=["zelda@quux.example"],
    )


def test_load_global_sorted_by_priority():
    loaded = sites.load_global_sites(REFS)
    assert [s["id"] for s in loaded] == ["example-search", "example-callerid"]


def test_load_country_pack():
    loaded = sites.load_country_sites(REFS, "ZZ")
    assert [s["id"] for s in loaded] == ["peoplefind-lite", "mailer", "peoplefind", "oldbook"]


def test_missing_country_pack_is_empty():
    assert sites.load_country_sites(REFS, "QQ") == []


def test_applies_in_country():
    assert sites.applies_in_country({"countries": []}, "ZZ")
    assert sites.applies_in_country({"countries": ["*"]}, "ZZ")
    assert sites.applies_in_country({"countries": ["ZZ"]}, "ZZ")
    assert not sites.applies_in_country({"countries": ["GB"]}, "ZZ")


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("Zelda Quuxington", "zelda-quuxington"),
        ("  São   Paulo ", "sao-paulo"),
        ("Şükrü Iğdır", "sukru-igdir"),
        ("O'Brien-Smith", "o-brien-smith"),
        ("Straße", "strasse"),
        ("../../etc", "etc"),
        ("", ""),
    ],
)
def test_slugify(raw, expected):
    assert sites.slugify(raw) == expected


def test_region_name_lookup():
    assert regions.region_name("US-CA") == "California"
    assert regions.region_name("GB-SCT") == "Scotland"
    assert regions.region_name("ZZ-TV") == "TV"
    assert regions.region_name(None) == ""


def test_search_values(person):
    city = profile.current_city(person)
    values = sites.search_values(person, city=city, phone=person["phones"][0], email=person["emails"][0])
    assert values["first"] == "zelda"
    assert values["last"] == "quuxington"
    assert values["full"] == "zelda-quuxington"
    assert values["city"] == "testville"
    assert values["region"] == "tv"
    assert values["region_name"] == "tv"
    assert values["country"] == "zz"
    assert values["phone"] == "995550142"
    assert values["email"] == "zelda%40quux.example"


def test_fill_template_reports_missing():
    url, missing = sites.fill_template("https://x.example/{first}/{city}/{bogus}", {"first": "a", "city": ""})
    assert url is None
    assert missing == ["city", "bogus"]


def test_fill_template_ok():
    url, missing = sites.fill_template("https://x.example/{first}-{last}", {"first": "a", "last": "b"})
    assert url == "https://x.example/a-b"
    assert missing == []


def test_search_urls_one_per_city(person):
    site = next(s for s in sites.load_country_sites(REFS, "ZZ") if s["id"] == "peoplefind")
    result = sites.build_search(site, person)
    assert result["method"] == "url_template"
    assert result["urls"] == [
        "https://peoplefind.example.com/zelda-quuxington/tv/testville",
        "https://peoplefind.example.com/zelda-quuxington/tv/old-town",
    ]
    assert result["missing"] == []


def test_search_urls_phone_template(person):
    site = next(s for s in sites.load_country_sites(REFS, "ZZ") if s["id"] == "oldbook")
    assert sites.build_search(site, person)["urls"] == ["https://oldbook.example.com/phone/995550142"]


def test_search_urls_missing_phone_reported():
    bare = profile.build_profile("zelda", "Zelda Quuxington", "ZZ")
    site = next(s for s in sites.load_country_sites(REFS, "ZZ") if s["id"] == "oldbook")
    result = sites.build_search(site, bare)
    assert result["urls"] == []
    assert result["missing"] == ["phone"]


def test_search_manual_has_no_urls(person):
    site = next(s for s in sites.load_global_sites(REFS) if s["id"] == "example-callerid")
    result = sites.build_search(site, person)
    assert result["urls"] == []
    assert result["method"] == "manual"
    assert result["notes"] == "Search your number in the app."


def test_search_urls_are_capped():
    many = profile.build_profile("zelda", "Zelda Quuxington", "ZZ", cities=[f"City {i}" for i in range(30)])
    site = {"search": {"method": "url_template", "url_template": "https://x.example/{full}/{city}"}}
    assert len(sites.build_search(site, many)["urls"]) == sites.MAX_SEARCH_URLS


def test_search_urls_deduplicated():
    record = profile.build_profile("zelda", "Zelda Quuxington", "ZZ", cities=["Testville", "Oldtown"])
    site = {"search": {"method": "url_template", "url_template": "https://x.example/{full}"}}
    assert sites.build_search(site, record)["urls"] == ["https://x.example/zelda-quuxington"]


def test_site_lookup():
    found = sites.find_site(REFS, "ZZ", "oldbook")
    assert found["name"] == "OldBook Directory"
    assert sites.find_site(REFS, "ZZ", "example-search")["category"] == "search_engine"
    assert sites.find_site(REFS, "ZZ", "nope") is None
