//! A fresh NEAR implicit account per swap, from the same wallet seed.
//!
//! A swap's destination `recipient` is sent in clear with every 1Click quote, so a wallet that names
//! one NEAR account for all its swaps links them however unlinkable its refund addresses are. Here
//! swap `i` also gets its own NEAR **implicit account**: an ed25519 key derived from the wallet seed
//! with SLIP-0010 at `m/44'/397'/1'/i'` (coin type 397 is NEAR; BIP 44 account `1'` is set aside for
//! swap recipients, so account `0'` stays free for an ordinary NEAR account on the same seed). The
//! account id is the hex of the public key, so it exists as an address before anything is sent to
//! it, and the seed alone re-derives every one of them.
//!
//! The private key never leaves this module except as a near-cli credentials file the owner asks for
//! (`zswap-keys near-key`), written 0600 and never printed.

use ed25519_dalek::SigningKey;
use hmac::{Hmac, Mac};
use sha2::Sha512;

const HARDENED: u32 = 0x8000_0000;
/// `m/44'/397'/1'`: BIP 44, NEAR, the account set aside for per-swap recipients.
pub const NEAR_RECIPIENT_BRANCH: [u32; 3] = [44, 397, 1];

/// SLIP-0010 ed25519 derivation (hardened only). Returns the 32-byte private key.
pub fn slip10_ed25519(seed: &[u8], path: &[u32]) -> [u8; 32] {
    let mut mac = Hmac::<Sha512>::new_from_slice(b"ed25519 seed").expect("any key length");
    mac.update(seed);
    let mut i = mac.finalize().into_bytes();
    for &c in path {
        let (key, chain) = i.split_at(32);
        let mut mac = Hmac::<Sha512>::new_from_slice(chain).expect("any key length");
        mac.update(&[0u8]);
        mac.update(key);
        mac.update(&(c | HARDENED).to_be_bytes());
        i = mac.finalize().into_bytes();
    }
    i[..32].try_into().expect("32 bytes")
}

/// The path string of recipient `index`, e.g. `m/44'/397'/1'/3'`.
pub fn near_path(index: u32) -> String {
    let [a, b, c] = NEAR_RECIPIENT_BRANCH;
    format!("m/{a}'/{b}'/{c}'/{index}'")
}

/// The signing key of per-swap NEAR recipient `index`.
pub fn near_signing_key(seed: &[u8], index: u32) -> SigningKey {
    if index >= HARDENED {
        panic!("recipient index must be below 2^31");
    }
    let [a, b, c] = NEAR_RECIPIENT_BRANCH;
    SigningKey::from_bytes(&slip10_ed25519(seed, &[a, b, c, index]))
}

/// The NEAR implicit account id (64 lowercase hex characters) and public key (`ed25519:<base58>`).
pub fn near_recipient(seed: &[u8], index: u32) -> (String, String) {
    let pk = near_signing_key(seed, index).verifying_key().to_bytes();
    (hex::encode(pk), format!("ed25519:{}", bs58::encode(pk).into_string()))
}

/// near-cli's credentials JSON (`~/.near-credentials/mainnet/<account>.json`) for recipient `index`.
/// The NEAR private key encoding is base58 of the 64-byte `secret ‖ public` keypair.
pub fn near_credentials_json(seed: &[u8], index: u32) -> String {
    let sk = near_signing_key(seed, index);
    let (account_id, public_key) = near_recipient(seed, index);
    let private_key = format!("ed25519:{}", bs58::encode(sk.to_keypair_bytes()).into_string());
    serde_json::json!({ "account_id": account_id, "public_key": public_key, "private_key": private_key }).to_string()
}
