# Use Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies for industrial protocols
RUN apt-get update && apt-get install -y \
    # Build essentials
    gcc \
    g++ \
    make \
    build-essential \
    # Network tools
    curl \
    wget \
    ca-certificates \
    net-tools \
    iputils-ping \
    iproute2 \
    # SSL/TLS support
    libssl-dev \
    libffi-dev \
    # XML processing
    libxml2-dev \
    libxslt-dev \
    # Compression
    zlib1g-dev \
    # Event handling
    libevent-dev \
    # Package config
    pkg-config \
    # USB support for CANopen interfaces
    libusb-1.0-0-dev \
    # CAN support
    can-utils \
    # Network packet capture (for some protocols)
    libpcap-dev \
    # Additional system libraries
    libc6-dev \
    libgcc-s1 \
    # Clean up to reduce image size
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean \
    && apt-get autoremove -y

# Create application user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Copy requirements first for better Docker layer caching
COPY requirements.txt .

# Install Python dependencies with increased timeout and verbose output
RUN pip install --no-cache-dir \
    --timeout 300 \
    --retries 3 \
    --upgrade pip setuptools wheel \
    && pip install --no-cache-dir \
    --timeout 300 \
    --retries 3 \
    -r requirements.txt

# Copy application code
COPY . .

# Create necessary directories with proper permissions
RUN mkdir -p logs data certificates uploads temp \
    && chown -R appuser:appuser /app \
    && chmod -R 755 /app

# Set environment variables
ENV PYTHONPATH="/app"
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONHASHSEED=random
ENV PIP_NO_CACHE_DIR=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

# Security: Don't run as root
USER appuser

# Expose ports
EXPOSE 3001 3002

# Add health check with proper timeout and startup period
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Simple entrypoint without problematic sed/waiting logic
COPY --chown=appuser:appuser <<EOF /app/entrypoint.sh
#!/bin/bash
set -e

echo "🚀 Starting Industrial Protocols Management API..."
echo "📡 Environment: \${ENVIRONMENT:-development}"
echo "🌐 Host: \${HOST:-0.0.0.0}:\${PORT:-3001}"

# Start the application directly - FastAPI has built-in retry logic
echo "🎯 Starting FastAPI application..."
exec python main.py
EOF

RUN chmod +x /app/entrypoint.sh

# Use the entrypoint script
ENTRYPOINT ["/app/entrypoint.sh"]
