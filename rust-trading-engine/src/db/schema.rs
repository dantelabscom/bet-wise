// @generated automatically by Diesel CLI tool - to update run "diesel migration run"

diesel::table! {
    use diesel::sql_types::*;
    use diesel::pg::sql_types::*;
    use crate::models::order::{OrderSideMapping, OutcomeSideMapping, OrderStatusMapping};
    use crate::models::market::MarketStatusMapping;

    balance_transactions (id) {
        id -> Text,
        user_id -> Text,
        amount -> Numeric,
        transaction_type -> Integer,
        reference_id -> Nullable<Text>,
        description -> Text,
        created_at -> Timestamptz,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use diesel::pg::sql_types::*;
    use crate::models::order::{OrderSideMapping, OutcomeSideMapping, OrderStatusMapping};
    use crate::models::market::MarketStatusMapping;

    markets (id) {
        id -> Text,
        question -> Text,
        description -> Text,
        status -> Integer,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
        close_time -> Nullable<Timestamptz>,
        resolved_at -> Nullable<Timestamptz>,
        resolution -> Nullable<Integer>,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use diesel::pg::sql_types::*;
    use crate::models::order::{OrderSideMapping, OutcomeSideMapping, OrderStatusMapping};
    use crate::models::market::MarketStatusMapping;

    orders (id) {
        id -> Text,
        user_id -> Text,
        market_id -> Text,
        side -> Integer,
        outcome -> Integer,
        price -> Numeric,
        quantity -> Integer,
        remaining_quantity -> Integer,
        status -> Integer,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use diesel::pg::sql_types::*;
    use crate::models::order::{OrderSideMapping, OutcomeSideMapping, OrderStatusMapping};
    use crate::models::market::MarketStatusMapping;

    trades (id) {
        id -> Text,
        market_id -> Text,
        buy_order_id -> Text,
        buyer_id -> Text,
        sell_order_id -> Text,
        seller_id -> Text,
        outcome -> Integer,
        price -> Numeric,
        quantity -> Integer,
        executed_at -> Timestamptz,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use diesel::pg::sql_types::*;
    use crate::models::order::{OrderSideMapping, OutcomeSideMapping, OrderStatusMapping};
    use crate::models::market::MarketStatusMapping;

    user_balances (user_id) {
        user_id -> Text,
        available_balance -> Numeric,
        reserved_balance -> Numeric,
        updated_at -> Timestamptz,
    }
}

diesel::joinable!(balance_transactions -> user_balances (user_id));
diesel::joinable!(orders -> markets (market_id));
diesel::joinable!(trades -> markets (market_id));

diesel::allow_tables_to_appear_in_same_query!(
    markets,
    orders,
    trades,
    user_balances,
    balance_transactions,
); 