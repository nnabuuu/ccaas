# Linux V1 validation runner for the vfs-poc agentfs FUSE path.
# Built once, used to launch the entrypoint.sh under three different
# (agentfs build × bare-mode) configurations.
#
# Image is intentionally fat (full toolchain + sources mounted at run time)
# because the goal is reproducible validation, not minimal deploy size.

FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    PATH="/root/.cargo/bin:/usr/local/bin:${PATH}" \
    RUSTUP_HOME=/root/.rustup \
    CARGO_HOME=/root/.cargo

# Base toolchain + agentfs build deps (liblzma per agentfs build.rs).
# fuse3 is the runtime FUSE library; libfuse3-dev gives the headers if any
# downstream wants to extend agentfs.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        build-essential \
        pkg-config \
        libssl-dev \
        liblzma-dev \
        libunwind-dev \
        fuse3 \
        libfuse3-dev \
        sqlite3 \
        sudo \
    && rm -rf /var/lib/apt/lists/*

# Rust nightly (agentfs's rust-toolchain.toml pins nightly).
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
      | sh -s -- -y --default-toolchain nightly --profile minimal \
    && rustc --version

# Node 20 (matches host dev env; vfs-poc package.json doesn't require newer).
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && node --version && npm --version

# fuse: allow_other so the binary launched as root can mount and the test
# (also root inside container) can read/write.
RUN sed -i 's/#user_allow_other/user_allow_other/' /etc/fuse.conf || true

WORKDIR /work
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
