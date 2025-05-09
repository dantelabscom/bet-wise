use std::sync::Arc;
use log::{debug, info};
use rust_decimal::Decimal;
use uuid::Uuid;
use anyhow::{Result, anyhow};

use crate::models::balance::{UserBalance, BalanceTransaction, TransactionType};
use crate::db::connection::Repository;

/// Service for managing user balances
pub struct BalanceService<R: Repository> {
    /// Repository for database operations
    repository: Arc<R>,
}

impl<R: Repository> BalanceService<R> {
    /// Creates a new balance service
    pub fn new(repository: Arc<R>) -> Self {
        Self { repository }
    }
    
    /// Gets a user's balance
    pub async fn get_user_balance(&self, user_id: Uuid) -> Result<UserBalance> {
        // Try to get the balance from the database
        match self.repository.get_user_balance(user_id).await {
            Ok(balance) => Ok(balance),
            Err(_) => {
                // If not found, create a new balance with zero
                let balance = UserBalance::new(user_id, Decimal::ZERO);
                self.repository.save_user_balance(&balance).await?;
                Ok(balance)
            }
        }
    }
    
    /// Adds funds to a user's balance (deposit)
    pub async fn add_funds(&self, user_id: Uuid, amount: Decimal) -> Result<UserBalance> {
        if amount <= Decimal::ZERO {
            return Err(anyhow!("Amount must be positive"));
        }
        
        // Get the user's current balance
        let mut balance = self.get_user_balance(user_id).await?;
        
        // Add the funds
        balance.add_funds(amount);
        
        // Save the updated balance
        self.repository.save_user_balance(&balance).await?;
        
        // Record the transaction
        let transaction = BalanceTransaction::new(
            user_id, 
            amount,
            TransactionType::Deposit, 
            None,
            "Deposit".to_string(),
        );
        
        self.repository.save_balance_transaction(&transaction).await?;
        
        info!("Added {} to user {}'s balance", amount, user_id);
        Ok(balance)
    }
    
    /// Withdraws funds from a user's balance
    pub async fn withdraw_funds(&self, user_id: Uuid, amount: Decimal) -> Result<UserBalance> {
        if amount <= Decimal::ZERO {
            return Err(anyhow!("Amount must be positive"));
        }
        
        // Get the user's current balance
        let mut balance = self.get_user_balance(user_id).await?;
        
        // Try to withdraw the funds
        if let Err(e) = balance.withdraw_funds(amount) {
            return Err(anyhow!(e));
        }
        
        // Save the updated balance
        self.repository.save_user_balance(&balance).await?;
        
        // Record the transaction
        let transaction = BalanceTransaction::new(
            user_id, 
            amount,
            TransactionType::Withdraw, 
            None,
            "Withdrawal".to_string(),
        );
        
        self.repository.save_balance_transaction(&transaction).await?;
        
        info!("Withdrew {} from user {}'s balance", amount, user_id);
        Ok(balance)
    }
    
    /// Reserves funds for an order
    pub async fn reserve_funds(&self, user_id: Uuid, amount: Decimal, order_id: Uuid) -> Result<UserBalance> {
        if amount <= Decimal::ZERO {
            return Err(anyhow!("Amount must be positive"));
        }
        
        // Get the user's current balance
        let mut balance = self.get_user_balance(user_id).await?;
        
        // Try to reserve the funds
        if let Err(e) = balance.reserve_funds(amount) {
            return Err(anyhow!(e));
        }
        
        // Save the updated balance
        self.repository.save_user_balance(&balance).await?;
        
        // Record the transaction
        let transaction = BalanceTransaction::new(
            user_id, 
            amount,
            TransactionType::OrderReserve, 
            Some(order_id.to_string()),
            format!("Reserved for order {}", order_id),
        );
        
        self.repository.save_balance_transaction(&transaction).await?;
        
        debug!("Reserved {} for order {} from user {}'s balance", amount, order_id, user_id);
        Ok(balance)
    }
    
    /// Releases reserved funds back to available (e.g., for cancelled orders)
    pub async fn release_funds(&self, user_id: Uuid, amount: Decimal, order_id: Uuid) -> Result<UserBalance> {
        if amount <= Decimal::ZERO {
            return Err(anyhow!("Amount must be positive"));
        }
        
        // Get the user's current balance
        let mut balance = self.get_user_balance(user_id).await?;
        
        // Try to release the funds
        if let Err(e) = balance.release_funds(amount) {
            return Err(anyhow!(e));
        }
        
        // Save the updated balance
        self.repository.save_user_balance(&balance).await?;
        
        // Record the transaction
        let transaction = BalanceTransaction::new(
            user_id, 
            amount,
            TransactionType::OrderRelease, 
            Some(order_id.to_string()),
            format!("Released from order {}", order_id),
        );
        
        self.repository.save_balance_transaction(&transaction).await?;
        
        debug!("Released {} from order {} back to user {}'s balance", amount, order_id, user_id);
        Ok(balance)
    }
    
    /// Processes a settlement payout
    pub async fn process_payout(&self, user_id: Uuid, amount: Decimal, market_id: &str) -> Result<UserBalance> {
        // Get the user's current balance
        let mut balance = self.get_user_balance(user_id).await?;
        
        // Add the payout to available funds
        balance.add_funds(amount);
        
        // Save the updated balance
        self.repository.save_user_balance(&balance).await?;
        
        // Record the transaction
        let transaction = BalanceTransaction::new(
            user_id, 
            amount,
            TransactionType::SettlementPayout, 
            Some(market_id.to_string()),
            format!("Settlement payout from market {}", market_id),
        );
        
        self.repository.save_balance_transaction(&transaction).await?;
        
        info!("Processed payout of {} to user {} from market {}", amount, user_id, market_id);
        Ok(balance)
    }
    
    /// Gets transaction history for a user
    pub async fn get_transaction_history(&self, user_id: Uuid) -> Result<Vec<BalanceTransaction>> {
        self.repository.get_balance_transactions_for_user(user_id).await
            .map_err(|e| anyhow!("Failed to get transaction history: {}", e))
    }
} 