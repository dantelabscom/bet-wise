#!/bin/bash

echo "Fixing Rust trading engine code..."

# Fix 1: Add missing Expired case to OrderStatus Display implementation
sed -i '' 's/OrderStatus::Cancelled => write!(f, "cancelled"),/OrderStatus::Cancelled => write!(f, "cancelled"),\n            OrderStatus::Expired => write!(f, "expired"),/' src/models/order.rs

# Fix 2: Replace all occurrences of &mut tx with tx.as_mut() in main.rs
sed -i '' 's/\.execute(&mut tx)/\.execute(tx.as_mut())/g' src/main.rs
sed -i '' 's/\.fetch_optional(&mut tx)/\.fetch_optional(tx.as_mut())/g' src/main.rs
sed -i '' 's/\.fetch_one(&mut tx)/\.fetch_one(tx.as_mut())/g' src/main.rs
sed -i '' 's/\.fetch_all(&mut tx)/\.fetch_all(tx.as_mut())/g' src/main.rs

# Fix 3: Fix the non-primitive casts for order_count
sed -i '' 's/order_count: row\.order_count as i32/order_count: row.order_count.unwrap_or(0) as i32/g' src/main.rs

# Fix 4: Add metadata and weight fields to MarketOption in query_as! calls
sed -i '' 's/MarketOption,/MarketOption { metadata: None, weight: Decimal::new(1, 0) },/g' src/main.rs

echo "Fixes applied. Now try to compile the code with: cargo build --release" 