import logging
import json
import hashlib
import hmac
import html
import os
import secrets
import sqlite3
import time
import urllib.error
import urllib.request
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Go-Forge Contact API", version="1.0.0")
DEFAULT_DATABASE_PATH = Path(__file__).resolve().parent / "data" / "enquiries.db"
ADMIN_COOKIE_NAME = "goforge_admin_session"
ADMIN_SESSION_MAX_AGE = 12 * 60 * 60

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class ContactEnquiry(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    business: str = Field(min_length=1, max_length=160)
    email: EmailStr
    phone: str = Field(default="", max_length=40)
    service: str = Field(min_length=1, max_length=120)
    message: str = Field(min_length=1, max_length=5000)


class AdminLogin(BaseModel):
    password: str = Field(min_length=1, max_length=256)


def ensure_enquiries_table(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS enquiries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            name TEXT NOT NULL,
            business TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT NOT NULL,
            service TEXT NOT NULL,
            message TEXT NOT NULL,
            email_status TEXT NOT NULL DEFAULT 'pending',
            whatsapp_status TEXT NOT NULL DEFAULT 'disabled'
        )
        """
    )


def admin_session_is_valid(request: Request) -> bool:
    session_secret = os.getenv("ADMIN_SESSION_SECRET", "")
    token = request.cookies.get(ADMIN_COOKIE_NAME, "")
    if not session_secret or not token:
        return False

    try:
        timestamp_text, nonce, supplied_signature = token.split(".", 2)
        timestamp = int(timestamp_text)
    except (ValueError, TypeError):
        return False

    now = int(time.time())
    if not nonce or timestamp > now + 30 or now - timestamp > ADMIN_SESSION_MAX_AGE:
        return False

    payload = f"{timestamp_text}.{nonce}"
    expected_signature = hmac.new(
        session_secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(supplied_signature, expected_signature)


def validate_admin_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if origin and origin not in allowed_origins:
        raise HTTPException(status_code=403, detail="Origin not allowed")


def save_enquiry(enquiry: ContactEnquiry) -> int:
    database_path = Path(os.getenv("DATABASE_PATH", str(DEFAULT_DATABASE_PATH)))
    database_path.parent.mkdir(parents=True, exist_ok=True)

    with closing(sqlite3.connect(database_path, timeout=10)) as connection, connection:
        ensure_enquiries_table(connection)
        cursor = connection.execute(
            """
            INSERT INTO enquiries (
                created_at, name, business, email, phone, service, message,
                whatsapp_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'disabled')
            """,
            (
                datetime.now(timezone.utc).isoformat(),
                enquiry.name,
                enquiry.business,
                str(enquiry.email),
                enquiry.phone,
                enquiry.service,
                enquiry.message,
            ),
        )
        return int(cursor.lastrowid)


def update_email_status(enquiry_id: int, email_status: str) -> None:
    database_path = Path(os.getenv("DATABASE_PATH", str(DEFAULT_DATABASE_PATH)))
    with closing(sqlite3.connect(database_path, timeout=10)) as connection, connection:
        connection.execute(
            "UPDATE enquiries SET email_status = ? WHERE id = ?",
            (email_status, enquiry_id),
        )


def build_enquiry_html(enquiry: ContactEnquiry, enquiry_id: int) -> str:
        name = html.escape(enquiry.name, quote=True)
        business = html.escape(enquiry.business, quote=True)
        email = html.escape(str(enquiry.email), quote=True)
        phone = html.escape(enquiry.phone or "Not provided", quote=True)
        service = html.escape(enquiry.service, quote=True)
        message = html.escape(enquiry.message, quote=True)
        message = message.replace("\r\n", "\n").replace("\r", "\n").replace("\n", "<br>")
        submitted_at = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")

        return f"""<!doctype html>
<html lang="en">
    <body style="margin:0;padding:32px 12px;background:#eef3f6;font-family:Arial,Helvetica,sans-serif;color:#10243a;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dce5ec;border-radius:12px;overflow:hidden;">
            <tr>
                <td style="padding:28px 32px;background:#071d38;border-bottom:4px solid #27c3e8;">
                    <div style="font-size:13px;font-weight:700;letter-spacing:1.2px;color:#ffffff;">GO-FORGE</div>
                    <div style="margin-top:6px;font-size:12px;color:#b9c9d7;">NEW PROJECT ENQUIRY</div>
                </td>
            </tr>
            <tr>
                <td style="padding:30px 32px 14px;">
                    <div style="font-size:12px;font-weight:700;color:#1887a3;">ENQUIRY #{enquiry_id}</div>
                    <h1 style="margin:8px 0 6px;font-size:25px;line-height:1.25;color:#10243a;">A new conversation starts here.</h1>
                    <p style="margin:0;font-size:13px;line-height:1.6;color:#718197;">Received {submitted_at}</p>
                </td>
            </tr>
            <tr>
                <td style="padding:12px 32px 20px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
                        <tr>
                            <td width="50%" style="padding:13px 12px 13px 0;border-bottom:1px solid #e7edf1;vertical-align:top;">
                                <div style="font-size:10px;font-weight:700;letter-spacing:.8px;color:#8292a0;">CONTACT</div>
                                <div style="margin-top:5px;font-size:14px;font-weight:700;color:#10243a;">{name}</div>
                            </td>
                            <td width="50%" style="padding:13px 0 13px 12px;border-bottom:1px solid #e7edf1;vertical-align:top;">
                                <div style="font-size:10px;font-weight:700;letter-spacing:.8px;color:#8292a0;">BUSINESS</div>
                                <div style="margin-top:5px;font-size:14px;font-weight:700;color:#10243a;">{business}</div>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:13px 12px 13px 0;border-bottom:1px solid #e7edf1;vertical-align:top;">
                                <div style="font-size:10px;font-weight:700;letter-spacing:.8px;color:#8292a0;">EMAIL</div>
                                <div style="margin-top:5px;font-size:13px;color:#10243a;"><a href="mailto:{email}" style="color:#087c9c;text-decoration:none;">{email}</a></div>
                            </td>
                            <td style="padding:13px 0 13px 12px;border-bottom:1px solid #e7edf1;vertical-align:top;">
                                <div style="font-size:10px;font-weight:700;letter-spacing:.8px;color:#8292a0;">PHONE</div>
                                <div style="margin-top:5px;font-size:13px;color:#10243a;">{phone}</div>
                            </td>
                        </tr>
                        <tr>
                            <td colspan="2" style="padding:13px 0;vertical-align:top;">
                                <div style="font-size:10px;font-weight:700;letter-spacing:.8px;color:#8292a0;">INTERESTED IN</div>
                                <div style="margin-top:5px;font-size:14px;font-weight:700;color:#10243a;">{service}</div>
                            </td>
                        </tr>
                    </table>
                    <div style="margin-top:12px;padding:18px 20px;border-left:3px solid #27c3e8;border-radius:4px;background:#f3f7fa;">
                        <div style="margin-bottom:9px;font-size:10px;font-weight:700;letter-spacing:.8px;color:#718197;">PROJECT DETAILS</div>
                        <div style="font-size:13px;line-height:1.75;color:#263e54;">{message}</div>
                    </div>
                    <p style="margin:22px 0 0;"><a href="mailto:{email}" style="display:inline-block;padding:12px 17px;border-radius:5px;background:#123c70;color:#ffffff;font-size:12px;font-weight:700;text-decoration:none;">Reply to {name}</a></p>
                </td>
            </tr>
            <tr>
                <td style="padding:17px 32px;border-top:1px solid #e7edf1;background:#f8fafb;font-size:11px;line-height:1.6;color:#8292a0;">
                    This enquiry is saved in your Go-Forge admin portal.<br>Go-Forge · Thoughtful work. Tangible progress.
                </td>
            </tr>
        </table>
    </body>
</html>"""


def send_email_notification(enquiry: ContactEnquiry, enquiry_id: int) -> str:
    api_key = os.getenv("BREVO_API_KEY")
    recipient = os.getenv("CONTACT_TO_EMAIL", "officialshivam2419@gmail.com")
    sender_email = os.getenv("BREVO_SENDER_EMAIL", "rjgpcmp2020@gmail.com")
    sender_name = os.getenv("BREVO_SENDER_NAME", "Go-Forge")

    if not all((api_key, sender_email, sender_name, recipient)):
        return "not_configured"

    payload = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": recipient}],
        "replyTo": {"name": enquiry.name, "email": str(enquiry.email)},
        "subject": f"Website enquiry #{enquiry_id}: {enquiry.service}",
        "textContent": (
            "A new enquiry was submitted through the Go-Forge website.\n\n"
            f"Enquiry ID: {enquiry_id}\n"
            f"Name: {enquiry.name}\n"
            f"Business: {enquiry.business}\n"
            f"Email: {enquiry.email}\n"
            f"Phone: {enquiry.phone or 'Not provided'}\n"
            f"Service: {enquiry.service}\n\n"
            f"Project details:\n{enquiry.message}\n"
        ),
        "htmlContent": build_enquiry_html(enquiry, enquiry_id),
    }
    request = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=20):
            return "sent"
    except urllib.error.HTTPError as error:
        logger.warning(
            "Brevo email for enquiry %s failed with HTTP %s", enquiry_id, error.code
        )
        return "failed"
    except (urllib.error.URLError, OSError, ValueError):
        logger.exception("Failed to email enquiry %s", enquiry_id)
        return "failed"


@app.get("/api/admin/session")
def get_admin_session(request: Request, response: Response):
    response.headers["Cache-Control"] = "no-store"
    return {"authenticated": admin_session_is_valid(request)}


@app.post("/api/admin/login")
def admin_login(credentials: AdminLogin, request: Request, response: Response):
    response.headers["Cache-Control"] = "no-store"
    validate_admin_origin(request)
    admin_password = os.getenv("ADMIN_PASSWORD", "")
    session_secret = os.getenv("ADMIN_SESSION_SECRET", "")
    if not admin_password or not session_secret:
        raise HTTPException(
            status_code=503,
            detail="Admin access is not configured. Set ADMIN_PASSWORD in backend/.env.",
        )
    if not hmac.compare_digest(
        credentials.password.encode("utf-8"), admin_password.encode("utf-8")
    ):
        raise HTTPException(status_code=401, detail="Incorrect password")

    timestamp = str(int(time.time()))
    nonce = secrets.token_urlsafe(24)
    payload = f"{timestamp}.{nonce}"
    signature = hmac.new(
        session_secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    same_site = os.getenv("ADMIN_COOKIE_SAMESITE", "strict").lower()
    if same_site not in {"strict", "lax", "none"}:
        same_site = "strict"
    secure_cookie = os.getenv("ADMIN_COOKIE_SECURE", "false").lower() == "true"

    response.set_cookie(
        key=ADMIN_COOKIE_NAME,
        value=f"{payload}.{signature}",
        max_age=ADMIN_SESSION_MAX_AGE,
        httponly=True,
        secure=secure_cookie or same_site == "none",
        samesite=same_site,
        path="/",
    )
    return {"authenticated": True}


@app.post("/api/admin/logout")
def admin_logout(request: Request, response: Response):
    response.headers["Cache-Control"] = "no-store"
    validate_admin_origin(request)
    same_site = os.getenv("ADMIN_COOKIE_SAMESITE", "strict").lower()
    if same_site not in {"strict", "lax", "none"}:
        same_site = "strict"
    response.delete_cookie(
        key=ADMIN_COOKIE_NAME,
        httponly=True,
        secure=os.getenv("ADMIN_COOKIE_SECURE", "false").lower() == "true" or same_site == "none",
        samesite=same_site,
        path="/",
    )
    return {"authenticated": False}


@app.get("/api/admin/enquiries")
def get_admin_enquiries(request: Request, response: Response):
    response.headers["Cache-Control"] = "no-store"
    if not admin_session_is_valid(request):
        raise HTTPException(status_code=401, detail="Please sign in to view enquiries")

    database_path = Path(os.getenv("DATABASE_PATH", str(DEFAULT_DATABASE_PATH)))
    database_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with closing(sqlite3.connect(database_path, timeout=10)) as connection, connection:
            connection.row_factory = sqlite3.Row
            ensure_enquiries_table(connection)
            rows = connection.execute(
                """
                SELECT id, created_at, name, business, email, phone, service, message,
                       email_status
                FROM enquiries
                ORDER BY id DESC
                """
            ).fetchall()
    except sqlite3.Error:
        logger.exception("Failed to load admin enquiries")
        raise HTTPException(status_code=500, detail="Could not load enquiries") from None

    return {"enquiries": [dict(row) for row in rows]}


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


@app.post("/api/contact", status_code=202)
def submit_contact(enquiry: ContactEnquiry):
    try:
        enquiry_id = save_enquiry(enquiry)
    except sqlite3.Error:
        logger.exception("Failed to save website enquiry")
        raise HTTPException(
            status_code=500,
            detail="We could not save your enquiry. Please try again.",
        ) from None

    email_status = send_email_notification(enquiry, enquiry_id)

    try:
        update_email_status(enquiry_id, email_status)
    except sqlite3.Error:
        logger.exception("Failed to update email status for enquiry %s", enquiry_id)

    return {
        "status": "saved",
        "enquiry_id": enquiry_id,
        "notifications": {"email": email_status},
    }