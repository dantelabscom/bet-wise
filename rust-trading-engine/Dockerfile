FROM rust:1.75 as builder

WORKDIR /app

# Copy over the Cargo manifests
COPY Cargo.toml Cargo.lock ./

# Copy the source code
COPY src/ ./src/

# Build the application
RUN cargo build --release

# Create a smaller runtime image
FROM debian:bookworm-slim

WORKDIR /app

# Install OpenSSL and CA certificates
RUN apt-get update && \
    apt-get install -y openssl ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy the binary from the builder stage
COPY --from=builder /app/target/release/trading-server .

# Create a non-root user to run the application
RUN useradd -m appuser
USER appuser

# Expose the port the app runs on
EXPOSE 8080

# Command to run the application
CMD ["./trading-server"] 