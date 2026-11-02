FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

# Must match "packageManager" in package.json (CI reads the version from there).
ARG BUN_VERSION=1.3.14

RUN apt-get update \
  && apt-get install -y --no-install-recommends unzip \
  && rm -rf /var/lib/apt/lists/*

USER vscode
RUN curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}"
ENV BUN_INSTALL=/home/vscode/.bun
ENV PATH=/home/vscode/.bun/bin:${PATH}
