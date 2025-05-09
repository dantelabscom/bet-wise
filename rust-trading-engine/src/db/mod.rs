pub mod connection;
pub mod repository;

pub use connection::{create_pg_pool, Repository};
pub use repository::SqlxRepository;

pub type PgPool = sqlx::postgres::PgPool; 