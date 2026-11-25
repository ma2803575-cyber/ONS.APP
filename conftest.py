import os, tempfile, pytest
_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = os.environ.get("ONS_TEST_DATABASE_URL") or f"sqlite:///{_tmp}/test.db"
os.environ["ONS_DEV_RESET"] = "1"
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture(scope="session")
def client():
    return TestClient(app)

@pytest.fixture()
def auth(client):
    import uuid
    email = f"u{uuid.uuid4().hex[:8]}@example.com"
    r = client.post("/api/auth/register", json={"name": "محمد", "email": email, "password": "Passw0rd!x"})
    assert r.status_code == 200, r.text
    return {"Authorization": "Bearer " + r.json()["token"]}, email

@pytest.fixture(autouse=True)
def _reset_limiter():
    from app import main
    main._hits.clear()
    yield
