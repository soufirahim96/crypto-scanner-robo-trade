import hashlib
import uuid
import datetime
import secrets
from typing import Optional, Dict, Any, List

def generate_32_hash_id() -> str:
    """
    Generates a unique 32-character hex hash ID for the user.
    Uses MD5 digest over random UUID bytes to guarantee 32 hex characters.
    """
    random_bytes = uuid.uuid4().bytes + secrets.token_bytes(16)
    return hashlib.md5(random_bytes).hexdigest()  # Exactly 32 hex characters

def hash_password(password: str, salt: Optional[str] = None) -> Dict[str, str]:
    """
    Hashes password using SHA-256 with a salt.
    """
    if not salt:
        salt = secrets.token_hex(16)
    salted_pwd = (salt + password).encode('utf-8')
    hashed = hashlib.sha256(salted_pwd).hexdigest()
    return {"hash": hashed, "salt": salt}

def verify_password(password: str, stored_hash: str, salt: str) -> bool:
    """
    Verifies user password against stored hash.
    """
    res = hash_password(password, salt)
    return res["hash"] == stored_hash
