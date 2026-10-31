"""Personal Google Health connection. Google credentials never leave the backend."""
import hashlib
import json
import math
import os
import secrets
import sqlite3
import threading
import time
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

import requests
from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import HTMLResponse
from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.credentials import Credentials
from google.oauth2 import id_token
from google_auth_oauthlib.flow import Flow

router = APIRouter(prefix="/google-health", tags=["Google Health"])
SCOPE = "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly"
BASE = "https://health.googleapis.com/v4/users/me"
LOCK = threading.RLock()
ROOT = Path(__file__).resolve().parent
NO_CACHE = {"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"}


def config():
    path = Path(os.getenv("GOOGLE_HEALTH_CLIENT_SECRET_FILE", str(ROOT / "client_secret.json")))
    redirect = os.getenv("GOOGLE_HEALTH_REDIRECT_URI", "http://localhost:8000/google-health/callback")
    try:
        value = json.loads(path.read_text())
        client = value["web"]
        # Fixed endpoints prevent credential JSON from redirecting secrets to another server.
        if client["auth_uri"] != "https://accounts.google.com/o/oauth2/auth" or client["token_uri"] != "https://oauth2.googleapis.com/token":
            raise ValueError()
        if not client.get("client_id") or not client.get("client_secret"):
            raise ValueError()
        parsed = urlparse(redirect)
        if parsed.query or parsed.fragment or parsed.path != "/google-health/callback":
            raise ValueError()
        if parsed.scheme != "https" and not (parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1"}):
            raise ValueError()
        return value, redirect
    except (OSError, ValueError, KeyError, TypeError):
        raise HTTPException(503, "Google Health is not configured. Add a Web application client_secret.json beside main.py and set the matching callback URI.")


def cipher():
    key = os.getenv("GOOGLE_HEALTH_TOKEN_KEY")
    if not key:
        folder = ROOT / ".health"
        folder.mkdir(mode=0o700, exist_ok=True)
        folder.chmod(0o700)
        path = folder / "token.key"
        with LOCK:
            if not path.exists():
                with path.open("xb") as stream:
                    path.chmod(0o600)
                    stream.write(Fernet.generate_key())
            key = path.read_text().strip()
            path.chmod(0o600)
    try:
        return Fernet(key.encode())
    except ValueError:
        raise HTTPException(503, "GOOGLE_HEALTH_TOKEN_KEY must be a valid Fernet encryption key.")


@contextmanager
def database():
    folder = ROOT / ".health"
    folder.mkdir(mode=0o700, exist_ok=True)
    folder.chmod(0o700)
    path = folder / "connections.sqlite3"
    with LOCK:
        db = sqlite3.connect(path)
        try:
            path.chmod(0o600)
            db.row_factory = sqlite3.Row
            db.execute("CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, grant BLOB, error TEXT, synced TEXT)")
            db.execute("CREATE TABLE IF NOT EXISTS pending (state TEXT PRIMARY KEY, device TEXT, verifier BLOB, expires REAL)")
            columns = {row[1] for row in db.execute("PRAGMA table_info(devices)")}
            if "identity" not in columns:
                db.execute("ALTER TABLE devices ADD COLUMN identity BLOB")
                db.execute("ALTER TABLE devices ADD COLUMN session_expires REAL")
            db.execute("DELETE FROM pending WHERE expires < ?", (time.time(),))
            yield db
            db.commit()
        finally:
            db.close()


def seal(value):
    return cipher().encrypt(json.dumps(value).encode())


def unseal(value):
    try:
        return json.loads(cipher().decrypt(value))
    except (InvalidToken, ValueError):
        raise HTTPException(503, "Cannot decrypt this connection. Restore the original token encryption key.")


def owner(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer ") or len(authorization) > 200:
        raise HTTPException(401, "A device connection credential is required.")
    key = hashlib.sha256(authorization[7:].encode()).hexdigest()
    with database() as db:
        if not db.execute("SELECT 1 FROM devices WHERE id=?", (key,)).fetchone():
            raise HTTPException(401, "This connection has expired or was deleted. Connect again.")
    return key


def flow(state=None, verifier=None, scopes=None):
    value, redirect = config()
    return Flow.from_client_config(value, scopes=scopes or [SCOPE, "openid", "https://www.googleapis.com/auth/userinfo.email"], state=state, code_verifier=verifier,
                                   autogenerate_code_verifier=verifier is None, redirect_uri=redirect)


LOGIN_SCOPES = ["openid", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"]


def signed_owner(device: str = Depends(owner)):
    with database() as db:
        row = db.execute("SELECT identity, session_expires FROM devices WHERE id=?", (device,)).fetchone()
    if not row or not row["identity"] or (row["session_expires"] or 0) <= time.time():
        raise HTTPException(401, "Sign in with Google to continue.")
    return device


def verified_identity(oauth, nonce):
    value, _ = config()
    claims = id_token.verify_oauth2_token(oauth.oauth2session.token.get("id_token", ""), GoogleRequest(), value["web"]["client_id"])
    if not claims.get("sub") or not claims.get("email_verified") or not secrets.compare_digest(str(claims.get("nonce", "")), nonce):
        raise HTTPException(401, "Google identity could not be verified. Sign in again.")
    return {"sub": claims["sub"], "email": claims.get("email", ""), "name": claims.get("name", "")}


@router.post("/login")
def login(device: str = Depends(owner)):
    with LOCK:
        with database() as db:
            row = db.execute("SELECT identity,grant FROM devices WHERE id=?", (device,)).fetchone()
            if row["identity"] or row["grant"]:
                raise HTTPException(409, "Use Reset sign-in / sign out before signing in again. This also disconnects any previous Health connection.")
        nonce = secrets.token_urlsafe(32)
        oauth = flow(scopes=LOGIN_SCOPES)
        url, state = oauth.authorization_url(prompt="select_account", nonce=nonce, include_granted_scopes="false")
        with database() as db:
            db.execute("DELETE FROM pending WHERE device=?", (device,))
            db.execute("INSERT INTO pending VALUES (?,?,?,?)", (state, device, seal({"verifier": oauth.code_verifier, "nonce": nonce, "kind": "login"}), time.time()+600))
            db.execute("UPDATE devices SET error=NULL WHERE id=?", (device,))
    return {"url": url}


@router.delete("/session")
def logout(device: str = Depends(owner)):
    # Sign-out also revokes and deletes this device's Health connection.
    with LOCK:
        disconnect(device)
        with database() as db:
            db.execute("DELETE FROM devices WHERE id=?", (device,))
    return {"signed_out": True}


def save_error(device, message):
    with database() as db:
        db.execute("UPDATE devices SET error=? WHERE id=?", (message, device))


def revoke(token):
    try:
        response = requests.post("https://oauth2.googleapis.com/revoke", data={"token": token}, timeout=20)
    except requests.RequestException:
        raise HTTPException(502, "Google could not revoke the connection. Try disconnecting again.")
    if response.status_code not in {200, 400}:
        raise HTTPException(502, "Google could not revoke the connection. Try disconnecting again.")


def get_credentials(device):
    config()
    with database() as db:
        row = db.execute("SELECT grant FROM devices WHERE id=?", (device,)).fetchone()
    if not row or not row["grant"]:
        raise HTTPException(409, "Connect Google Health first.")
    stored = unseal(row["grant"])
    credentials = Credentials.from_authorized_user_info(stored["credentials"], scopes=[SCOPE])
    if not credentials.valid:
        try:
            credentials.refresh(GoogleRequest())
        except RefreshError as exc:
            if getattr(exc, "retryable", False):
                raise HTTPException(502, "Google is temporarily unavailable. Try syncing again.") from exc
            save_error(device, "Google authorization expired or was revoked. Reconnect Google Health.")
            raise HTTPException(401, "Google authorization expired or was revoked. Reconnect Google Health.") from exc
        except Exception as exc:
            raise HTTPException(502, "Could not refresh Google access. Try syncing again.") from exc
        stored["credentials"] = json.loads(credentials.to_json())
        with database() as db:
            db.execute("UPDATE devices SET grant=?, error=NULL WHERE id=?", (seal(stored), device))
    return credentials


def google_get(credentials, path, params=None):
    try:
        response = requests.get(f"{BASE}/{path}", headers={"Authorization": f"Bearer {credentials.token}"}, params=params, timeout=20)
        if response.status_code in {401, 403}:
            raise HTTPException(response.status_code, "Google denied health access. Check API enablement and consent, then reconnect.")
        if response.status_code == 404:
            raise HTTPException(409, "Sign in to the Google Health mobile app with this Google account before connecting.")
        response.raise_for_status()
        data = response.json()
        if not isinstance(data, dict):
            raise ValueError("Invalid Google response")
        return data
    except (requests.RequestException, ValueError) as exc:
        raise HTTPException(502, "Google Health could not return data. Try again.") from exc


@router.get("/config")
def public_config():
    try:
        config()
        cipher()
        return {"available": True, "message": "Ready to connect. Sign in to the Google Health mobile app first."}
    except HTTPException as exc:
        return {"available": False, "message": exc.detail}


@router.post("/device")
def create_device():
    config()
    cipher()
    token = secrets.token_urlsafe(32)
    with database() as db:
        db.execute("INSERT INTO devices(id) VALUES (?)", (hashlib.sha256(token.encode()).hexdigest(),))
    from fastapi.responses import JSONResponse
    return JSONResponse({"token": token}, headers=NO_CACHE)


@router.post("/authorize")
def authorize(device: str = Depends(signed_owner)):
    cipher()
    with LOCK:
        with database() as db:
            if db.execute("SELECT grant FROM devices WHERE id=?", (device,)).fetchone()["grant"]:
                raise HTTPException(409, "Disconnect the current Google account before connecting another.")
        with database() as db:
            identity = unseal(db.execute("SELECT identity FROM devices WHERE id=?", (device,)).fetchone()["identity"])
        nonce = secrets.token_urlsafe(32)
        oauth = flow()
        url, state = oauth.authorization_url(access_type="offline", prompt="consent", include_granted_scopes="false", nonce=nonce, login_hint=identity["sub"])
        with database() as db:
            db.execute("DELETE FROM pending WHERE device=?", (device,))
            db.execute("INSERT INTO pending VALUES (?,?,?,?)", (state, device, seal({"verifier": oauth.code_verifier, "nonce": nonce, "kind": "health"}), time.time()+600))
            db.execute("UPDATE devices SET error=NULL WHERE id=?", (device,))
    return {"url": url}


@router.get("/callback", response_class=HTMLResponse)
def callback(state: str = "", code: str | None = None, error: str | None = None):
    with LOCK:
        with database() as db:
            pending = db.execute("SELECT * FROM pending WHERE state=?", (state,)).fetchone()
            if not pending:
                return HTMLResponse("<p>This connection request expired or was already used. Return to eatEazy and connect again.</p>", status_code=400, headers=NO_CACHE)
            db.execute("DELETE FROM pending WHERE state=?", (state,))
        device = pending["device"]
        if error or not code:
            save_error(device, "Google connection was cancelled. You can try again.")
            return HTMLResponse("<p>Connection cancelled. Return to eatEazy.</p>", headers=NO_CACHE)
        credentials = None
        stage = "starting authorization"
        try:
            attempt = unseal(pending["verifier"])
            if not isinstance(attempt, dict):
                raise HTTPException(400, "This request predates Google sign-in. Start again.")
            oauth = flow(state, attempt["verifier"], scopes=LOGIN_SCOPES if attempt["kind"] == "login" else None)
            # Passing code directly keeps HTTP localhost testing compatible without globally disabling OAuth HTTPS checks.
            stage = "exchanging the authorization code"
            oauth.fetch_token(code=code)
            credentials = oauth.credentials
            stage = "verifying Google identity"
            account = verified_identity(oauth, attempt["nonce"])
            if attempt["kind"] == "login":
                with database() as db:
                    db.execute("UPDATE devices SET identity=?, session_expires=?, error=NULL WHERE id=?", (seal(account), time.time()+7*86400, device))
                return HTMLResponse("<p>Signed in to eatEazy. Return to the app to choose whether to connect Google Health.</p>", headers=NO_CACHE)
            signed_owner(device)
            with database() as db:
                current = unseal(db.execute("SELECT identity FROM devices WHERE id=?", (device,)).fetchone()["identity"])
            if account["sub"] != current["sub"]:
                raise HTTPException(409, "Use the same Google account you signed in with to connect Google Health.")
            if not credentials.refresh_token or SCOPE not in (credentials.granted_scopes or credentials.scopes or []):
                raise HTTPException(409, "Read-only activity consent and offline access are required. Try connecting again.")
            stage = "checking Google Health account linkage"
            identity = google_get(credentials, "identity")
            if not identity.get("healthUserId"):
                raise HTTPException(409, "Sign in to the Google Health mobile app before connecting this account.")
            with database() as db:
                db.execute("UPDATE devices SET grant=?, error=NULL WHERE id=?", (seal({"credentials": json.loads(credentials.to_json()), "health_user_id": identity["healthUserId"]}), device))
        except Exception as exc:
            # Failed identity verification must never create a connected account or retain its Google grant.
            if credentials and credentials.token:
                try: revoke(credentials.refresh_token or credentials.token)
                except HTTPException: pass
            message = exc.detail if isinstance(exc, HTTPException) else f"Google connection failed while {stage} ({type(exc).__name__}). Start a fresh sign-in and retry."
            save_error(device, message)
            return HTMLResponse("<p>Connection was not completed. Return to eatEazy for details.</p>", status_code=400, headers=NO_CACHE)
    return HTMLResponse("<p>Google Health connected. Return to eatEazy and choose Sync workouts.</p>", headers=NO_CACHE)


@router.get("/status")
def status(device: str = Depends(owner)):
    with database() as db:
        row = db.execute("SELECT grant,error,synced,identity,session_expires FROM devices WHERE id=?", (device,)).fetchone()
        pending = db.execute("SELECT 1 FROM pending WHERE device=?", (device,)).fetchone()
    account = unseal(row["identity"]) if row["identity"] and (row["session_expires"] or 0) > time.time() else None
    return {"user": account, "signed_in": bool(account), "connected": bool(account) and bool(row["grant"]) and not row["error"], "has_grant": bool(row["grant"]), "pending": bool(pending), "error": row["error"], "last_synced": row["synced"]}


def normalize_workout(point):
    """Use the session's recorded civil date, not the backend computer's timezone."""
    try:
        exercise = point["exercise"]
        interval = exercise["interval"]
        start = datetime.fromisoformat(interval["startTime"].replace("Z", "+00:00"))
        end = datetime.fromisoformat(interval["endTime"].replace("Z", "+00:00"))
        if start.tzinfo is None or end.tzinfo is None or end <= start or end > datetime.now(timezone.utc):
            return None
        active = exercise.get("activeDuration")
        duration = float(active.removesuffix("s"))/60 if active else (end-start).total_seconds()/60
        if not math.isfinite(duration) or not 0 < duration <= 1440:
            return None
        civil = interval.get("civilStartTime", {}).get("date")
        if civil:
            local = date(civil["year"], civil["month"], civil["day"])
        else:
            offset = float(interval.get("startUtcOffset", "0s").removesuffix("s"))
            local = (start+timedelta(seconds=offset)).date()
        result = {"id": "google:"+point["name"], "source":"google_health", "start_time":interval["startTime"], "local_date":local.isoformat(), "type":str(exercise.get("exerciseType", "WORKOUT")).replace("_", " ").title()[:80], "duration_minutes":round(duration, 2), "status":"completed"}
        calories = exercise.get("metricsSummary", {}).get("caloriesKcal")
        if calories is not None and math.isfinite(float(calories)) and float(calories)>=0:
            result["active_calories"] = float(calories)
        return result
    except (KeyError, ValueError, TypeError, OverflowError, AttributeError):
        return None


@router.get("/workouts")
def workouts(start: date = Query(), end: date = Query(), device: str = Depends(signed_owner)):
    if end < start or end == date.max or (end-start).days > 30:
        raise HTTPException(422, "Choose a workout date range of at most 31 days.")
    with LOCK:
        credentials = get_credentials(device)
        params = {"pageSize":25, "filter":f'exercise.interval.civil_start_time >= "{start.isoformat()}" AND exercise.interval.civil_start_time < "{(end+timedelta(days=1)).isoformat()}"'}
        results = {}
        visited = set()
        try:
            for _ in range(100):
                data = google_get(credentials, "dataTypes/exercise/dataPoints", params)
                points = data.get("dataPoints", [])
                if not isinstance(points, list):
                    raise HTTPException(502, "Google returned an invalid workout list. Try syncing again.")
                for point in points:
                    workout = normalize_workout(point)
                    if workout and start.isoformat() <= workout["local_date"] <= end.isoformat():
                        results[workout["id"]] = workout
                token = data.get("nextPageToken")
                if not token: break
                if token in visited:
                    raise HTTPException(502, "Google returned a repeated page. Try syncing again.")
                visited.add(token)
                params["pageToken"] = token
            else:
                raise HTTPException(502, "Too many workout pages. Choose a smaller date range.")
        except HTTPException as exc:
            if exc.status_code in {401,403}:
                save_error(device, exc.detail)
            raise
        synced = datetime.now(timezone.utc).isoformat()
        with database() as db:
            db.execute("UPDATE devices SET synced=?, error=NULL WHERE id=?", (synced, device))
    from fastapi.responses import JSONResponse
    return JSONResponse({"workouts":list(results.values()), "synced_at":synced}, headers=NO_CACHE)


@router.delete("/connection")
def disconnect(device: str = Depends(owner)):
    with LOCK:
        with database() as db:
            row = db.execute("SELECT grant FROM devices WHERE id=?", (device,)).fetchone()
        if row["grant"]:
            credentials = unseal(row["grant"])["credentials"]
            revoke(credentials.get("refresh_token") or credentials["token"])
        with database() as db:
            db.execute("DELETE FROM pending WHERE device=?", (device,))
            db.execute("UPDATE devices SET grant=NULL, error=NULL, synced=NULL WHERE id=?", (device,))
    return {"disconnected": True}
