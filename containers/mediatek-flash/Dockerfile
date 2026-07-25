FROM alpine:3.20

LABEL maintainer="HybridBench OS"
LABEL description="MediaTek SP Flash Tool and preloader communication"

# Install dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    py3-usb \
    py3-serial \
    py3-yaml \
    libusb-compat \
    usbutils \
    git \
    wget \
    bash

# Clone MediaTek tools
RUN git clone --depth 1 https://github.com/bkerler/mtkclient.git /opt/tools/mtkclient 2>/dev/null || \
    mkdir -p /opt/tools/mtkclient

# Create workspace
RUN mkdir -p /workspace /logs /opt/tools /firmware

# Copy custom tools and configs
COPY configs/ /opt/tools/configs/
COPY entrypoint.sh /opt/entrypoint.sh
RUN chmod +x /opt/entrypoint.sh

VOLUME ["/workspace", "/logs", "/firmware"]

ENTRYPOINT ["/opt/entrypoint.sh"]
