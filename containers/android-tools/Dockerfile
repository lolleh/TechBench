FROM alpine:3.20

LABEL maintainer="HybridBench OS"
LABEL description="Android device servicing tools"

# Install Android platform tools and dependencies
RUN apk add --no-cache \
    android-tools \
    libusb-compat \
    usbutils \
    python3 \
    py3-pip \
    py3-usb \
    wget \
    curl \
    bash

# Create workspace
RUN mkdir -p /workspace /logs /opt/tools

# Copy enhanced tools
COPY enhanced-adb/ /opt/tools/adb-enhanced/
COPY enhanced-fastboot/ /opt/tools/fastboot-enhanced/
COPY device-db/ /opt/tools/device-db/
COPY entrypoint.sh /opt/entrypoint.sh
RUN chmod +x /opt/entrypoint.sh

VOLUME ["/workspace", "/logs"]

ENTRYPOINT ["/opt/entrypoint.sh"]
