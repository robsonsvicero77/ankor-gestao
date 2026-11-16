from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import asyncpg
import httpx
import os
import logging
import asyncio
import re
from pathlib import Path
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from typing import Any, List, Literal, Optional
import uuid
from datetime import date, datetime, timezone, timedelta
import csv
import io
import resend

try:
    from .database import database
except ImportError:
    from database import database

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

APP_ENV = os.environ.get("APP_ENV", "development").strip().lower()
if APP_ENV not in {"development", "test", "production"}:
    raise RuntimeError("APP_ENV must be development, test, or production")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "").strip()
auth_http_client: Optional[httpx.AsyncClient] = None

configured_origins = os.environ.get("CORS_ORIGINS", "")
CORS_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in configured_origins.split(",")
    if origin.strip()
]
if APP_ENV == "production":
    if not CORS_ORIGINS or "*" in CORS_ORIGINS:
        raise RuntimeError("Set explicit CORS_ORIGINS for production")
    if any(not origin.startswith("https://") for origin in CORS_ORIGINS):
        raise RuntimeError("Production CORS_ORIGINS must use HTTPS")
    if SUPABASE_URL and not SUPABASE_URL.startswith("https://"):
        raise RuntimeError("SUPABASE_URL must use HTTPS in production")
elif not CORS_ORIGINS:
    CORS_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]

# Resend Configuration
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

# Create the main app
app = FastAPI(title="Ankor Gestão API", version="1.0.0")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    tenant_id: str
    created_at: str
    role: str

class ReceivableCreate(BaseModel):
    description: str
    client_name: str
    amount_cents: int
    due_date: str  # ISO format date
    is_recurring: Optional[bool] = False
    recurrence_type: Optional[str] = None  # monthly, weekly, yearly
    recurrence_end_date: Optional[str] = None

class ReceivableUpdate(BaseModel):
    description: Optional[str] = None
    client_name: Optional[str] = None
    amount_cents: Optional[int] = None
    due_date: Optional[str] = None
    is_recurring: Optional[bool] = None
    recurrence_type: Optional[str] = None
    recurrence_end_date: Optional[str] = None

class ReceivableResponse(BaseModel):
    id: str
    tenant_id: str
    description: str
    client_name: str
    amount_cents: int
    due_date: str
    paid_at: Optional[str] = None
    status: str  # PENDENTE, PAGO, ATRASADO
    is_recurring: Optional[bool] = False
    recurrence_type: Optional[str] = None
    recurrence_end_date: Optional[str] = None
    parent_id: Optional[str] = None
    created_at: str
    updated_at: str

class PayableCreate(BaseModel):
    description: str
    category: str
    amount_cents: int
    due_date: str
    is_recurring: Optional[bool] = False
    recurrence_type: Optional[str] = None  # monthly, weekly, yearly
    recurrence_end_date: Optional[str] = None

class PayableUpdate(BaseModel):
    description: Optional[str] = None
    category: Optional[str] = None
    amount_cents: Optional[int] = None
    due_date: Optional[str] = None
    is_recurring: Optional[bool] = None
    recurrence_type: Optional[str] = None
    recurrence_end_date: Optional[str] = None

class PayableResponse(BaseModel):
    id: str
    tenant_id: str
    description: str
    category: str
    amount_cents: int
    due_date: str
    paid_at: Optional[str] = None
    status: str
    is_recurring: Optional[bool] = False
    recurrence_type: Optional[str] = None
    recurrence_end_date: Optional[str] = None
    parent_id: Optional[str] = None
    created_at: str
    updated_at: str

ProposalStatus = Literal[
    "RASCUNHO",
    "ENVIADA",
    "EM_NEGOCIACAO",
    "APROVADA",
    "RECUSADA",
    "EXPIRADA",
    "CANCELADA",
]


