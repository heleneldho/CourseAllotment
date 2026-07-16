import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..config import get_env
from ..database import get_db
from ..models import User

router = APIRouter(prefix="/auth", tags=["Authentication"])

GOOGLE_CLIENT_ID = get_env(
    "GOOGLE_CLIENT_ID",
    "290347264256-4qhafkfuo4kfrjgd4721gjab3nj2ibnj.apps.googleusercontent.com",
)
VALID_ROLES = {"admin", "faculty"}


class TokenRoleRequest(BaseModel):
    credential_token: str
    chosen_role: str


@router.post("/google-login")
def google_login(payload: TokenRoleRequest, db: Session = Depends(get_db)):
    """Verify a Google ID token and lock the account to the selected workspace role."""
    if payload.chosen_role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role selected.")

    google_verify_url = "https://oauth2.googleapis.com/tokeninfo"

    try:
        response = requests.get(
            google_verify_url,
            params={"id_token": payload.credential_token},
            timeout=10,
        )
    except requests.RequestException:
        raise HTTPException(status_code=503, detail="Unable to verify Google credential right now.")

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid token credential from Google.")

    user_info = response.json()
    if user_info.get("aud") != GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=401, detail="Google token was issued for a different client.")

    if user_info.get("email_verified") != "true":
        raise HTTPException(status_code=401, detail="Google account email is not verified.")

    email = user_info.get("email")
    name = user_info.get("name") or email
    if not email:
        raise HTTPException(status_code=401, detail="Google credential did not include an email address.")

    user = db.query(User).filter(User.email == email).first()

    if not user:
        user = User(
            email=email,
            name=name,
            role=payload.chosen_role,
            current_capacity=2 if payload.chosen_role == "faculty" else 0,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        if user.role == "inactive_faculty" and payload.chosen_role == "faculty":
            user.role = "faculty"
            db.commit()
            db.refresh(user)

        if user.role != payload.chosen_role:
            raise HTTPException(
                status_code=403,
                detail=(
                    "Access Denied: This account is already registered as a system "
                    f"'{user.role}'. You cannot sign in to the '{payload.chosen_role}' panel."
                ),
            )

    return {"email": user.email, "name": user.name, "role": user.role, "user_id": user.id}
