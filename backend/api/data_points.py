# api/data_points.py
from __future__ import annotations
import logging
logger = logging.getLogger(__name__)

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union
from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field, validator
from starlette.concurrency import run_in_threadpool
from bson import ObjectId

from database.mongodb import get_database

router = APIRouter(prefix="/data-points", tags=["data-points"])

Numeric = Union[int, float]


# ====== MODELE ======
class DataPointIn(BaseModel):
    device_id: str = Field(..., min_length=1, description="Device identifier")
    tag: str = Field(..., min_length=1, description="Tag name")
    value: Union[Numeric, str, bool, None] = Field(default=None)
    quality: Optional[int] = Field(default=192, ge=0, le=255, description="Quality indicator (0-255)")
    timestamp: Optional[datetime] = None
    meta: Dict[str, Any] = Field(default_factory=dict)
    
    @validator('device_id', 'tag')
    def validate_required_strings(cls, v):
        if not v or not v.strip():
            raise ValueError('Field cannot be empty or whitespace only')
        return v.strip()


class DataPointUpdate(BaseModel):
    # wszystkie pola opcjonalne (PATCH)
    device_id: Optional[str] = None
    tag: Optional[str] = None
    value: Optional[Union[Numeric, str, bool, None]] = None
    quality: Optional[int] = None
    timestamp: Optional[datetime] = None
    meta: Optional[Dict[str, Any]] = None


# ====== POMOCNICZE ======
def _to_datetime(value: Any) -> Optional[datetime]:
    """Obsłuż epoch (s/ms) i ISO8601 (z 'Z')."""
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        ts = float(value)
        if ts > 1e12:  # epoch ms
            ts = ts / 1000.0
        return datetime.fromtimestamp(ts, tz=timezone.utc)
    if isinstance(value, str):
        try:
            if value.endswith("Z"):
                value = value[:-1] + "+00:00"
            return datetime.fromisoformat(value)
        except Exception as exc:
            raise ValueError(f"Invalid ISO8601 timestamp: {value}") from exc
    raise ValueError("Invalid timestamp type")

def _normalize_payload(raw: Dict[str, Any]) -> Dict[str, Any]:
    """camelCase -> snake_case + aliasy, zamiana 'time/ts' -> 'timestamp'."""
    mapping = {
        "deviceId": "device_id",
        "tagName": "tag",
        "point": "tag",
        "metadata": "meta",
        "attrs": "meta",
    }
    out: Dict[str, Any] = {}
    out.update(raw)
    for src, dst in mapping.items():
        if src in raw and dst not in out:
            out[dst] = raw[src]

    for k in ("timestamp", "time", "ts"):
        if k in out:
            out["timestamp"] = _to_datetime(out[k])
            break
    return out

def _encode_any(x: Any) -> Any:
    """Bezpieczna serializacja: ObjectId -> str, datetime -> ISO."""
    if isinstance(x, ObjectId):
        return str(x)
    return jsonable_encoder(x)

def _oid(id_str: str) -> ObjectId:
    """Convert string to ObjectId with better error handling"""
    if not id_str:
        raise HTTPException(status_code=400, detail="ID cannot be empty")
    
    try:
        return ObjectId(id_str)
    except Exception as e:
        logger.error(f"Invalid ObjectId format: {id_str}, error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid ID format: {id_str}")


async def _insert_one(db, collection: str, doc: Dict[str, Any]) -> ObjectId:
    col = db[collection]
    try:
        res = await col.insert_one(doc)  # Motor (async)
        return res.inserted_id
    except TypeError:
        res = await run_in_threadpool(col.insert_one, doc)  # PyMongo (sync)
        return res.inserted_id

async def _find_latest(db, collection: str, q: Dict[str, Any], limit: int) -> List[Dict[str, Any]]:
    col = db[collection]
    items: List[Dict[str, Any]] = []
    try:
        cursor = col.find(q).sort("timestamp", -1).limit(limit)  # Motor
        async for d in cursor:
            d["id"] = str(d.pop("_id"))
            items.append(d)
        return items
    except TypeError:
        def _fetch():
            return list(col.find(q).sort("timestamp", -1).limit(limit))
        docs = await run_in_threadpool(_fetch)
        for d in docs:
            d["id"] = str(d.pop("_id"))
            items.append(d)
        return items

