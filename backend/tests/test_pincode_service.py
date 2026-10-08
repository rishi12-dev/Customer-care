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


def test_row_on_page_and_page_number_calculation():
    from app.services.pincode_service import _enrich_service_dict
    from app.models.entities import PincodeService

    item = PincodeService(
        id=1,
        s_no=167,
        pincode="600013",
        courier="The Professional Couriers.",
        warehouse="Chennai Store",
        active=False,
    )
    enriched = _enrich_service_dict(item)
    assert enriched["s_no"] == 167
    assert enriched["divided_by_10"] == 16.7
    assert enriched["page_number"] == 17
    assert enriched["row_on_page"] == 7
    assert enriched["formula"] == "167 ÷ 10 = 16.7"


def test_flexible_header_normalization():
    import io
    import pandas as pd
    from app.services.pincode_service import read_pincode_excel

    # Excel with lowercase & custom headers
    data = {
        "S No": [167],
        "PIN CODE": ["600013"],
        "Store": ["Kolkata Store"],
        "Courier Partner": ["Delhivery"],
        "Status": ["Active"],
    }
    df = pd.DataFrame(data)
    out = io.BytesIO()
    with pd.ExcelWriter(out, engine="openpyxl") as writer:
        df.to_excel(writer, index=False)
    content = out.getvalue()

    frame, errors, warnings = read_pincode_excel(content, "Kolkata_Pincodes.xlsx")
    assert errors == []
    assert "pincode" in frame.columns
    assert "sNo" in frame.columns
    assert "warehouse" in frame.columns
    assert "courier" in frame.columns
    assert frame["sNo"].iloc[0] == 167
    assert frame["warehouse"].iloc[0] == "Kolkata Store"
