from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List
from datetime import datetime

from models.certificate import Certificate, CertificateType, CertificateStatus
import hashlib
import logging
from cryptography import x509
from cryptography.hazmat.backends import default_backend

logger = logging.getLogger(__name__)

class CertificateValidator:
    @staticmethod
    def validate_certificate_format(certificate_content: str) -> bool:
        """Validate certificate format"""
        try:
            if certificate_content.startswith('-----BEGIN CERTIFICATE-----'):
                cert_bytes = certificate_content.encode('utf-8')
                x509.load_pem_x509_certificate(cert_bytes, default_backend())
                return True
        except Exception:
            pass
        return False
    
    @staticmethod
    def extract_certificate_info(certificate_content: str) -> dict:
        """Extract certificate information"""
        try:
            cert_bytes = certificate_content.encode('utf-8')
            cert = x509.load_pem_x509_certificate(cert_bytes, default_backend())
            
            fingerprint = hashlib.sha1(cert.public_bytes(x509.Encoding.DER)).hexdigest()
            
            return {
                "subject": cert.subject.rfc4514_string(),
                "issuer": cert.issuer.rfc4514_string(),
                "valid_from": cert.not_valid_before,
                "valid_to": cert.not_valid_after,
                "fingerprint": f"SHA1:{fingerprint.upper()}"
            }
        except Exception as e:
            raise ValueError(f"Failed to parse certificate: {str(e)}")



router = APIRouter()

@router.get("/security/certificates", response_model=List[dict])
async def get_certificates():
    """Get list of all certificates"""
    try:
        certificates = await Certificate.find_all().to_list()
        
        certificate_list = []
        for cert in certificates:
            cert_dict = cert.dict()
            cert_dict["id"] = str(cert.id)
            # Don't include certificate_data in list view for security
            cert_dict.pop("certificate_data", None)
            certificate_list.append(cert_dict)
        
        return certificate_list
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/security/certificates/{certificate_id}")
async def get_certificate(certificate_id: str):
    """Get certificate by ID"""
    try:
        certificate = await Certificate.get(certificate_id)
        if not certificate:
            raise HTTPException(status_code=404, detail="Certificate not found")
        
        result = certificate.dict()
        result["id"] = str(certificate.id)
        # Don't include certificate_data for security unless specifically needed
        result.pop("certificate_data", None)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/security/certificates")
async def upload_certificate(
    name: str,
    certificate_type: CertificateType,
    file: UploadFile = File(...)
):
    """Upload a new certificate with proper validation"""
    try:
        # Read certificate data
        certificate_data = await file.read()
        certificate_content = certificate_data.decode('utf-8')
        
        # Validate certificate format
        if not CertificateValidator.validate_certificate_format(certificate_content):
            raise HTTPException(status_code=400, detail="Invalid certificate format")
        
        # Extract certificate info
        try:
            cert_info = CertificateValidator.extract_certificate_info(certificate_content)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        # Check if certificate already exists
        existing = await Certificate.find_one(
            Certificate.fingerprint == cert_info["fingerprint"]
        )
        if existing:
            raise HTTPException(status_code=409, detail="Certificate already exists")
        
        # Create certificate record
        certificate = Certificate(
            name=name,
            type=certificate_type,
            status=CertificateStatus.VALID,
            subject=cert_info["subject"],
            issuer=cert_info["issuer"],
            valid_from=cert_info["valid_from"],
            valid_to=cert_info["valid_to"],
            fingerprint=cert_info["fingerprint"],
            certificate_data=certificate_content,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        await certificate.insert()
        
        result = certificate.dict()
        result["id"] = str(certificate.id)
        result.pop("certificate_data", None)  # Don't return certificate data
        
        return {"success": True, "data": result}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Certificate upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Certificate upload failed: {str(e)}")


@router.put("/security/certificates/{certificate_id}")
async def update_certificate(certificate_id: str, update_data: dict):
    """Update certificate metadata"""
    try:
        certificate = await Certificate.get(certificate_id)
        if not certificate:
            raise HTTPException(status_code=404, detail="Certificate not found")
        
        # Update allowed fields
        if "name" in update_data:
            certificate.name = update_data["name"]
        if "status" in update_data:
            certificate.status = update_data["status"]
        
        await certificate.save()
        
        result = certificate.dict()
        result["id"] = str(certificate.id)
        result.pop("certificate_data", None)
        
        return {"success": True, "data": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/security/certificates/{certificate_id}")
async def delete_certificate(certificate_id: str):
    """Delete certificate"""
    try:
        certificate = await Certificate.get(certificate_id)
        if not certificate:
            raise HTTPException(status_code=404, detail="Certificate not found")
        
        await certificate.delete()
        
        return {"success": True, "message": "Certificate deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/security/certificates/{certificate_id}/download")
async def download_certificate(certificate_id: str):
    """Download certificate file"""
    try:
        certificate = await Certificate.get(certificate_id)
        if not certificate:
            raise HTTPException(status_code=404, detail="Certificate not found")
        
        if not certificate.certificate_data:
            raise HTTPException(status_code=404, detail="Certificate data not available")
        
        return {
            "filename": f"{certificate.name}.pem",
            "content": certificate.certificate_data,
            "content_type": "application/x-pem-file"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))