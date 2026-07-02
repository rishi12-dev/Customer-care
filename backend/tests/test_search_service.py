from app.services.search_service import detect_query_type


def test_detects_phone_query():
    assert detect_query_type("9876543210") == "phone"


def test_detects_mixed_order_or_docket_query():
    assert detect_query_type("ORD12345") == "order_or_docket"
