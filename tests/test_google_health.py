import hashlib
import json
import tempfile
import time
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

import httpx
from cryptography.fernet import Fernet
from google.auth.exceptions import RefreshError
from fastapi import HTTPException
import google_health as health
import main


class GoogleHealthTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.root_patch = patch.object(health, "ROOT", self.root)
        self.root_patch.start()
        self.env_patch = patch.dict(health.os.environ, {}, clear=True)
        self.env_patch.start()
        client = {"web": {"client_id":"test.apps.googleusercontent.com", "client_secret":"test-secret", "auth_uri":"https://accounts.google.com/o/oauth2/auth", "token_uri":"https://oauth2.googleapis.com/token", "redirect_uris":["http://localhost:8000/google-health/callback"]}}
        (self.root / "client_secret.json").write_text(json.dumps(client))
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://test")
        result = await self.client.post("/google-health/device")
        self.assertEqual(result.status_code, 200)
        self.token = result.json()["token"]
        self.device = hashlib.sha256(self.token.encode()).hexdigest()
        self.headers = {"Authorization":"Bearer " + self.token}
        self.account = {"sub": "google-user", "email": "user@example.com", "name": "User"}
        with health.database() as db:
            db.execute("UPDATE devices SET identity=?, session_expires=? WHERE id=?", (health.seal(self.account), time.time()+3600, self.device))

    async def asyncTearDown(self):
        await self.client.aclose()
        self.env_patch.stop()
        self.root_patch.stop()
        self.temp.cleanup()

    def grant(self):
        with health.database() as db:
            db.execute("UPDATE devices SET grant=? WHERE id=?",(health.seal({"credentials":{"token":"private-access", "refresh_token":"private-refresh", "token_uri":"https://oauth2.googleapis.com/token","client_id":"client","client_secret":"private-secret", "scopes":[health.SCOPE]},"health_user_id":"health-user"}),self.device))

    async def authorize(self):
        response = await self.client.post("/google-health/authorize",headers=self.headers)
        self.assertEqual(response.status_code,200)
        return parse_qs(urlparse(response.json()["url"]).query)

    async def test_pkce_callback_and_single_use(self):
        params = await self.authorize()
        self.assertEqual(params["code_challenge_method"],["S256"])
        self.assertEqual(set(params["scope"][0].split()), {health.SCOPE, "openid", "https://www.googleapis.com/auth/userinfo.email"})
        self.assertEqual(params["redirect_uri"],["http://localhost:8000/google-health/callback"])
        state = params["state"][0]
        credentials = SimpleNamespace(token="access-secret",refresh_token="refresh-secret",granted_scopes=[health.SCOPE],to_json=lambda:json.dumps({"token":"access-secret","refresh_token":"refresh-secret"}))
        oauth = SimpleNamespace(credentials=credentials,fetch_token=lambda **kwargs:None)
        with patch.object(health,"verified_identity",return_value=self.account),patch.object(health,"flow",return_value=oauth),patch.object(health,"google_get",return_value={"healthUserId":"health-user"}):
            result = await self.client.get("/google-health/callback",params={"state":state,"code":"one-time-code"})
        self.assertEqual(result.status_code,200)
        self.assertNotIn("access-secret",result.text)
        self.assertIn(health._csp_hash(health.CALLBACK_SCRIPT),result.headers.get("content-security-policy",""))
        self.assertIn(health.CALLBACK_SCRIPT,result.text)
        self.assertTrue((await self.client.get("/google-health/status",headers=self.headers)).json()["connected"])
        self.assertEqual((await self.client.get("/google-health/callback",params={"state":state,"code":"replay"})).status_code,400)
        self.assertNotIn(b"access-secret",(self.root/".health/connections.sqlite3").read_bytes())

    async def test_isolation_and_disconnect(self):
        self.grant()
        other = (await self.client.post("/google-health/device")).json()["token"]
        self.assertFalse((await self.client.get("/google-health/status",headers={"Authorization":"Bearer "+other})).json()["connected"])
        self.assertEqual((await self.client.get("/google-health/status")).status_code,401)
        with patch.object(health,"revoke") as revoke:
            result = await self.client.delete("/google-health/connection",headers=self.headers)
            revoke.assert_called_once_with("private-refresh")
        self.assertEqual(result.status_code,200)
        status = (await self.client.get("/google-health/status",headers=self.headers)).json()
        self.assertTrue(status["signed_in"])
        self.assertFalse(status["has_grant"])

    async def test_denied_expired_and_unlinked(self):
        state = (await self.authorize())["state"][0]
        await self.client.get("/google-health/callback",params={"state":state,"error":"access_denied"})
        status=(await self.client.get("/google-health/status",headers=self.headers)).json()
        self.assertFalse(status["connected"])
        self.assertIn("cancelled",status["error"])
        state=(await self.authorize())["state"][0]
        with health.database() as db: db.execute("UPDATE pending SET expires=?",(time.time()-1,))
        self.assertEqual((await self.client.get("/google-health/callback",params={"state":state,"code":"test"})).status_code,400)
        state=(await self.authorize())["state"][0]
        credentials=SimpleNamespace(token="access",refresh_token="refresh",granted_scopes=[health.SCOPE])
        oauth=SimpleNamespace(credentials=credentials,fetch_token=lambda **kwargs:None)
        with patch.object(health,"verified_identity",return_value=self.account),patch.object(health,"flow",return_value=oauth),patch.object(health,"google_get",return_value={}),patch.object(health,"revoke"):
            self.assertEqual((await self.client.get("/google-health/callback",params={"state":state,"code":"test"})).status_code,400)
        self.assertFalse((await self.client.get("/google-health/status",headers=self.headers)).json()["has_grant"])

    async def test_workout_pagination(self):
        self.grant()
        point={"name":"users/me/dataTypes/exercise/dataPoints/run", "exercise":{"interval":{"startTime":"2026-10-11T01:00:00Z","endTime":"2026-10-11T01:40:00Z","startUtcOffset":"-18000s"},"exerciseType":"RUNNING","activeDuration":"1800s","metricsSummary":{"caloriesKcal":300}}}
        with patch.object(health,"get_credentials",return_value=SimpleNamespace(token="token")),patch.object(health,"google_get",side_effect=[{"dataPoints":[point],"nextPageToken":"next"},{"dataPoints":[point]}]) as get:
            response=await self.client.get("/google-health/workouts?start=2026-10-10&end=2026-10-12",headers=self.headers)
        self.assertEqual(response.status_code,200)
        self.assertEqual(len(response.json()["workouts"]),1)
        workout=response.json()["workouts"][0]
        self.assertEqual(workout["local_date"],"2026-10-10")
        self.assertEqual(workout["duration_minutes"],30)
        self.assertEqual(workout["status"],"completed")
        self.assertEqual(get.call_count,2)
        self.assertEqual((await self.client.get("/google-health/workouts?start=2026-09-01&end=2026-10-12",headers=self.headers)).status_code,422)

    async def test_refresh_and_revocation(self):
        self.grant()
        credentials=SimpleNamespace(valid=False,to_json=lambda:json.dumps({"token":"new-access","refresh_token":"private-refresh"}))
        credentials.refresh=lambda request:None
        with patch.object(health.Credentials,"from_authorized_user_info",return_value=credentials):
            self.assertIs(health.get_credentials(self.device),credentials)
        with health.database() as db:
            stored=health.unseal(db.execute("SELECT grant FROM devices WHERE id=?",(self.device,)).fetchone()["grant"])
        self.assertEqual(stored["credentials"]["token"],"new-access")
        def fail(request): raise RefreshError("invalid_grant")
        credentials.refresh=fail
        with patch.object(health.Credentials,"from_authorized_user_info",return_value=credentials):
            with self.assertRaises(HTTPException) as context: health.get_credentials(self.device)
        self.assertEqual(context.exception.status_code,401)
        self.assertFalse((await self.client.get("/google-health/status",headers=self.headers)).json()["connected"])

    async def test_failed_revocation_retains_connection(self):
        self.grant()
        with patch.object(health,"revoke",side_effect=HTTPException(502,"Try again")):
            self.assertEqual((await self.client.delete("/google-health/connection",headers=self.headers)).status_code,502)
        self.assertTrue((await self.client.get("/google-health/status",headers=self.headers)).json()["has_grant"])

    async def start_login(self):
        with health.database() as db:
            db.execute("UPDATE devices SET identity=NULL, session_expires=NULL WHERE id=?", (self.device,))
        response = await self.client.post("/google-health/login", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        return parse_qs(urlparse(response.json()["url"]).query)

    async def complete_login(self, params, **changes):
        claims = dict(self.account, email_verified=True, nonce=params["nonce"][0]); claims.update(changes)
        oauth = SimpleNamespace(credentials=SimpleNamespace(token="login-access",refresh_token=None), oauth2session=SimpleNamespace(token={"id_token":"signed-id"}), fetch_token=lambda **kwargs: None)
        with patch.object(health, "flow", return_value=oauth), patch.object(health.id_token, "verify_oauth2_token", return_value=claims) as verify, patch.object(health, "revoke"):
            result = await self.client.get("/google-health/callback", params={"state":params["state"][0], "code":"code"})
            verify.assert_called_once()
            self.assertEqual(verify.call_args.args[2], "test.apps.googleusercontent.com")
        return result

    def test_google_expanded_scope_response(self):
        from oauthlib.oauth2 import WebApplicationClient
        client = WebApplicationClient("test")
        response = client.parse_request_body_response(json.dumps({"access_token":"test", "token_type":"Bearer", "scope":"openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile"}), scope=health.LOGIN_SCOPES)
        self.assertEqual(response["access_token"], "test")

    async def test_login_without_health_and_logout(self):
        params = await self.start_login()
        self.assertEqual(set(params["scope"][0].split()), set(health.LOGIN_SCOPES))
        self.assertEqual(params["code_challenge_method"], ["S256"])
        self.assertEqual((await self.client.post("/google-health/authorize", headers=self.headers)).status_code, 401)
        self.assertEqual((await self.complete_login(params)).status_code, 200)
        status = (await self.client.get("/google-health/status", headers=self.headers)).json()
        self.assertTrue(status["signed_in"])
        self.assertEqual(status["user"], self.account)
        self.assertFalse(status["has_grant"])
        self.assertEqual((await self.client.get("/google-health/callback",params={"state":params["state"][0],"code":"replay"})).status_code,400)
        await self.authorize()
        self.assertEqual((await self.client.delete("/google-health/session", headers=self.headers)).status_code, 200)
        self.assertEqual((await self.client.get("/google-health/status", headers=self.headers)).status_code, 401)

    async def test_invalid_nonce_and_token(self):
        params = await self.start_login()
        params["nonce"] = ["wrong-nonce"]
        self.assertEqual((await self.complete_login(params)).status_code,400)
        self.assertFalse((await self.client.get("/google-health/status",headers=self.headers)).json()["signed_in"])
        params = await self.start_login()
        oauth = SimpleNamespace(credentials=SimpleNamespace(token="access",refresh_token=None), oauth2session=SimpleNamespace(token={"id_token":"forged"}), fetch_token=lambda **kwargs:None)
        with patch.object(health,"flow",return_value=oauth), patch.object(health.id_token,"verify_oauth2_token",side_effect=ValueError("bad signature")), patch.object(health,"revoke"):
            self.assertEqual((await self.client.get("/google-health/callback", params={"state":params["state"][0],"code":"code"})).status_code,400)
        self.assertFalse((await self.client.get("/google-health/status",headers=self.headers)).json()["signed_in"])

    async def test_mismatched_health_account(self):
        params = await self.authorize()
        oauth = SimpleNamespace(credentials=SimpleNamespace(token="access",refresh_token="refresh"), fetch_token=lambda **kwargs:None)
        with patch.object(health,"flow",return_value=oauth), patch.object(health,"verified_identity",return_value={"sub":"another-user"}), patch.object(health,"revoke"), patch.object(health,"google_get") as get:
            self.assertEqual((await self.client.get("/google-health/callback",params={"state":params["state"][0],"code":"code"})).status_code,400)
            get.assert_not_called()
        status = (await self.client.get("/google-health/status",headers=self.headers)).json()
        self.assertTrue(status["signed_in"])
        self.assertFalse(status["has_grant"])
        self.assertIn("same Google account",status["error"])

    async def test_legacy_grant_cannot_be_attached_to_new_login(self):
        self.grant()
        with health.database() as db:
            db.execute("UPDATE devices SET identity=NULL WHERE id=?", (self.device,))
        self.assertEqual((await self.client.post("/google-health/login",headers=self.headers)).status_code,409)
        with patch.object(health,"revoke"):
            self.assertEqual((await self.client.delete("/google-health/session",headers=self.headers)).status_code,200)

    async def test_logout_revocation_failure_retains_session(self):
        self.grant()
        with patch.object(health,"revoke",side_effect=HTTPException(502,"Try again")):
            self.assertEqual((await self.client.delete("/google-health/session",headers=self.headers)).status_code,502)
        status = (await self.client.get("/google-health/status",headers=self.headers)).json()
        self.assertTrue(status["signed_in"])
        self.assertTrue(status["has_grant"])
        with patch.object(health,"revoke"):
            self.assertEqual((await self.client.delete("/google-health/session",headers=self.headers)).status_code,200)
        self.assertEqual((await self.client.get("/google-health/status",headers=self.headers)).status_code,401)

    async def test_session_expiry_and_api_authentication(self):
        for path in ["/nutrition/targets", "/suggestions"]:
            self.assertEqual((await self.client.post(path, json={})).status_code,401)
        with health.database() as db:
            db.execute("UPDATE devices SET session_expires=? WHERE id=?", (time.time()-1,self.device))
        self.assertFalse((await self.client.get("/google-health/status",headers=self.headers)).json()["signed_in"])
        self.assertEqual((await self.client.post("/google-health/authorize",headers=self.headers)).status_code,401)
        self.assertEqual((await self.client.get("/google-health/workouts?start=2026-10-10&end=2026-10-12",headers=self.headers)).status_code,401)
        self.assertEqual((await self.client.post("/suggestions",headers=self.headers,json={})).status_code,401)

    async def test_disabled_without_credentials_and_native_json(self):
        (self.root/"client_secret.json").unlink()
        self.assertFalse((await self.client.get("/google-health/config")).json()["available"])
        (self.root/"client_secret.json").write_text('{"installed":{}}')
        self.assertFalse((await self.client.get("/google-health/config")).json()["available"])
        self.assertEqual((await self.client.post("/google-health/device")).status_code,503)


class WorkoutNormalizationTests(unittest.TestCase):
    def test_civil_date_and_invalid_session(self):
        point={"name":"run", "exercise":{"interval":{"startTime":"2026-10-10T01:00:00Z","endTime":"2026-10-10T01:30:00Z","civilStartTime":{"date":{"year":2026,"month":10,"day":9}}},"exerciseType":"STRENGTH_TRAINING"}}
        self.assertEqual(health.normalize_workout(point)["local_date"],"2026-10-09")
        self.assertEqual(health.normalize_workout(point)["duration_minutes"],30)
        point["exercise"]["activeDuration"]="NaNs"
        self.assertIsNone(health.normalize_workout(point))
        self.assertIsNone(health.normalize_workout({}))


if __name__ == "__main__": unittest.main()