async def _find_one(db, collection: str, q: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    col = db[collection]
    try:
        d = await col.find_one(q)  # Motor
    except TypeError:
        d = await run_in_threadpool(col.find_one, q)  # PyMongo
    if not d:
        return None
    d["id"] = str(d.pop("_id"))
    return d

async def _update_one(db, collection: str, q: Dict[str, Any], update: Dict[str, Any]) -> int:
    col = db[collection]
    try:
        res = await col.update_one(q, update)  # Motor
    except TypeError:
        res = await run_in_threadpool(col.update_one, q, update)  # PyMongo
    return getattr(res, "modified_count", 0)

async def _delete_one(db, collection: str, q: Dict[str, Any]) -> int:
    col = db[collection]
    try:
        res = await col.delete_one(q)  # Motor
    except TypeError:
        res = await run_in_threadpool(col.delete_one, q)  # PyMongo
    return getattr(res, "deleted_count", 0)


# ====== ENDPOINTY ======
@router.post("", status_code=201)
async def create_data_point(raw: Dict[str, Any] = Body(...), db=Depends(get_database)):
    """
    POST /data-points
    Przyjmuje:
      - deviceId/device_id
      - tag/tagName/point
      - value (number/string/bool)
      - quality (opcjonalnie, domyślnie 192)
      - timestamp/time/ts (ISO8601 lub epoch s/ms; opcjonalnie)
      - meta/metadata/attrs (dict; opcjonalnie)
    """
    try:
        data = _normalize_payload(raw)
        payload = DataPointIn(**data)

        doc: Dict[str, Any] = payload.dict()
        if not doc.get("timestamp"):
            doc["timestamp"] = datetime.now(timezone.utc)

        inserted_id = await _insert_one(db, "data_points", doc)

        resp = {
            "id": str(inserted_id),
            "device_id": doc.get("device_id"),
            "tag": doc.get("tag"),
            "value": doc.get("value"),
            "quality": doc.get("quality"),
            "timestamp": doc.get("timestamp"),
            "meta": doc.get("meta", {}),
        }
        return _encode_any(resp)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Bad request: {e}")

@router.get("", response_model=List[Dict[str, Any]])
async def list_data_points(
    limit: int = Query(100, ge=1, le=1000),
    device_id: Optional[str] = None,
    tag: Optional[str] = None,
    db=Depends(get_database),
):
    """GET /data-points — lista najnowszych punktów (opcjonalne filtry)."""
    q: Dict[str, Any] = {}
    if device_id:
        q["device_id"] = device_id
    if tag:
        q["tag"] = tag
    items = await _find_latest(db, "data_points", q, limit)
    return _encode_any(items)

@router.get("/{id}")
async def get_data_point(
    id: str = Path(..., description="Mongo ObjectId"),
    db=Depends(get_database),
):
    """GET /data-points/{id} — pobierz jeden punkt."""
    doc = await _find_one(db, "data_points", {"_id": _oid(id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return _encode_any(doc)

@router.patch("/{id}")
async def patch_data_point(
    id: str,
    raw_update: Dict[str, Any] = Body(...),
    db=Depends(get_database),
):
    """
    PATCH /data-points/{id} — częściowa aktualizacja.
    Akceptuje camelCase i epoch/ISO dla timestamp (tak jak POST).
    """
    try:
        # znormalizuj i zweryfikuj tylko podane pola
        data = _normalize_payload(raw_update)
        # przepuść przez model update (opcjonalne pola)
        upd = DataPointUpdate(**{
            k: v for k, v in data.items()
            if k in DataPointUpdate.model_fields  # Pydantic v2; w v1 zadziała też, ale można pominąć
        })

        change: Dict[str, Any] = {}
        for k, v in upd.dict(exclude_unset=True).items():
            change[k] = v

        if not change:
            raise HTTPException(status_code=400, detail="Empty update")

        # wykonaj update
        modified = await _update_one(
            db, "data_points",
            {"_id": _oid(id)},
            {"$set": change},
        )
        if modified == 0:
            # albo brak zmian, albo brak dokumentu
            # sprawdź, czy istnieje:
            exists = await _find_one(db, "data_points", {"_id": _oid(id)})
            if not exists:
                raise HTTPException(status_code=404, detail="Not found")

        # zwróć aktualny dokument
        doc = await _find_one(db, "data_points", {"_id": _oid(id)})
        return _encode_any(doc)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Bad request: {e}")

@router.delete("/{id}", status_code=204)
async def delete_data_point(
    id: str,
    db=Depends(get_database),
):
    """DELETE /data-points/{id} — usuń punkt."""
    deleted = await _delete_one(db, "data_points", {"_id": _oid(id)})
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return  # 204 No Content
