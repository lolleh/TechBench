FROM alpine:3.20

LABEL maintainer="HybridBench OS"
LABEL description="Samsung Odin protocol and Heimdall flashing tools"

# Install dependencies
RUN apk add --no-cache \
    cmake \
    make \
    gcc \
    g++ \
    libusb-dev \
    libconfig-dev \
    python3 \
    py3-pip \
    py3-usb \
    usbutils \
    git \
    wget \
    bash

# Build Heimdall from source
RUN git clone --depth 1 https://github.com/Benjamin-Dobell/Heimdall.git /tmp/heimdall 2>/dev/null && \
    cd /tmp/heimdall && \
    mkdir build && cd build && \
    cmake .. -DCMAKE_BUILD_TYPE=Release 2>/dev/null && \
    make -j$(nproc) 2>/dev/null && \
    make install 2>/dev/null && \
    rm -rf /tmp/heimdall || \
    echo "Heimdall build skipped (build dependencies)"

# Install Python Odin tools
RUN pip3 install pyusb pyserial 2>/dev/null || true

# Create workspace
RUN mkdir -p /workspace /logs /opt/tools /firmware

# Copy custom tools and configs
COPY configs/ /opt/tools/configs/
COPY entrypoint.sh /opt/entrypoint.sh
RUN chmod +x /opt/entrypoint.sh

VOLUME ["/workspace", "/logs", "/firmware"]

ENTRYPOINT ["/opt/entrypoint.sh"]
