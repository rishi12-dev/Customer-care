from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from app.models.entities import UserRole


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    csrf_token: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=160)
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = UserRole.customer_care


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=160)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    role: UserRole | None = None
    is_active: bool | None = None


class AvatarUpdate(BaseModel):
    avatar_data_url: str | None = Field(default=None, max_length=1_000_000)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str
    avatar_data_url: str | None = None
    role: UserRole
    is_active: bool
    created_at: datetime


class OrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_no: str
    customer_name: str
    customer_phone_number: str
    alt_no: str | None
    docket_number: str
    shipment: str
    remark: str | None
    current_status: str
    expected_delivery: date | None
    delivery_date: date | None


class SearchResponse(BaseModel):
    query: str
    detected_type: str
    duration_ms: int
    results: list[OrderRead]


class UploadPreview(BaseModel):
    headers: list[str]
    rows: list[dict]
    records: int
    errors: list[str]
    warnings: list[str]
    valid: bool


class UploadCommitResponse(BaseModel):
    records: int
    duration_ms: int
    errors: list[str]
    warnings: list[str]
    backup_id: int
    job_id: str | None = None
    status: str = "completed"


class DashboardResponse(BaseModel):
    total_orders: int
    delivered: int
    pending: int
    in_transit: int
    ofd: int
    ndr: int
    rto: int
    delayed: int
    latest_upload: dict | None
    database_status: str
    courier_wise: list[dict]
    status_wise: list[dict]
    daily_upload_trend: list[dict]
    pincode_total: int
    pincode_unique: int
    pincode_active: int
    pincode_inactive: int
    pincode_courier_wise: list[dict]
    pincode_state_wise: list[dict]
    pincode_warehouse_wise: list[dict]


class TrackingSyncResponse(BaseModel):
    checked: int
    updated: int
    errors: list[str]
    duration_ms: int


class PincodeServiceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    pincode: str
    state: str | None
    city: str | None
    zone: str | None
    active: bool
    warehouse: str | None
    courier: str
    service_date: date | None
    source_file: str | None


class PincodeSearchResponse(BaseModel):
    query: str
    pincode: str
    results: list[PincodeServiceRead]


class SettingUpdate(BaseModel):
    company_name: str = Field(min_length=2, max_length=120)
    theme: str = Field(pattern="^(light|dark|system)$")
