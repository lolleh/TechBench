FROM alpine:3.20

LABEL maintainer="HybridBench OS"
LABEL description="Apple iOS device servicing tools"

# Install libimobiledevice stack and dependencies
RUN apk add --no-cache \
    libimobiledevice-utils \
    usbmuxd \
    ifuse \
    ideviceinstaller \
    libplist-utils \
    python3 \
    py3-pip \
    wget \
    curl \
    bash

# Install pymobiledevice3 for advanced features
RUN pip3 install --break-system-packages pymobiledevice3 2>/dev/null || \
    pip3 install pymobiledevice3 2>/dev/null || true

# Create workspace
RUN mkdir -p /workspace /logs /opt/tools /firmware

# Copy custom tools
COPY tools/ /opt/tools/
COPY entrypoint.sh /opt/entrypoint.sh
RUN chmod +x /opt/entrypoint.sh

VOLUME ["/workspace", "/logs", "/firmware"]

ENTRYPOINT ["/opt/entrypoint.sh"]
