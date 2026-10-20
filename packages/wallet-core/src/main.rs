//! zswap-keys: one-time refund addresses from a wallet seed file. Prints JSON; never prints the seed.
//!
//!     zswap-keys init <seed-file>                         create a 32-byte random seed (0600) if missing
//!     zswap-keys account <seed-file>                      the account's own address + UIVK (testnet)
//!     zswap-keys refund <seed-file> <index>               one-time refund key i: testnet + mainnet address, testnet UIVK
//!     zswap-keys memo <index>                             the 512-byte refund memo, hex
use std::{fs, io::Write, os::unix::fs::OpenOptionsExt};
use zswap_core::*;

fn fail(msg: impl std::fmt::Display) -> ! {
    eprintln!("error: {msg}");
    std::process::exit(2)
}

fn seed(path: &str) -> Vec<u8> {
    let s = fs::read(path).unwrap_or_else(|_| fail(format!("Setup required: seed file {path} (zswap-keys init {path})")));
    if s.len() != 32 {
        fail(format!("{path} is not a 32-byte seed"));
    }
    s
}

fn main() {
    let a: Vec<String> = std::env::args().skip(1).collect();
    match a.first().map(String::as_str) {
        Some("init") if a.len() == 2 => {
            if fs::metadata(&a[1]).is_ok() {
                println!("{{\"created\":false}}");
                return;
            }
            let mut s = [0u8; 32];
            rand::fill(&mut s);
            let mut f = fs::OpenOptions::new().write(true).create_new(true).mode(0o600).open(&a[1]).unwrap_or_else(|e| fail(e));
            f.write_all(&s).unwrap_or_else(|e| fail(e));
            println!("{{\"created\":true}}");
        }
        Some("account") if a.len() == 2 => {
            let acct = account(&seed(&a[1]), COIN_TESTNET).unwrap_or_else(|e| fail(e));
            let net = network(COIN_TESTNET);
            println!("{}", serde_json::json!({ "address": address(&acct, net).unwrap_or_else(|e| fail(e)), "uivk": uivk(&acct, net).unwrap_or_else(|e| fail(e)), "fvk_id": fvk_id(&acct) }));
        }
        Some("refund") if a.len() == 3 => {
            let s = seed(&a[1]);
            let i: u64 = a[2].parse().unwrap_or_else(|_| fail("index must be a whole number"));
            let t = one_time(&account(&s, COIN_TESTNET).unwrap_or_else(|e| fail(e)), KeyPurpose::Refund, i).unwrap_or_else(|e| fail(e));
            let m = one_time(&account(&s, COIN_MAINNET).unwrap_or_else(|e| fail(e)), KeyPurpose::Refund, i).unwrap_or_else(|e| fail(e));
            println!(
                "{}",
                serde_json::json!({
                    "index": i,
                    "testnet": { "address": address(&t, network(COIN_TESTNET)).unwrap_or_else(|e| fail(e)), "uivk": uivk(&t, network(COIN_TESTNET)).unwrap_or_else(|e| fail(e)), "fvk_id": fvk_id(&t) },
                    "mainnet": { "address": address(&m, network(COIN_MAINNET)).unwrap_or_else(|e| fail(e)), "fvk_id": fvk_id(&m) },
                })
            );
        }
        Some("memo") if a.len() == 2 => {
            let i: u64 = a[1].parse().unwrap_or_else(|_| fail("index must be a whole number"));
            println!("{}", hex::encode(refund_memo(i)));
        }
        _ => fail("usage: zswap-keys init|account <seed-file> | refund <seed-file> <index> | memo <index>"),
    }
}