class ProposalSection(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    body: str = Field(default="", max_length=20000)

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("O título da seção é obrigatório")
        return value


class ProposalContent(BaseModel):
    sections: List[ProposalSection] = Field(default_factory=list, max_length=30)
    city: Optional[str] = Field(default=None, max_length=120)


class ProposalCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    client_name: str = Field(min_length=1, max_length=200)
    contact_name: Optional[str] = Field(default=None, max_length=200)
    issue_date: date
    valid_until: date
    amount_cents: int = Field(ge=0)
    status: ProposalStatus = "RASCUNHO"
    content: ProposalContent = Field(default_factory=ProposalContent)

    @field_validator("title", "client_name")
    @classmethod
    def required_text_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Este campo é obrigatório")
        return value

    @model_validator(mode="after")
    def validity_must_not_precede_issue_date(self):
        if self.valid_until < self.issue_date:
            raise ValueError("A validade não pode ser anterior à emissão")
        return self


class ProposalUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    client_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    contact_name: Optional[str] = Field(default=None, max_length=200)
    issue_date: Optional[date] = None
    valid_until: Optional[date] = None
    amount_cents: Optional[int] = Field(default=None, ge=0)
    status: Optional[ProposalStatus] = None
    content: Optional[ProposalContent] = None

    @field_validator("title", "client_name")
    @classmethod
    def supplied_required_text_must_not_be_blank(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            raise ValueError("Este campo não pode ser nulo")
        value = value.strip()
        if not value:
            raise ValueError("Este campo é obrigatório")
        return value

    @field_validator("issue_date", "valid_until", "amount_cents", "status", "content")
    @classmethod
    def supplied_required_fields_must_not_be_null(cls, value: Any) -> Any:
        if value is None:
            raise ValueError("Este campo não pode ser nulo")
        return value

    @model_validator(mode="after")
    def supplied_validity_must_not_precede_issue_date(self):
        if (
            self.issue_date is not None
            and self.valid_until is not None
            and self.valid_until < self.issue_date
        ):
            raise ValueError("A validade não pode ser anterior à emissão")
        return self


class ProposalStatusUpdate(BaseModel):
    status: ProposalStatus


class ProposalResponse(BaseModel):
    id: str
    tenant_id: str
    title: str
    client_name: str
    contact_name: Optional[str] = None
    issue_date: str
    valid_until: str
    amount_cents: int
    status: ProposalStatus
    content: ProposalContent
    created_at: str
    updated_at: str


def _cpf_is_valid(document: str) -> bool:
    if len(document) != 11 or len(set(document)) == 1:
        return False

    digits = [int(digit) for digit in document]
    first_check = (
        sum(digit * weight for digit, weight in zip(digits[:9], range(10, 1, -1))) * 10
    ) % 11
    first_check = 0 if first_check == 10 else first_check
    second_check = (
        sum(digit * weight for digit, weight in zip(digits[:10], range(11, 1, -1))) * 10
    ) % 11
    second_check = 0 if second_check == 10 else second_check
    return digits[9:] == [first_check, second_check]


def _cnpj_is_valid(document: str) -> bool:
    if not re.fullmatch(r"[A-Z0-9]{12}[0-9]{2}", document) or len(set(document)) == 1:
        return False

    def check_digit(value: str, weights: List[int]) -> str:
        total = sum(
            (ord(character) - 48) * weight
            for character, weight in zip(value, weights)
        )
        remainder = total % 11
        return "0" if remainder < 2 else str(11 - remainder)

    first_check = check_digit(document[:12], [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
    second_check = check_digit(
        document[:12] + first_check,
        [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
    )
    return document[-2:] == first_check + second_check


class ClientInput(BaseModel):
    person_type: Literal["PF", "PJ"]
    name: str = Field(min_length=1, max_length=200)
    trade_name: Optional[str] = Field(default=None, max_length=200)
    document: str = Field(max_length=32)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=30)
    contact_name: Optional[str] = Field(default=None, max_length=200)
    postal_code: Optional[str] = None
    street: Optional[str] = Field(default=None, max_length=200)
    number: Optional[str] = Field(default=None, max_length=30)
    complement: Optional[str] = Field(default=None, max_length=120)
    district: Optional[str] = Field(default=None, max_length=120)
    city: Optional[str] = Field(default=None, max_length=120)
    state: Optional[str] = None
    notes: Optional[str] = Field(default=None, max_length=3000)

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("O nome ou razão social é obrigatório")
        return value

    @field_validator(
        "trade_name", "phone", "contact_name", "street", "number", "complement",
        "district", "city", "notes",
        mode="before",
    )
    @classmethod
    def normalize_optional_text(cls, value: Any) -> Any:
        if value is None:
            return None
        if not isinstance(value, str):
            return value
        value = value.strip()
        return value or None

    @field_validator("document", mode="before")
    @classmethod
    def normalize_document(cls, value: str) -> str:
        if not isinstance(value, str):
            return value
        return re.sub(r"[^A-Za-z0-9]", "", value).upper()

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: Any) -> Any:
        if value is None:
            return None
        if not isinstance(value, str):
            return value
        value = value.strip()
        return value or None

    @field_validator("postal_code", mode="before")
    @classmethod
    def normalize_postal_code(cls, value: Any) -> Any:
        if value is None:
            return None
        if not isinstance(value, str):
            return value
        value = re.sub(r"\D", "", value)
        if not value:
            return None
        if len(value) != 8:
            raise ValueError("Informe um CEP com 8 dígitos")
        return value

    @field_validator("state", mode="before")
    @classmethod
    def normalize_state(cls, value: Any) -> Any:
        if value is None:
            return None
        if not isinstance(value, str):
            return value
        value = value.strip().upper()
        if not value:
            return None
        if not re.fullmatch(r"[A-Z]{2}", value):
            raise ValueError("Informe a sigla do estado com 2 letras")
        return value

    @model_validator(mode="after")
    def document_must_match_person_type(self):
        is_valid = (
            _cpf_is_valid(self.document)
            if self.person_type == "PF"
            else _cnpj_is_valid(self.document)
        )
        if not is_valid:
            document_type = "CPF" if self.person_type == "PF" else "CNPJ"
            raise ValueError(f"Informe um {document_type} válido")
        return self


class ClientResponse(BaseModel):
    id: str
    tenant_id: str
    person_type: Literal["PF", "PJ"]
    name: str
    trade_name: Optional[str] = None
    document: str
    email: Optional[str] = None
    phone: Optional[str] = None
    contact_name: Optional[str] = None
    postal_code: Optional[str] = None
    street: Optional[str] = None
    number: Optional[str] = None
    complement: Optional[str] = None
    district: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    notes: Optional[str] = None
    created_at: str
    updated_at: str


class LedgerEntryResponse(BaseModel):
    id: str
    tenant_id: str
    entry_type: str  # SALDO_INICIAL, RECEITA_PAGA, DESPESA_PAGA, AJUSTE
    direction: str   # CREDIT, DEBIT
    amount_cents: int
    occurred_at: str
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    note: Optional[str] = None
    created_at: str

class InitialBalanceCreate(BaseModel):
    amount_cents: int
    note: Optional[str] = "Saldo inicial"

class AdjustmentCreate(BaseModel):
    amount_cents: int  # positive or negative
    reason: str

class DashboardResponse(BaseModel):
    current_balance_cents: int
    receivables_30d_cents: int
    payables_30d_cents: int
    projected_balance_cents: int
    timeline_7d: List[dict]
    alert_status: str  # OK, ATENCAO, RISCO
    pending_receivables_count: int
    pending_payables_count: int
    overdue_receivables_count: int
    overdue_payables_count: int
    projection_chart: List[dict]  # Daily projection for chart

class JobStatusResponse(BaseModel):
    job_name: str
    last_run: Optional[str] = None
    status: str
    message: str

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(status_code=503, detail="Supabase Auth não está configurado")

    client = auth_http_client
    owns_client = client is None
    if client is None:
        client = httpx.AsyncClient(timeout=10)

    try:
        response = await client.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {credentials.credentials}",
            },
        )
    except httpx.RequestError as exc:
        logger.exception("Supabase Auth request failed")
        raise HTTPException(status_code=503, detail="Não foi possível validar a sessão") from exc
    finally:
        if owns_client:
            await client.aclose()

    if response.status_code in {401, 403}:
        raise HTTPException(status_code=401, detail="Sessão inválida ou expirada")
    if response.status_code != 200:
        logger.error("Supabase Auth returned HTTP %s", response.status_code)
        raise HTTPException(status_code=503, detail="Não foi possível validar a sessão")

    try:
        auth_user = response.json()
        user_id = str(uuid.UUID(auth_user["id"]))
    except (ValueError, KeyError, TypeError):
        logger.error("Supabase Auth returned an invalid user response")
        raise HTTPException(status_code=503, detail="Resposta de autenticação inválida")

    user = await database.fetch_one("users", {"id": user_id})
    if not user:
        logger.error("Supabase Auth user %s has no application profile", user_id)
        raise HTTPException(status_code=403, detail="Perfil de usuário não encontrado")
    return {
        "user_id": user["id"],
        "tenant_id": user["tenant_id"],
        "role": user["role"],
    }

# ==================== RBAC HELPERS ====================

def require_role(required_role: str):
    async def dependency(current_user: dict = Depends(get_current_user)):
        user = await database.fetch_one("users", {"id": current_user["user_id"]})
        if not user or user["role"] != required_role:
            raise HTTPException(status_code=403, detail="Acesso negado: permissão insuficiente")
        return user
    return dependency

# ==================== EXEMPLO DE ROTA PROTEGIDA POR ROLE ====================

@api_router.get("/admin/only")
async def admin_only_route(user=Depends(require_role("admin"))):
    return {"message": f"Olá, admin {user['email']}!"}

# ==================== AUTH ENDPOINTS ====================

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    user = await database.fetch_one("users", {"id": current_user["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return UserResponse(**user)

# ==================== LEDGER HELPERS ====================

async def create_ledger_entry(tenant_id: str, entry_type: str, direction: str, 
                               amount_cents: int, reference_type: str = None, 
                               reference_id: str = None, note: str = None):
    now = datetime.now(timezone.utc).isoformat()
    entry = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "entry_type": entry_type,
        "direction": direction,
        "amount_cents": amount_cents,
        "occurred_at": now,
        "reference_type": reference_type,
        "reference_id": reference_id,
        "note": note,
        "created_at": now
    }
    await database.insert("ledger_entries", entry)
    return entry

async def calculate_current_balance(tenant_id: str) -> int:
    """Calculate balance from ledger entries"""
    entries = await database.fetch_many("ledger_entries", {"tenant_id": tenant_id}, 10000)
    
    balance = 0
    for entry in entries:
        if entry["direction"] == "CREDIT":
            balance += entry["amount_cents"]
        else:
            balance -= entry["amount_cents"]
    return balance

# ==================== BALANCE ENDPOINTS ====================

@api_router.post("/balance/initial", response_model=LedgerEntryResponse)
async def set_initial_balance(data: InitialBalanceCreate, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user["tenant_id"]
    
    # Check if initial balance already exists
    existing = await database.fetch_one("ledger_entries", {
        "tenant_id": tenant_id, 
        "entry_type": "SALDO_INICIAL"
    })
    if existing:
        raise HTTPException(status_code=400, detail="Saldo inicial já foi definido")
    
    direction = "CREDIT" if data.amount_cents >= 0 else "DEBIT"
    try:
        entry = await create_ledger_entry(
            tenant_id=tenant_id,
            entry_type="SALDO_INICIAL",
            direction=direction,
            amount_cents=abs(data.amount_cents),
            note=data.note
        )
    except asyncpg.UniqueViolationError as exc:
        raise HTTPException(status_code=400, detail="Saldo inicial já foi definido") from exc
    return LedgerEntryResponse(**entry)

@api_router.post("/balance/adjustment", response_model=LedgerEntryResponse)
async def create_adjustment(
    data: AdjustmentCreate,
    current_user: dict = Depends(get_current_user),
    admin=Depends(require_role("admin"))
):
    tenant_id = current_user["tenant_id"]
    direction = "CREDIT" if data.amount_cents >= 0 else "DEBIT"
    entry = await create_ledger_entry(
        tenant_id=tenant_id,
        entry_type="AJUSTE",
        direction=direction,
        amount_cents=abs(data.amount_cents),
        note=data.reason
    )
    return LedgerEntryResponse(**entry)

# ==================== RECEIVABLES ENDPOINTS ====================

def get_receivable_status(due_date: str, paid_at: Optional[str]) -> str:
    if paid_at:
        return "PAGO"
    due = datetime.fromisoformat(due_date.replace('Z', '+00:00'))
    now = datetime.now(timezone.utc)
    if due.date() < now.date():
        return "ATRASADO"
    return "PENDENTE"

def get_next_recurrence_date(current_date: datetime, recurrence_type: str) -> datetime:
    """Calculate next occurrence date based on recurrence type"""
    if recurrence_type == "weekly":
        return current_date + timedelta(weeks=1)
    elif recurrence_type == "monthly":
        # Add one month
        month = current_date.month + 1
        year = current_date.year
        if month > 12:
            month = 1
            year += 1
        day = min(current_date.day, 28)  # Handle months with fewer days
        return current_date.replace(year=year, month=month, day=day)
    elif recurrence_type == "yearly":
        return current_date.replace(year=current_date.year + 1)
    return current_date

async def generate_recurring_receivables(parent: dict, recurrence_type: str, end_date_str: Optional[str]):
    """Generate future recurring receivables"""
    if not end_date_str:
        # Default: 6 months ahead
        end_date = datetime.now(timezone.utc) + timedelta(days=180)
    else:
        end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
    
    current_date = datetime.fromisoformat(parent["due_date"].replace('Z', '+00:00'))
    now = datetime.now(timezone.utc).isoformat()
    
    while True:
        next_date = get_next_recurrence_date(current_date, recurrence_type)
        if next_date > end_date:
            break
        
        child = {
            "id": str(uuid.uuid4()),
            "tenant_id": parent["tenant_id"],
            "description": parent["description"],
            "client_name": parent["client_name"],
            "amount_cents": parent["amount_cents"],
            "due_date": next_date.isoformat(),
            "paid_at": None,
            "is_recurring": False,
            "recurrence_type": None,
            "recurrence_end_date": None,
            "parent_id": parent["id"],
            "created_at": now,
            "updated_at": now
        }
        await database.insert("receivables", child)
        current_date = next_date

async def generate_recurring_payables(parent: dict, recurrence_type: str, end_date_str: Optional[str]):
    """Generate future recurring payables"""
    if not end_date_str:
        end_date = datetime.now(timezone.utc) + timedelta(days=180)
    else:
        end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
    
    current_date = datetime.fromisoformat(parent["due_date"].replace('Z', '+00:00'))
    now = datetime.now(timezone.utc).isoformat()
    
    while True:
        next_date = get_next_recurrence_date(current_date, recurrence_type)
        if next_date > end_date:
            break
        
        child = {
            "id": str(uuid.uuid4()),
            "tenant_id": parent["tenant_id"],
            "description": parent["description"],
            "category": parent["category"],
            "amount_cents": parent["amount_cents"],
            "due_date": next_date.isoformat(),
            "paid_at": None,
            "is_recurring": False,
            "recurrence_type": None,
            "recurrence_end_date": None,
            "parent_id": parent["id"],
            "created_at": now,
            "updated_at": now
        }
        await database.insert("payables", child)
        current_date = next_date

@api_router.get("/receivables", response_model=List[ReceivableResponse])
async def list_receivables(
    status_filter: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    tenant_id = current_user["tenant_id"]
    query = {"tenant_id": tenant_id}
    
    receivables = await database.fetch_many("receivables", query, 1000, order_by="due_date")
    
    result = []
    for r in receivables:
        r["status"] = get_receivable_status(r["due_date"], r.get("paid_at"))
        if status_filter and r["status"] != status_filter:
            continue
        result.append(ReceivableResponse(**r))
    
    return sorted(result, key=lambda x: x.due_date)

@api_router.post("/receivables", response_model=ReceivableResponse)
async def create_receivable(data: ReceivableCreate, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user["tenant_id"]
    now = datetime.now(timezone.utc).isoformat()
    
    receivable = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "description": data.description,
        "client_name": data.client_name,
        "amount_cents": data.amount_cents,
        "due_date": data.due_date,
        "paid_at": None,
        "is_recurring": data.is_recurring or False,
        "recurrence_type": data.recurrence_type,
        "recurrence_end_date": data.recurrence_end_date,
        "parent_id": None,
        "created_at": now,
        "updated_at": now
    }
    await database.insert("receivables", receivable)
    
    # If recurring, create future occurrences
    if data.is_recurring and data.recurrence_type:
        await generate_recurring_receivables(receivable, data.recurrence_type, data.recurrence_end_date)
    
    receivable["status"] = get_receivable_status(receivable["due_date"], None)
    return ReceivableResponse(**receivable)

@api_router.get("/receivables/{receivable_id}", response_model=ReceivableResponse)
async def get_receivable(receivable_id: str, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user["tenant_id"]
    receivable = await database.fetch_one(
        "receivables", {"id": receivable_id, "tenant_id": tenant_id}
    )
    if not receivable:
        raise HTTPException(status_code=404, detail="Receita não encontrada")
    
    receivable["status"] = get_receivable_status(receivable["due_date"], receivable.get("paid_at"))
    return ReceivableResponse(**receivable)

@api_router.put("/receivables/{receivable_id}", response_model=ReceivableResponse)
async def update_receivable(
    receivable_id: str, 
    data: ReceivableUpdate, 
    current_user: dict = Depends(get_current_user)
):
    tenant_id = current_user["tenant_id"]
    receivable = await database.fetch_one(
        "receivables", {"id": receivable_id, "tenant_id": tenant_id}
    )
    if not receivable:
        raise HTTPException(status_code=404, detail="Receita não encontrada")
    
    if receivable.get("paid_at"):
        raise HTTPException(status_code=400, detail="Não é possível editar uma receita já paga")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    updated = await database.update_one(
        "receivables",
        {"id": receivable_id, "tenant_id": tenant_id, "paid_at": None},
        update_data,
    )
    if not updated:
        current = await database.fetch_one(
            "receivables", {"id": receivable_id, "tenant_id": tenant_id}
        )
        if not current:
            raise HTTPException(status_code=404, detail="Receita não encontrada")
        raise HTTPException(status_code=400, detail="Não é possível editar uma receita já paga")
    updated["status"] = get_receivable_status(updated["due_date"], updated.get("paid_at"))
    return ReceivableResponse(**updated)

@api_router.delete("/receivables/{receivable_id}")
async def delete_receivable(receivable_id: str, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user["tenant_id"]
    receivable = await database.fetch_one(
        "receivables", {"id": receivable_id, "tenant_id": tenant_id}
    )
    if not receivable:
        raise HTTPException(status_code=404, detail="Receita não encontrada")
    
    if receivable.get("paid_at"):
        raise HTTPException(status_code=400, detail="Não é possível excluir uma receita já paga")
    
    deleted = await database.delete_one(
        "receivables",
        {"id": receivable_id, "tenant_id": tenant_id, "paid_at": None},
    )
    if not deleted:
        raise HTTPException(status_code=400, detail="Não é possível excluir uma receita já paga")
    return {"message": "Receita excluída com sucesso"}

@api_router.post("/receivables/{receivable_id}/mark-paid", response_model=ReceivableResponse)
async def mark_receivable_paid(receivable_id: str, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user["tenant_id"]
    now = datetime.now(timezone.utc).isoformat()
    receivable = await database.fetch_one(
        "receivables", {"id": receivable_id, "tenant_id": tenant_id}
    )
    if not receivable:
        raise HTTPException(status_code=404, detail="Receita não encontrada")
    if receivable.get("paid_at"):
        raise HTTPException(status_code=400, detail="Receita já foi marcada como paga")

    updated = await database.mark_paid(
        "receivables",
        receivable_id,
        tenant_id,
        now,
        {
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "entry_type": "RECEITA_PAGA",
            "direction": "CREDIT",
            "amount_cents": receivable["amount_cents"],
            "occurred_at": now,
            "reference_type": "receivable",
            "reference_id": receivable_id,
            "note": f"Receita: {receivable['description']}",
            "created_at": now,
        },
    )
    if not updated:
        raise HTTPException(status_code=400, detail="Receita já foi marcada como paga")
    updated["status"] = "PAGO"
    return ReceivableResponse(**updated)

# ==================== PAYABLES ENDPOINTS ====================

def get_payable_status(due_date: str, paid_at: Optional[str]) -> str:
    if paid_at:
        return "PAGO"
    due = datetime.fromisoformat(due_date.replace('Z', '+00:00'))
    now = datetime.now(timezone.utc)
    if due.date() < now.date():
        return "ATRASADO"
    return "PENDENTE"

@api_router.get("/payables", response_model=List[PayableResponse])
async def list_payables(
    status_filter: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    tenant_id = current_user["tenant_id"]
    query = {"tenant_id": tenant_id}
    
    payables = await database.fetch_many("payables", query, 1000, order_by="due_date")
    
    result = []
    for p in payables:
        p["status"] = get_payable_status(p["due_date"], p.get("paid_at"))
        if status_filter and p["status"] != status_filter:
            continue
        result.append(PayableResponse(**p))
    
    return sorted(result, key=lambda x: x.due_date)

@api_router.post("/payables", response_model=PayableResponse)
async def create_payable(data: PayableCreate, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user["tenant_id"]
    now = datetime.now(timezone.utc).isoformat()
    
    payable = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "description": data.description,
        "category": data.category,
        "amount_cents": data.amount_cents,
        "due_date": data.due_date,
        "paid_at": None,
        "is_recurring": data.is_recurring or False,
        "recurrence_type": data.recurrence_type,
        "recurrence_end_date": data.recurrence_end_date,
        "parent_id": None,
        "created_at": now,
        "updated_at": now
    }
    await database.insert("payables", payable)
    
    # If recurring, create future occurrences
    if data.is_recurring and data.recurrence_type:
        await generate_recurring_payables(payable, data.recurrence_type, data.recurrence_end_date)
    
    payable["status"] = get_payable_status(payable["due_date"], None)
    return PayableResponse(**payable)

@api_router.get("/payables/{payable_id}", response_model=PayableResponse)
async def get_payable(payable_id: str, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user["tenant_id"]
    payable = await database.fetch_one(
        "payables", {"id": payable_id, "tenant_id": tenant_id}
    )
    if not payable:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")
    
    payable["status"] = get_payable_status(payable["due_date"], payable.get("paid_at"))
    return PayableResponse(**payable)

@api_router.put("/payables/{payable_id}", response_model=PayableResponse)
async def update_payable(
    payable_id: str, 
    data: PayableUpdate, 
    current_user: dict = Depends(get_current_user)
):
    tenant_id = current_user["tenant_id"]
    payable = await database.fetch_one(
        "payables", {"id": payable_id, "tenant_id": tenant_id}
    )
    if not payable:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")
    
    if payable.get("paid_at"):
        raise HTTPException(status_code=400, detail="Não é possível editar uma despesa já paga")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    updated = await database.update_one(
        "payables",
        {"id": payable_id, "tenant_id": tenant_id, "paid_at": None},
        update_data,
    )
    if not updated:
        current = await database.fetch_one(
            "payables", {"id": payable_id, "tenant_id": tenant_id}
        )
        if not current:
            raise HTTPException(status_code=404, detail="Despesa não encontrada")
        raise HTTPException(status_code=400, detail="Não é possível editar uma despesa já paga")
    updated["status"] = get_payable_status(updated["due_date"], updated.get("paid_at"))
    return PayableResponse(**updated)

@api_router.delete("/payables/{payable_id}")
async def delete_payable(payable_id: str, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user["tenant_id"]
    payable = await database.fetch_one(
        "payables", {"id": payable_id, "tenant_id": tenant_id}
    )
    if not payable:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")
    
    if payable.get("paid_at"):
        raise HTTPException(status_code=400, detail="Não é possível excluir uma despesa já paga")
    
    deleted = await database.delete_one(
        "payables",
        {"id": payable_id, "tenant_id": tenant_id, "paid_at": None},
    )
    if not deleted:
        raise HTTPException(status_code=400, detail="Não é possível excluir uma despesa já paga")
    return {"message": "Despesa excluída com sucesso"}

@api_router.post("/payables/{payable_id}/mark-paid", response_model=PayableResponse)
async def mark_payable_paid(payable_id: str, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user["tenant_id"]
    now = datetime.now(timezone.utc).isoformat()
    payable = await database.fetch_one(
        "payables", {"id": payable_id, "tenant_id": tenant_id}
    )
    if not payable:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")
    if payable.get("paid_at"):
        raise HTTPException(status_code=400, detail="Despesa já foi marcada como paga")

    updated = await database.mark_paid(
        "payables",
        payable_id,
        tenant_id,
        now,
        {
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "entry_type": "DESPESA_PAGA",
            "direction": "DEBIT",
            "amount_cents": payable["amount_cents"],
            "occurred_at": now,
            "reference_type": "payable",
            "reference_id": payable_id,
            "note": f"Despesa: {payable['description']}",
            "created_at": now,
        },
    )
    if not updated:
        raise HTTPException(status_code=400, detail="Despesa já foi marcada como paga")
    updated["status"] = "PAGO"
    return PayableResponse(**updated)

# ==================== PROPOSALS ENDPOINTS ====================

@api_router.get("/proposals", response_model=List[ProposalResponse])
async def list_proposals(
    status_filter: Optional[ProposalStatus] = None,
    current_user: dict = Depends(get_current_user),
):
    proposals = await database.fetch_many(
        "proposals",
        {"tenant_id": current_user["tenant_id"]},
        1000,
        order_by="updated_at",
        descending=True,
    )
    if status_filter:
        proposals = [proposal for proposal in proposals if proposal["status"] == status_filter]
    return [ProposalResponse(**proposal) for proposal in proposals]


@api_router.post("/proposals", response_model=ProposalResponse, status_code=status.HTTP_201_CREATED)
async def create_proposal(
    data: ProposalCreate,
    current_user: dict = Depends(get_current_user),
):
    now = datetime.now(timezone.utc).isoformat()
    proposal_data = data.model_dump(mode="json")
    proposal = await database.insert(
        "proposals",
        {
            "id": str(uuid.uuid4()),
            "tenant_id": current_user["tenant_id"],
            **proposal_data,
            "created_at": now,
            "updated_at": now,
        },
    )
    return ProposalResponse(**proposal)


@api_router.get("/proposals/{proposal_id}", response_model=ProposalResponse)
async def get_proposal(proposal_id: str, current_user: dict = Depends(get_current_user)):
    proposal = await database.fetch_one(
        "proposals",
        {"id": proposal_id, "tenant_id": current_user["tenant_id"]},
    )
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposta não encontrada")
    return ProposalResponse(**proposal)


@api_router.put("/proposals/{proposal_id}", response_model=ProposalResponse)
async def update_proposal(
    proposal_id: str,
    data: ProposalUpdate,
    current_user: dict = Depends(get_current_user),
):
    tenant_id = current_user["tenant_id"]
    proposal = await database.fetch_one(
        "proposals", {"id": proposal_id, "tenant_id": tenant_id}
    )
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposta não encontrada")

    update_data = data.model_dump(mode="json", exclude_unset=True)
    issue_date = update_data.get("issue_date", proposal["issue_date"])
    valid_until = update_data.get("valid_until", proposal["valid_until"])
    if date.fromisoformat(valid_until) < date.fromisoformat(issue_date):
        raise HTTPException(
            status_code=422,
            detail="A validade não pode ser anterior à emissão",
        )

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    updated = await database.update_one(
        "proposals",
        {"id": proposal_id, "tenant_id": tenant_id},
        update_data,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Proposta não encontrada")
    return ProposalResponse(**updated)


@api_router.patch("/proposals/{proposal_id}/status", response_model=ProposalResponse)
async def update_proposal_status(
    proposal_id: str,
    data: ProposalStatusUpdate,
    current_user: dict = Depends(get_current_user),
):
    updated = await database.update_one(
        "proposals",
        {"id": proposal_id, "tenant_id": current_user["tenant_id"]},
        {
            "status": data.status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Proposta não encontrada")
    return ProposalResponse(**updated)


# ==================== CLIENTS ENDPOINTS ====================

@api_router.get("/clients", response_model=List[ClientResponse])
async def list_clients(current_user: dict = Depends(get_current_user)):
    clients = await database.fetch_many(
        "clients",
        {"tenant_id": current_user["tenant_id"]},
        1000,
        order_by="updated_at",
        descending=True,
    )
    return [ClientResponse(**client) for client in clients]


@api_router.post(
    "/clients",
    response_model=ClientResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_client(
    data: ClientInput,
    current_user: dict = Depends(get_current_user),
):
    now = datetime.now(timezone.utc).isoformat()
    try:
        client = await database.insert(
            "clients",
            {
                "id": str(uuid.uuid4()),
                "tenant_id": current_user["tenant_id"],
                **data.model_dump(mode="json"),
                "created_at": now,
                "updated_at": now,
            },
        )
    except asyncpg.UniqueViolationError as exc:
        raise HTTPException(
            status_code=409,
            detail="Já existe um cliente com este CPF/CNPJ.",
        ) from exc
    return ClientResponse(**client)


@api_router.get("/clients/{client_id}", response_model=ClientResponse)
async def get_client(client_id: str, current_user: dict = Depends(get_current_user)):
    client = await database.fetch_one(
        "clients",
        {"id": client_id, "tenant_id": current_user["tenant_id"]},
    )
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return ClientResponse(**client)


@api_router.put("/clients/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: str,
    data: ClientInput,
    current_user: dict = Depends(get_current_user),
):
    try:
        client = await database.update_one(
            "clients",
            {"id": client_id, "tenant_id": current_user["tenant_id"]},
            {
                **data.model_dump(mode="json"),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        )
    except asyncpg.UniqueViolationError as exc:
        raise HTTPException(
            status_code=409,
            detail="Já existe um cliente com este CPF/CNPJ.",
        ) from exc
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return ClientResponse(**client)


# ==================== LEDGER ENDPOINTS ====================

class LedgerFilterParams(BaseModel):
    entry_type: Optional[str] = None
    direction: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None

@api_router.get("/ledger", response_model=List[LedgerEntryResponse])
async def list_ledger_entries(
    entry_type: Optional[str] = None,
    direction: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    tenant_id = current_user["tenant_id"]
    query = {"tenant_id": tenant_id}
    
    # Apply filters
    if entry_type:
        query["entry_type"] = entry_type
    if direction:
        query["direction"] = direction
    if start_date:
        query["occurred_at"] = {"$gte": start_date}
    if end_date:
        if "occurred_at" in query:
            query["occurred_at"]["$lte"] = end_date
        else:
            query["occurred_at"] = {"$lte": end_date}
    
    entries = await database.fetch_many(
        "ledger_entries", query, 1000, order_by="created_at", descending=True
    )
    
    return [LedgerEntryResponse(**e) for e in entries]

# ==================== DASHBOARD ENDPOINT ====================

@api_router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(current_user: dict = Depends(get_current_user)):
    tenant_id = current_user["tenant_id"]
    now = datetime.now(timezone.utc)
    today = now.date()
    
    # Calculate current balance from ledger
    current_balance = await calculate_current_balance(tenant_id)
    
    # Get receivables
    receivables = await database.fetch_many("receivables", {"tenant_id": tenant_id}, 1000)
    
    # Get payables
    payables = await database.fetch_many("payables", {"tenant_id": tenant_id}, 1000)
    
    # Calculate 30-day projections (pending only)
    thirty_days = today + timedelta(days=30)
    seven_days = today + timedelta(days=7)
    
    receivables_30d = 0
    pending_receivables = 0
    overdue_receivables = 0
    
    for r in receivables:
        due = datetime.fromisoformat(r["due_date"].replace('Z', '+00:00')).date()
        if not r.get("paid_at"):
            if due <= thirty_days:
                receivables_30d += r["amount_cents"]
            pending_receivables += 1
            if due < today:
                overdue_receivables += 1
    
    payables_30d = 0
    pending_payables = 0
    overdue_payables = 0
    
    for p in payables:
        due = datetime.fromisoformat(p["due_date"].replace('Z', '+00:00')).date()
        if not p.get("paid_at"):
            if due <= thirty_days:
                payables_30d += p["amount_cents"]
            pending_payables += 1
            if due < today:
                overdue_payables += 1
    
    projected_balance = current_balance + receivables_30d - payables_30d
    
    # Build 7-day timeline
    timeline = []
    for r in receivables:
        if not r.get("paid_at"):
            due = datetime.fromisoformat(r["due_date"].replace('Z', '+00:00')).date()
            if today <= due <= seven_days:
                timeline.append({
                    "type": "receivable",
                    "id": r["id"],
                    "description": r["description"],
                    "client_name": r.get("client_name", ""),
                    "amount_cents": r["amount_cents"],
                    "due_date": r["due_date"],
                    "is_overdue": due < today
                })
    
    for p in payables:
        if not p.get("paid_at"):
            due = datetime.fromisoformat(p["due_date"].replace('Z', '+00:00')).date()
            if today <= due <= seven_days:
                timeline.append({
                    "type": "payable",
                    "id": p["id"],
                    "description": p["description"],
                    "category": p.get("category", ""),
                    "amount_cents": p["amount_cents"],
                    "due_date": p["due_date"],
                    "is_overdue": due < today
                })
    
    # Sort timeline by due_date
    timeline.sort(key=lambda x: x["due_date"])
    
    # Determine alert status
    alert_status = "OK"
    if overdue_receivables > 0 or overdue_payables > 0:
        alert_status = "ATENCAO"
    if projected_balance < 0:
        alert_status = "RISCO"
    
    # Build projection chart data (daily for 30 days)
    projection_chart = []
    running_balance = current_balance
    
    # Group receivables and payables by date
    receivables_by_date = {}
    payables_by_date = {}
    
    for r in receivables:
        if not r.get("paid_at"):
            due = datetime.fromisoformat(r["due_date"].replace('Z', '+00:00')).date()
            if today <= due <= thirty_days:
                if due not in receivables_by_date:
                    receivables_by_date[due] = 0
                receivables_by_date[due] += r["amount_cents"]
    
    for p in payables:
        if not p.get("paid_at"):
            due = datetime.fromisoformat(p["due_date"].replace('Z', '+00:00')).date()
            if today <= due <= thirty_days:
                if due not in payables_by_date:
                    payables_by_date[due] = 0
                payables_by_date[due] += p["amount_cents"]
    
    for i in range(31):
        chart_date = today + timedelta(days=i)
        daily_receivables = receivables_by_date.get(chart_date, 0)
        daily_payables = payables_by_date.get(chart_date, 0)
        running_balance += daily_receivables - daily_payables
        
        projection_chart.append({
            "date": chart_date.isoformat(),
            "balance": running_balance,
            "receivables": daily_receivables,
            "payables": daily_payables
        })
    
    return DashboardResponse(
        current_balance_cents=current_balance,
        receivables_30d_cents=receivables_30d,
        payables_30d_cents=payables_30d,
        projected_balance_cents=projected_balance,
        timeline_7d=timeline,
        alert_status=alert_status,
        pending_receivables_count=pending_receivables,
        pending_payables_count=pending_payables,
        overdue_receivables_count=overdue_receivables,
        overdue_payables_count=overdue_payables,
        projection_chart=projection_chart
    )

# ==================== HEALTH CHECK ====================

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

@api_router.get("/ready")
async def readiness_check():
    try:
        await database.check()
    except (asyncpg.PostgresError, RuntimeError, TimeoutError, OSError) as exc:
        logger.exception("Postgres readiness check failed")
        raise HTTPException(status_code=503, detail="Database unavailable") from exc
    return {"status": "ready", "timestamp": datetime.now(timezone.utc).isoformat()}

# ==================== EXPORT ENDPOINTS ====================

@api_router.get("/export/receivables")
async def export_receivables(current_user: dict = Depends(get_current_user)):
    tenant_id = current_user["tenant_id"]
    receivables = await database.fetch_many(
        "receivables", {"tenant_id": tenant_id}, 10000, order_by="due_date"
    )
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow(['ID', 'Descrição', 'Cliente', 'Valor (R$)', 'Data Vencimento', 'Data Pagamento', 'Status', 'Criado em'])
    
    for r in receivables:
        rec_status = get_receivable_status(r["due_date"], r.get("paid_at"))
        writer.writerow([
            r["id"],
            r["description"],
            r["client_name"],
            f'{r["amount_cents"] / 100:.2f}'.replace('.', ','),
            r["due_date"][:10],
            r.get("paid_at", "")[:10] if r.get("paid_at") else "",
            rec_status,
            r["created_at"][:10]
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=receitas.csv"}
    )

@api_router.get("/export/payables")
async def export_payables(current_user: dict = Depends(get_current_user)):
    tenant_id = current_user["tenant_id"]
    payables = await database.fetch_many(
        "payables", {"tenant_id": tenant_id}, 10000, order_by="due_date"
    )
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow(['ID', 'Descrição', 'Categoria', 'Valor (R$)', 'Data Vencimento', 'Data Pagamento', 'Status', 'Criado em'])
    
    for p in payables:
        pay_status = get_payable_status(p["due_date"], p.get("paid_at"))
        writer.writerow([
            p["id"],
            p["description"],
            p["category"],
            f'{p["amount_cents"] / 100:.2f}'.replace('.', ','),
            p["due_date"][:10],
            p.get("paid_at", "")[:10] if p.get("paid_at") else "",
            pay_status,
            p["created_at"][:10]
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=despesas.csv"}
    )

@api_router.get("/export/ledger")
async def export_ledger(
    current_user: dict = Depends(get_current_user),
    admin=Depends(require_role("admin"))
):
    tenant_id = current_user["tenant_id"]
    entries = await database.fetch_many(
        "ledger_entries", {"tenant_id": tenant_id}, 10000, order_by="created_at"
    )
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow(['ID', 'Tipo', 'Direção', 'Valor (R$)', 'Data', 'Nota', 'Referência'])
    
    for e in entries:
        writer.writerow([
            e["id"],
            e["entry_type"],
            e["direction"],
            f'{e["amount_cents"] / 100:.2f}'.replace('.', ','),
            e["occurred_at"][:10],
            e.get("note", ""),
            f'{e.get("reference_type", "")}/{e.get("reference_id", "")}'
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=historico.csv"}
    )

# ==================== IMPORT ENDPOINTS ====================

class ImportResult(BaseModel):
    total_rows: int
    imported: int
    errors: List[dict]

@api_router.post("/import/receivables", response_model=ImportResult)
async def import_receivables(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    tenant_id = current_user["tenant_id"]
    
    content = await file.read()
    decoded = content.decode('utf-8-sig')  # Handle BOM
    reader = csv.DictReader(io.StringIO(decoded))
    
    imported = 0
    errors = []
    total_rows = 0
    now = datetime.now(timezone.utc).isoformat()
    
    for row_num, row in enumerate(reader, start=2):  # Start at 2 (header is row 1)
        total_rows += 1
        try:
            # Parse amount (handle both . and , as decimal separator)
            amount_str = row.get('Valor (R$)', row.get('valor', row.get('amount', '0')))
            amount_str = amount_str.replace('R$', '').replace(' ', '').strip()
            if ',' in amount_str and '.' in amount_str:
                amount_str = amount_str.replace('.', '').replace(',', '.')
            elif ',' in amount_str:
                amount_str = amount_str.replace(',', '.')
            amount_cents = int(float(amount_str) * 100)
            
            # Parse date
            date_str = row.get('Data Vencimento', row.get('data', row.get('due_date', '')))
            if '/' in date_str:
                parts = date_str.split('/')
                if len(parts[2]) == 2:
                    parts[2] = '20' + parts[2]
                date_str = f'{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}'
            
            receivable = {
                "id": str(uuid.uuid4()),
                "tenant_id": tenant_id,
                "description": row.get('Descrição', row.get('descricao', row.get('description', 'Importado'))),
                "client_name": row.get('Cliente', row.get('cliente', row.get('client_name', 'Cliente'))),
                "amount_cents": amount_cents,
                "due_date": f"{date_str}T00:00:00+00:00",
                "paid_at": None,
                "created_at": now,
                "updated_at": now
            }
            await database.insert("receivables", receivable)
            imported += 1
        except Exception as e:
            errors.append({"row": row_num, "error": str(e), "data": dict(row)})
    
    return ImportResult(total_rows=total_rows, imported=imported, errors=errors)

@api_router.post("/import/payables", response_model=ImportResult)
async def import_payables(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    tenant_id = current_user["tenant_id"]
    
    content = await file.read()
    decoded = content.decode('utf-8-sig')
    reader = csv.DictReader(io.StringIO(decoded))
    
    imported = 0
    errors = []
    total_rows = 0
    now = datetime.now(timezone.utc).isoformat()
    
    for row_num, row in enumerate(reader, start=2):
        total_rows += 1
        try:
            amount_str = row.get('Valor (R$)', row.get('valor', row.get('amount', '0')))
            amount_str = amount_str.replace('R$', '').replace(' ', '').strip()
            if ',' in amount_str and '.' in amount_str:
                amount_str = amount_str.replace('.', '').replace(',', '.')
            elif ',' in amount_str:
                amount_str = amount_str.replace(',', '.')
            amount_cents = int(float(amount_str) * 100)
            
            date_str = row.get('Data Vencimento', row.get('data', row.get('due_date', '')))
            if '/' in date_str:
                parts = date_str.split('/')
                if len(parts[2]) == 2:
                    parts[2] = '20' + parts[2]
                date_str = f'{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}'
            
            payable = {
                "id": str(uuid.uuid4()),
                "tenant_id": tenant_id,
                "description": row.get('Descrição', row.get('descricao', row.get('description', 'Importado'))),
                "category": row.get('Categoria', row.get('categoria', row.get('category', 'outros'))),
                "amount_cents": amount_cents,
                "due_date": f"{date_str}T00:00:00+00:00",
                "paid_at": None,
                "created_at": now,
                "updated_at": now
            }
            await database.insert("payables", payable)
            imported += 1
        except Exception as e:
            errors.append({"row": row_num, "error": str(e), "data": dict(row)})
    
    return ImportResult(total_rows=total_rows, imported=imported, errors=errors)

@api_router.get("/import/template/{type}")
async def get_import_template(type: str):
    output = io.StringIO()
    writer = csv.writer(output)
    
    if type == "receivables":
        writer.writerow(['Descrição', 'Cliente', 'Valor (R$)', 'Data Vencimento'])
        writer.writerow(['Consultoria Janeiro', 'Empresa ABC', '1500,00', '15/01/2026'])
        writer.writerow(['Projeto Website', 'Cliente XYZ', '3000,00', '20/01/2026'])
        filename = "modelo_receitas.csv"
    elif type == "payables":
        writer.writerow(['Descrição', 'Categoria', 'Valor (R$)', 'Data Vencimento'])
        writer.writerow(['Aluguel Escritório', 'aluguel', '2000,00', '05/01/2026'])
        writer.writerow(['Internet', 'servicos', '150,00', '10/01/2026'])
        filename = "modelo_despesas.csv"
    else:
        raise HTTPException(status_code=400, detail="Tipo inválido. Use 'receivables' ou 'payables'")
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# ==================== EMAIL/REMINDER ENDPOINTS ====================

class EmailReminderRequest(BaseModel):
    receivable_id: str
    custom_message: Optional[str] = None

class EmailReminderResponse(BaseModel):
    success: bool
    message: str
    email_id: Optional[str] = None

@api_router.post("/reminders/send", response_model=EmailReminderResponse)
async def send_payment_reminder(
    request: EmailReminderRequest,
    current_user: dict = Depends(get_current_user)
):
    """Send a payment reminder email for a receivable"""
    tenant_id = current_user["tenant_id"]
    
    # Get receivable
    receivable = await database.fetch_one(
        "receivables", {"id": request.receivable_id, "tenant_id": tenant_id}
    )
    if not receivable:
        raise HTTPException(status_code=404, detail="Receita não encontrada")
    
    if receivable.get("paid_at"):
        raise HTTPException(status_code=400, detail="Receita já foi paga")
    
    # Get user info for sender name
    user = await database.fetch_one("users", {"id": current_user["user_id"]})
    
    # Format amount
    amount = receivable["amount_cents"] / 100
    amount_formatted = f"R$ {amount:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    
    # Parse due date
    due_date = datetime.fromisoformat(receivable["due_date"].replace('Z', '+00:00'))
    due_date_formatted = due_date.strftime("%d/%m/%Y")
    
    # Build email HTML
    custom_msg = request.custom_message or ""
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #10b981;">Lembrete de Pagamento</h2>
        <p>Olá,</p>
        <p>Este é um lembrete referente ao pagamento pendente:</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Descrição:</strong> {receivable['description']}</p>
            <p><strong>Valor:</strong> {amount_formatted}</p>
            <p><strong>Vencimento:</strong> {due_date_formatted}</p>
        </div>
        {f'<p>{custom_msg}</p>' if custom_msg else ''}
        <p>Atenciosamente,<br>{user['name']}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #6b7280; font-size: 12px;">
            Este email foi enviado via FinPredict
        </p>
    </div>
    """
    
    # Check if Resend is configured
    if not RESEND_API_KEY:
        # Log for testing/development
        logger.info(f"[EMAIL MOCK] Reminder would be sent for receivable {receivable['id']}")
        logger.info(f"[EMAIL MOCK] To: {receivable['client_name']}")
        logger.info(f"[EMAIL MOCK] Amount: {amount_formatted}, Due: {due_date_formatted}")
        
        # Record reminder sent (even in mock mode)
        await database.insert("reminders", {
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "receivable_id": receivable["id"],
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "status": "mock",
            "client_name": receivable["client_name"]
        })
        
        return EmailReminderResponse(
            success=True,
            message="Lembrete registrado (modo teste - email não enviado)",
            email_id=None
        )
    
    try:
        # Send via Resend
        params = {
            "from": SENDER_EMAIL,
            "to": [user["email"]],  # In production, this would be client email
            "subject": f"Lembrete de Pagamento - {receivable['description']}",
            "html": html_content
        }
        
        email_result = await asyncio.to_thread(resend.Emails.send, params)
        
        # Record reminder sent
        await database.insert("reminders", {
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "receivable_id": receivable["id"],
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "status": "sent",
            "email_id": email_result.get("id"),
            "client_name": receivable["client_name"]
        })
        
        return EmailReminderResponse(
            success=True,
            message="Lembrete enviado com sucesso",
            email_id=email_result.get("id")
        )
        
    except Exception as e:
        logger.error(f"Failed to send reminder email: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao enviar email: {str(e)}")

@api_router.get("/reminders/upcoming")
async def get_upcoming_reminders(current_user: dict = Depends(get_current_user)):
    """Get receivables due in next 7 days that haven't been reminded recently"""
    tenant_id = current_user["tenant_id"]
    now = datetime.now(timezone.utc)
    seven_days = now + timedelta(days=7)
    
    # Get pending receivables due in next 7 days
    receivables = await database.fetch_many(
        "receivables", {"tenant_id": tenant_id, "paid_at": None}, 1000,
        order_by="due_date",
    )
    
    upcoming = []
    for r in receivables:
        due = datetime.fromisoformat(r["due_date"].replace('Z', '+00:00'))
        if now.date() <= due.date() <= seven_days.date():
            # Check if reminder was sent in last 3 days
            recent_reminder = await database.fetch_one(
                "reminders",
                {
                    "tenant_id": tenant_id,
                    "receivable_id": r["id"],
                    "sent_at": {"$gte": (now - timedelta(days=3)).isoformat()},
                },
            )
            
            r["reminder_sent_recently"] = recent_reminder is not None
            r["status"] = get_receivable_status(r["due_date"], None)
            upcoming.append(r)
    
    return sorted(upcoming, key=lambda x: x["due_date"])

# ==================== DAILY JOB ENDPOINTS ====================

async def send_automatic_reminder(receivable: dict, user: dict):
    """Send automatic reminder for a receivable"""
    amount = receivable["amount_cents"] / 100
    amount_formatted = f"R$ {amount:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    due_date = datetime.fromisoformat(receivable["due_date"].replace('Z', '+00:00'))
    due_date_formatted = due_date.strftime("%d/%m/%Y")
    
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #10b981;">Lembrete Automático de Pagamento</h2>
        <p>Olá,</p>
        <p>Este é um lembrete automático sobre um pagamento próximo do vencimento:</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Descrição:</strong> {receivable['description']}</p>
            <p><strong>Cliente:</strong> {receivable.get('client_name', 'N/A')}</p>
            <p><strong>Valor:</strong> {amount_formatted}</p>
            <p><strong>Vencimento:</strong> {due_date_formatted}</p>
        </div>
        <p>Atenciosamente,<br>{user['name']}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #6b7280; font-size: 12px;">
            Este email foi enviado automaticamente via FinPredict
        </p>
    </div>
    """
    
    if not RESEND_API_KEY:
        logger.info(f"[AUTO EMAIL MOCK] Reminder for receivable {receivable['id']} - {amount_formatted}")
        return {"status": "mock", "receivable_id": receivable["id"]}
    
    try:
        params = {
            "from": SENDER_EMAIL,
            "to": [user["email"]],
            "subject": f"Lembrete: {receivable['description']} - Vence em breve",
            "html": html_content
        }
        result = await asyncio.to_thread(resend.Emails.send, params)
        return {"status": "sent", "email_id": result.get("id"), "receivable_id": receivable["id"]}
    except Exception as e:
        logger.error(f"Failed to send auto reminder: {str(e)}")
        return {"status": "error", "error": str(e), "receivable_id": receivable["id"]}

@api_router.post("/jobs/send-reminders", response_model=JobStatusResponse)
async def run_reminder_job(current_user: dict = Depends(get_current_user)):
    """Manually trigger the daily reminder job for the current user"""
    tenant_id = current_user["tenant_id"]
    user_id = current_user["user_id"]
    
    user = await database.fetch_one("users", {"id": user_id, "tenant_id": tenant_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    now = datetime.now(timezone.utc)
    three_days = now + timedelta(days=3)
    
    # Find receivables due in next 3 days that haven't been reminded recently
    receivables = await database.fetch_many(
        "receivables", {"tenant_id": tenant_id, "paid_at": None}, 1000,
        order_by="due_date",
    )
    
    sent_count = 0
    results = []
    
    for r in receivables:
        due = datetime.fromisoformat(r["due_date"].replace('Z', '+00:00'))
        if now.date() <= due.date() <= three_days.date():
            # Check if reminder was sent in last 24 hours
            recent_reminder = await database.fetch_one(
                "reminders",
                {
                    "tenant_id": tenant_id,
                    "receivable_id": r["id"],
                    "sent_at": {"$gte": (now - timedelta(hours=24)).isoformat()},
                },
            )
            
            if not recent_reminder:
                result = await send_automatic_reminder(r, user)
                results.append(result)
                
                # Record reminder
                await database.insert("reminders", {
                    "id": str(uuid.uuid4()),
                    "tenant_id": tenant_id,
                    "receivable_id": r["id"],
                    "sent_at": now.isoformat(),
                    "status": result["status"],
                    "auto": True
                })
                
                if result["status"] in ["sent", "mock"]:
                    sent_count += 1
    
    # Update job status
    await database.upsert_job_status({
        "tenant_id": tenant_id,
        "job_name": "daily_reminders",
        "last_run": now.isoformat(),
        "sent_count": sent_count,
        "results": results,
    })
    
    return JobStatusResponse(
        job_name="daily_reminders",
        last_run=now.isoformat(),
        status="completed",
        message=f"{sent_count} lembretes enviados para receitas vencendo nos próximos 3 dias"
    )

@api_router.get("/jobs/status")
async def get_job_status(current_user: dict = Depends(get_current_user)):
    """Get status of all jobs for the current tenant"""
    tenant_id = current_user["tenant_id"]
    
    jobs = await database.fetch_many("job_status", {"tenant_id": tenant_id}, 100)
    
    return {
        "jobs": jobs,
        "resend_configured": bool(RESEND_API_KEY)
    }

# ==================== ONBOARDING CHECK ENDPOINT ====================

@api_router.get("/onboarding/status")
async def get_onboarding_status(current_user: dict = Depends(get_current_user)):
    """Check if user has completed onboarding (set initial balance)"""
    tenant_id = current_user["tenant_id"]
    
    # Check if initial balance exists
    initial_balance = await database.fetch_one("ledger_entries", {
        "tenant_id": tenant_id,
        "entry_type": "SALDO_INICIAL"
    })
    
    return {
        "has_initial_balance": initial_balance is not None,
        "needs_onboarding": initial_balance is None
    }

@api_router.get("/")
async def root():
    return {"message": "Ankor Gestão API v1.0.0"}

# Include router and setup middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_db_client():
    global auth_http_client
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise RuntimeError("SUPABASE_URL and SUPABASE_ANON_KEY must be configured")
    await database.connect()
    auth_http_client = httpx.AsyncClient(timeout=10)
    logger.info("Connected to Supabase Postgres and Auth")

@app.on_event("shutdown")
async def shutdown_db_client():
    global auth_http_client
    if auth_http_client is not None:
        await auth_http_client.aclose()
        auth_http_client = None
    await database.close()
