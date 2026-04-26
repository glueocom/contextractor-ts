FROM apify/actor-node-playwright-chrome:22

USER root
WORKDIR /usr/src/app

# Install Rust toolchain (build-only).
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates build-essential pkg-config \
    && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable --profile minimal

ENV PATH="/root/.cargo/bin:${PATH}"

# Copy vendored sources.
COPY vendor/ ./vendor/

# Install the napi-rs CLI inside the vendored native crate (its own
# package.json declares @napi-rs/cli as a devDep).
RUN cd vendor/engine-native \
    && npm install --no-package-lock --include=dev \
    && ./node_modules/.bin/napi build --platform --release --no-const-enum

# Copy the rest of the actor.
COPY package.json ./
COPY tsconfig.json ./
COPY src/ ./src/
COPY .actor/ ./.actor/

# Install actor + engine deps (uses file: paths to vendor/engine and
# vendor/engine-native).
RUN npm install --no-package-lock --include=dev \
    && cd vendor/engine && npm install --no-package-lock --include=dev && ./node_modules/.bin/tsc -p tsconfig.json

# Build the actor.
RUN ./node_modules/.bin/tsc -p tsconfig.json

# Tear down the build toolchain.
RUN rustup self uninstall -y \
    && apt-get purge -y curl build-essential pkg-config \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/* /usr/src/app/vendor/engine-native/target

RUN chown -R myuser:myuser /usr/src/app
USER myuser
CMD ["node", "dist/main.js"]
