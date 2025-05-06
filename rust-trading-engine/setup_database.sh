#!/bin/bash

# Configuration
DB_NAME="trading_db"
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_HOST="localhost"
DB_PORT="5432"

echo "Setting up trading_db database..."

# Check if PostgreSQL is running
if ! command -v psql &> /dev/null; then
    echo "PostgreSQL client not found. Please install PostgreSQL."
    exit 1
fi

# Create database if it doesn't exist
if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    echo "Database $DB_NAME already exists."
else
    echo "Creating database $DB_NAME..."
    createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME
    if [ $? -ne 0 ]; then
        echo "Failed to create database. Please check your PostgreSQL installation and permissions."
        exit 1
    fi
    echo "Database created successfully."
fi

# Run the setup script
echo "Setting up database tables..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f setup_db.sql

if [ $? -eq 0 ]; then
    echo "Database setup completed successfully."
    
    # Create .env file for the application
    echo "Creating .env file..."
    cat > .env << EOF
# Server configuration
PORT=8080
HOST=0.0.0.0

# Database connection
DATABASE_URL=postgres://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME

# Logging
RUST_LOG=info
EOF
    
    echo ".env file created."
    echo "You can now run the trading engine with: cargo run --bin trading-server --release"
else
    echo "Database setup failed."
    exit 1
fi 