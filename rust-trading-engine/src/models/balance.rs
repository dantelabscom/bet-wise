use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Represents a user's balance in the system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserBalance {
    /// User ID
    pub user_id: Uuid,
    
    /// Available balance for trading
    pub available_balance: Decimal,
    
    /// Balance that is reserved for open orders
    pub reserved_balance: Decimal,
    
    /// When the balance was last updated
    pub updated_at: DateTime<Utc>,
}

/// Transaction type for balance ledger
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TransactionType {
    /// Deposit funds into account
    Deposit,
    
    /// Withdraw funds from account
    Withdraw,
    
    /// Reserve funds for an order
    OrderReserve,
    
    /// Release reserved funds back to available balance
    OrderRelease,
    
    /// Settlement payout for market resolution
    SettlementPayout,
}

impl From<i32> for TransactionType {
    fn from(value: i32) -> Self {
        match value {
            0 => TransactionType::Deposit,
            1 => TransactionType::Withdraw,
            2 => TransactionType::OrderReserve,
            3 => TransactionType::OrderRelease,
            4 => TransactionType::SettlementPayout,
            _ => panic!("Invalid TransactionType value: {}", value),
        }
    }
}

impl From<TransactionType> for i32 {
    fn from(value: TransactionType) -> Self {
        match value {
            TransactionType::Deposit => 0,
            TransactionType::Withdraw => 1,
            TransactionType::OrderReserve => 2,
            TransactionType::OrderRelease => 3,
            TransactionType::SettlementPayout => 4,
        }
    }
}

/// Represents a transaction in a user's balance ledger
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BalanceTransaction {
    /// Unique ID for the transaction
    pub transaction_id: Uuid,
    
    /// User ID
    pub user_id: Uuid,
    
    /// Amount of the transaction
    pub amount: Decimal,
    
    /// Type of transaction
    pub transaction_type: TransactionType,
    
    /// Reference to related entity (order_id, market_id, etc.)
    pub reference_id: Option<String>,
    
    /// Description of the transaction
    pub description: String,
    
    /// When the transaction occurred
    pub created_at: DateTime<Utc>,
}

impl UserBalance {
    /// Creates a new user balance with initial amount
    pub fn new(user_id: Uuid, initial_balance: Decimal) -> Self {
        Self {
            user_id,
            available_balance: initial_balance,
            reserved_balance: Decimal::ZERO,
            updated_at: Utc::now(),
        }
    }
    
    /// Gets the total balance (available + reserved)
    pub fn total_balance(&self) -> Decimal {
        self.available_balance + self.reserved_balance
    }
    
    /// Checks if user has enough available funds
    pub fn has_sufficient_funds(&self, amount: Decimal) -> bool {
        self.available_balance >= amount
    }
    
    /// Reserves funds for an order
    pub fn reserve_funds(&mut self, amount: Decimal) -> Result<(), String> {
        if !self.has_sufficient_funds(amount) {
            return Err(format!("Insufficient funds: available {}, required {}", self.available_balance, amount));
        }
        
        self.available_balance -= amount;
        self.reserved_balance += amount;
        self.updated_at = Utc::now();
        
        Ok(())
    }
    
    /// Releases reserved funds back to available balance
    pub fn release_funds(&mut self, amount: Decimal) -> Result<(), String> {
        if self.reserved_balance < amount {
            return Err(format!("Cannot release more than reserved: reserved {}, release amount {}", self.reserved_balance, amount));
        }
        
        self.reserved_balance -= amount;
        self.available_balance += amount;
        self.updated_at = Utc::now();
        
        Ok(())
    }
    
    /// Adds funds to the available balance
    pub fn add_funds(&mut self, amount: Decimal) {
        self.available_balance += amount;
        self.updated_at = Utc::now();
    }
    
    /// Withdraws funds from available balance
    pub fn withdraw_funds(&mut self, amount: Decimal) -> Result<(), String> {
        if !self.has_sufficient_funds(amount) {
            return Err(format!("Insufficient funds: available {}, withdraw amount {}", self.available_balance, amount));
        }
        
        self.available_balance -= amount;
        self.updated_at = Utc::now();
        
        Ok(())
    }
}

impl BalanceTransaction {
    /// Creates a new balance transaction
    pub fn new(
        user_id: Uuid, 
        amount: Decimal, 
        transaction_type: TransactionType,
        reference_id: Option<String>,
        description: String
    ) -> Self {
        Self {
            transaction_id: Uuid::new_v4(),
            user_id,
            amount,
            transaction_type,
            reference_id,
            description,
            created_at: Utc::now(),
        }
    }
} 