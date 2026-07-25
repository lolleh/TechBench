FROM alpine:3.20

LABEL maintainer="HybridBench OS"
LABEL description="Qualcomm Emergency Download (EDL) tools"

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

# Clone Qualcomm EDL tools
RUN git clone --depth 1 https://github.com/bkerler/edl.git /opt/tools/edl 2>/dev/null || \
    mkdir -p /opt/tools/edl

# Create firehose loaders directory
RUN mkdir -p /opt/tools/firehose-loaders

# Create workspace
RUN mkdir -p /workspace /logs /opt/tools /firmware

# Copy custom tools and configs
COPY configs/ /opt/tools/configs/
COPY entrypoint.sh /opt/entrypoint.sh
RUN chmod +x /opt/entrypoint.sh

VOLUME ["/workspace", "/logs", "/firmware"]

ENTRYPOINT ["/opt/entrypoint.sh"]
