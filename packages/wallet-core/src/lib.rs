//! One-time refund addresses for swaps out of a Zcash wallet.
//!
//! A swap provider (NEAR Intents 1Click) is told a `refundTo` address. If every swap names the same
//! wallet address, anyone reading those public `refundTo` fields can link all of a user's swaps (and
//! a future quantum adversary gains more from each link). Here swap `i` gets a **one-time key**
//! derived with `zakura-one-time-ivk`: it keeps the account's spending authority (`ak`, `nk`) and
//! gets its own `rivk`, so it has its own incoming viewing key and address. Two refund addresses
//! cannot be linked to each other or to the account address from the addresses alone.
//!
//! `zakura-one-time-ivk` is a draft convention ("must not be used to issue live addresses before
//! review"). This crate uses it on Zcash testnet only, and for mainnet `refundTo` in *dry* quotes,
//! which create no deposit address and move no funds.

use orchard::keys::{FullViewingKey, Scope, SpendingKey};
use sha2::{Digest, Sha256};
use zakura_one_time_ivk::{swap::RefundMemo, KeyId, Purpose};
use zcash_address::unified::{self, Encoding};
use zcash_protocol::consensus::NetworkType;

/// ZIP 32 coin types.
pub const COIN_TESTNET: u32 = 1;
pub const COIN_MAINNET: u32 = 133;

#[derive(Debug)]
pub enum Error {
    Seed(String),
    Derivation(u64),
    Encoding(String),
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Error::Seed(e) => write!(f, "bad seed: {e}"),
            Error::Derivation(i) => write!(f, "index {i} has no valid one-time key (negligible probability; use the next index)"),
            Error::Encoding(e) => write!(f, "encoding failed: {e}"),
        }
    }
}
impl std::error::Error for Error {}

/// The wallet's ZIP 32 account 0 for one network (coin type decides testnet vs mainnet keys).
pub fn account(seed: &[u8], coin_type: u32) -> Result<FullViewingKey, Error> {
    if seed.len() < 32 {
        return Err(Error::Seed("at least 32 bytes".into()));
    }
    let sk = SpendingKey::from_zip32_seed(seed, coin_type, zip32::AccountId::ZERO).map_err(|e| Error::Seed(format!("{e:?}")))?;
    Ok(FullViewingKey::from(&sk))
}

/// One-time key `index` for `purpose` (refund or receive).
pub fn one_time(account: &FullViewingKey, purpose: Purpose, index: u64) -> Result<FullViewingKey, Error> {
    KeyId::new(purpose, index).derive(account).map_err(|_| Error::Derivation(index))
}

pub fn network(coin_type: u32) -> NetworkType {
    if coin_type == COIN_MAINNET {
        NetworkType::Main
    } else {
        NetworkType::Test
    }
}

/// Unified address with only an Orchard-family receiver (receives in Ironwood on current testnet).
pub fn address(fvk: &FullViewingKey, net: NetworkType) -> Result<String, Error> {
    let raw = fvk.address_at(0u32, Scope::External).to_raw_address_bytes();
    let ua = unified::Address::try_from_items(vec![unified::Receiver::Orchard(raw)]).map_err(|e| Error::Encoding(e.to_string()))?;
    Ok(ua.encode(&net))
}

/// Unified incoming viewing key with only the Orchard-family item: sees payments to `address`.
pub fn uivk(fvk: &FullViewingKey, net: NetworkType) -> Result<String, Error> {
    let ivk = fvk.to_ivk(Scope::External).to_bytes();
    let u = unified::Uivk::try_from_items(vec![unified::Ivk::Orchard(ivk)]).map_err(|e| Error::Encoding(e.to_string()))?;
    Ok(u.encode(&net))
}

/// sha256 of the raw full viewing key: an identifier for tests and logs (not a secret, not a key).
pub fn fvk_id(fvk: &FullViewingKey) -> String {
    hex::encode(Sha256::digest(fvk.to_bytes()))
}

/// The spending authority (`ak ‖ nk`, the first 64 bytes of the raw FVK).
pub fn authority(fvk: &FullViewingKey) -> [u8; 64] {
    fvk.to_bytes()[..64].try_into().expect("64 bytes")
}

/// The refund memo a wallet could put in its own internal note of the funding transaction, so a
/// restored wallet knows which refund index to watch. Encoder only: nothing in this project writes it
/// on chain; recovery uses a gap-limit lookahead instead.
pub fn refund_memo(index: u64) -> [u8; 512] {
    RefundMemo::new(index).encode()
}

pub fn decode_refund_memo(bytes: &[u8; 512]) -> Option<u64> {
    RefundMemo::decode(bytes).map(|r| r.index())
}

pub use zakura_one_time_ivk::Purpose as KeyPurpose;

pub mod near;
pub use near::{near_credentials_json, near_path, near_recipient};
