from app.services.pincode_service import (
    resolve_pincode_query,
    normalize_pincode,
)


def test_resolve_pincode_query_7_digits():
    pincode, was_divided = resolve_pincode_query("1100010")
    assert pincode == "110001"
    assert was_divided is True


def test_resolve_pincode_query_6_digits():
    pincode, was_divided = resolve_pincode_query("110001")
    assert pincode == "110001"
    assert was_divided is False


def test_resolve_pincode_query_float_string():
    pincode, was_divided = resolve_pincode_query("110001.0")
    assert pincode == "110001"
    assert was_divided is False


def test_resolve_pincode_query_with_dashes():
    pincode, was_divided = resolve_pincode_query("361-0020")
    assert pincode == "361002"
    assert was_divided is True


def test_normalize_pincode_matches_resolved():
    assert normalize_pincode("3610020") == "361002"
    assert normalize_pincode("361002") == "361002"
