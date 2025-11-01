from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
import os
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# Security configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "industrial-iot-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))  # 8 hours
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin")  # Default admin password

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

class UserModel(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: str = "user"  # admin, operator, viewer, user
    active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None
    permissions: Dict[str, bool] = Field(default={
        "read_devices": True,
        "write_devices": False,
        "read_protocols": True,
        "write_protocols": False,
        "read_alerts": True,
        "write_alerts": False,
        "admin_access": False
    })

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    user: UserModel

class CreateUserRequest(BaseModel):
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    password: str
    role: str = "user"
    permissions: Optional[Dict[str, bool]] = None

class UpdateUserRequest(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    active: Optional[bool] = None
    permissions: Optional[Dict[str, bool]] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

# In-memory user storage (in production, this would be MongoDB)
users_storage: Dict[str, UserModel] = {}
password_storage: Dict[str, str] = {}  # username -> hashed_password

def create_default_admin():
    """Create default admin user"""
    if "admin" not in users_storage:
        admin_user = UserModel(
            id="user_admin",
            username="admin",
            email="admin@industrial-iot.local",
            full_name="System Administrator",
            role="admin",
            active=True,
            created_at=datetime.utcnow(),
            permissions={
                "read_devices": True,
                "write_devices": True,
                "read_protocols": True,
                "write_protocols": True,
                "read_alerts": True,
                "write_alerts": True,
                "admin_access": True,
                "manage_users": True,
                "system_settings": True
            }
        )
        
        users_storage["admin"] = admin_user
        password_storage["admin"] = pwd_context.hash(ADMIN_PASSWORD)
        logger.info(f"Created default admin user with password from env (default: admin)")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash password"""
    return pwd_context.hash(password)

def authenticate_user(username: str, password: str) -> Optional[UserModel]:
    """Authenticate user credentials"""
    if username not in users_storage:
        return None
    
    user = users_storage[username]
    if not user.active:
        return None
    
    if username not in password_storage:
        return None
        
    if not verify_password(password, password_storage[username]):
        return None
    
    # Update last login
    user.last_login = datetime.utcnow()
    users_storage[username] = user
    
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Optional[UserModel]:
    """Get current user from JWT token"""
    if not credentials:
        return None
    
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
            
        user = users_storage.get(username)
        if user is None or not user.active:
            return None
            
        return user
        
    except JWTError:
        return None

async def require_auth(current_user: UserModel = Depends(get_current_user)) -> UserModel:
    """Require authentication"""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return current_user

async def require_admin(current_user: UserModel = Depends(require_auth)) -> UserModel:
    """Require admin role"""
    if current_user.role != "admin" and not current_user.permissions.get("admin_access", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user

# Initialize default admin user
create_default_admin()

@router.post("/auth/login", response_model=TokenResponse)
async def login(login_data: LoginRequest):
    """Authenticate user and return JWT token"""
    try:
        user = authenticate_user(login_data.username, login_data.password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username, "role": user.role},
            expires_delta=access_token_expires
        )
        
        logger.info(f"User {user.username} logged in successfully")
        
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=user
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )

@router.post("/auth/logout")
async def logout(current_user: UserModel = Depends(require_auth)):
    """Logout user (client should discard token)"""
    logger.info(f"User {current_user.username} logged out")
    return {"message": "Logged out successfully"}

@router.get("/auth/me", response_model=UserModel)
async def get_current_user_info(current_user: UserModel = Depends(require_auth)):
    """Get current user information"""
    return current_user

@router.get("/auth/users", response_model=list[UserModel])
async def get_all_users(current_user: UserModel = Depends(require_admin)):
    """Get all users (admin only)"""
    return list(users_storage.values())

@router.post("/auth/users", response_model=UserModel)
async def create_user(user_data: CreateUserRequest, current_user: UserModel = Depends(require_admin)):
    """Create new user (admin only)"""
    try:
        if user_data.username in users_storage:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already exists"
            )
        
        # Set default permissions based on role
        default_permissions = {
            "admin": {
                "read_devices": True, "write_devices": True,
                "read_protocols": True, "write_protocols": True,
                "read_alerts": True, "write_alerts": True,
                "admin_access": True, "manage_users": True, "system_settings": True
            },
            "operator": {
                "read_devices": True, "write_devices": True,
                "read_protocols": True, "write_protocols": True,
                "read_alerts": True, "write_alerts": True,
                "admin_access": False
            },
            "viewer": {
                "read_devices": True, "write_devices": False,
                "read_protocols": True, "write_protocols": False,
                "read_alerts": True, "write_alerts": False,
                "admin_access": False
            },
            "user": {
                "read_devices": True, "write_devices": False,
                "read_protocols": True, "write_protocols": False,
                "read_alerts": True, "write_alerts": False,
                "admin_access": False
            }
        }
        
        permissions = user_data.permissions or default_permissions.get(user_data.role, default_permissions["user"])
        
        new_user = UserModel(
            id=f"user_{user_data.username}_{int(datetime.utcnow().timestamp())}",
            username=user_data.username,
            email=user_data.email,
            full_name=user_data.full_name,
            role=user_data.role,
            permissions=permissions,
            created_at=datetime.utcnow()
        )
        
        users_storage[user_data.username] = new_user
        password_storage[user_data.username] = get_password_hash(user_data.password)
        
        logger.info(f"Created user {user_data.username} with role {user_data.role} by {current_user.username}")
        
        return new_user
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )

@router.put("/auth/users/{username}", response_model=UserModel)
async def update_user(username: str, update_data: UpdateUserRequest, current_user: UserModel = Depends(require_admin)):
    """Update user (admin only)"""
    try:
        if username not in users_storage:
            raise HTTPException(status_code=404, detail="User not found")
        
        user = users_storage[username]
        update_dict = update_data.dict(exclude_none=True)
        
        for key, value in update_dict.items():
            setattr(user, key, value)
        
        users_storage[username] = user
        
        logger.info(f"Updated user {username} by {current_user.username}")
        
        return user
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update user {username}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user"
        )

@router.delete("/auth/users/{username}")
async def delete_user(username: str, current_user: UserModel = Depends(require_admin)):
    """Delete user (admin only)"""
    try:
        if username == "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot delete admin user"
            )
        
        if username == current_user.username:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot delete yourself"
            )
        
        if username not in users_storage:
            raise HTTPException(status_code=404, detail="User not found")
        
        del users_storage[username]
        if username in password_storage:
            del password_storage[username]
        
        logger.info(f"Deleted user {username} by {current_user.username}")
        
        return {"message": "User deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete user {username}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete user"
        )

@router.put("/auth/change-password")
async def change_password(password_data: ChangePasswordRequest, current_user: UserModel = Depends(require_auth)):
    """Change user password"""
    try:
        username = current_user.username
        
        if username not in password_storage:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User password not found"
            )
        
        # Verify current password
        if not verify_password(password_data.current_password, password_storage[username]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Current password is incorrect"
            )
        
        # Update password
        password_storage[username] = get_password_hash(password_data.new_password)
        
        logger.info(f"Password changed for user {username}")
        
        return {"message": "Password changed successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to change password: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to change password"
        )

@router.get("/auth/stats")
async def get_auth_stats(current_user: UserModel = Depends(require_admin)):
    """Get authentication statistics (admin only)"""
    try:
        now = datetime.utcnow()
        last_24h = now - timedelta(hours=24)
        
        all_users = list(users_storage.values())
        
        stats = {
            "total_users": len(all_users),
            "active_users": len([u for u in all_users if u.active]),
            "inactive_users": len([u for u in all_users if not u.active]),
            "by_role": {},
            "recent_logins": len([u for u in all_users if u.last_login and u.last_login > last_24h]),
            "admin_password_set": ADMIN_PASSWORD != "admin",
            "jwt_expires_in": ACCESS_TOKEN_EXPIRE_MINUTES
        }
        
        # Count by role
        for user in all_users:
            role = user.role
            stats["by_role"][role] = stats["by_role"].get(role, 0) + 1
        
        return stats
        
    except Exception as e:
        logger.error(f"Failed to get auth stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get authentication statistics"
        )

@router.post("/auth/verify-token")
async def verify_token(current_user: UserModel = Depends(get_current_user)):
    """Verify if token is valid"""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    return {
        "valid": True,
        "user": current_user,
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }

# Utility functions for other API routes
def check_permission(user: UserModel, permission: str) -> bool:
    """Check if user has specific permission"""
    if user.role == "admin":
        return True
    return user.permissions.get(permission, False)

def require_permission(permission: str):
    """Decorator to require specific permission"""
    async def permission_checker(current_user: UserModel = Depends(require_auth)):
        if not check_permission(current_user, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission}' required"
            )
        return current_user
    return permission_checker

# Export commonly used dependencies
__all__ = [
    "router", 
    "require_auth", 
    "require_admin", 
    "get_current_user", 
    "UserModel", 
    "check_permission",
    "require_permission"
]