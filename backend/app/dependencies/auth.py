import uuid
from typing import Optional
from fastapi import Header, HTTPException, status

async def get_install_key(x_install_key: Optional[str] = Header(None, alias="X-Install-Key")) -> uuid.UUID:
    """
    Validates per-install API key header (X-Install-Key).
    """
    if not x_install_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-Install-Key header missing"
        )
    try:
        return uuid.UUID(x_install_key)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid X-Install-Key format. Must be a valid UUID."
        )
