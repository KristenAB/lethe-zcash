use std::collections::HashSet;
use zswap_core::*;

const SEED: [u8; 32] = [7; 32]; // public test fixture, never a live wallet seed

#[test]
fn refund_keys_never_share_an_ivk_or_address_and_keep_the_spending_authority() {
    let acct = account(&SEED, COIN_TESTNET).unwrap();
    let net = network(COIN_TESTNET);
    let mut ivks = HashSet::from([uivk(&acct, net).unwrap()]);
    let mut addrs = HashSet::from([address(&acct, net).unwrap()]);
    for i in 0..64u64 {
        let k = one_time(&acct, KeyPurpose::Refund, i).unwrap();
        assert!(ivks.insert(uivk(&k, net).unwrap()), "index {i} repeats an IVK");
        assert!(addrs.insert(address(&k, net).unwrap()), "index {i} repeats an address");
        assert_eq!(authority(&k), authority(&acct), "index {i} must keep ak‖nk (the wallet can still spend)");
    }
    assert_eq!(ivks.len(), 65);
}

#[test]
fn derivation_is_deterministic_and_purposes_are_separate() {
    let acct = account(&SEED, COIN_TESTNET).unwrap();
    let a = one_time(&acct, KeyPurpose::Refund, 3).unwrap();
    let b = one_time(&acct, KeyPurpose::Refund, 3).unwrap();
    let c = one_time(&acct, KeyPurpose::Receive, 3).unwrap();
    assert_eq!(fvk_id(&a), fvk_id(&b));
    assert_ne!(fvk_id(&a), fvk_id(&c));
}

#[test]
fn testnet_and_mainnet_use_different_accounts_and_encodings() {
    let t = one_time(&account(&SEED, COIN_TESTNET).unwrap(), KeyPurpose::Refund, 0).unwrap();
    let m = one_time(&account(&SEED, COIN_MAINNET).unwrap(), KeyPurpose::Refund, 0).unwrap();
    assert!(address(&t, network(COIN_TESTNET)).unwrap().starts_with("utest1"));
    assert!(address(&m, network(COIN_MAINNET)).unwrap().starts_with("u1"));
    assert!(uivk(&t, network(COIN_TESTNET)).unwrap().starts_with("uivktest1"));
    assert_ne!(fvk_id(&t), fvk_id(&m));
}

#[test]
fn another_seed_gives_unrelated_keys() {
    let a = one_time(&account(&SEED, COIN_TESTNET).unwrap(), KeyPurpose::Refund, 0).unwrap();
    let b = one_time(&account(&[8; 32], COIN_TESTNET).unwrap(), KeyPurpose::Refund, 0).unwrap();
    assert_ne!(authority(&a), authority(&b));
    assert!(account(&[1; 16], COIN_TESTNET).is_err());
}

#[test]
fn refund_memo_round_trips_and_rejects_other_memos() {
    for i in [0u64, 1, 41, u64::MAX] {
        let m = refund_memo(i);
        assert_eq!(&m[..7], b"\xffZSWP\x01\x00");
        assert_eq!(decode_refund_memo(&m), Some(i));
    }
    assert_eq!(decode_refund_memo(&[0; 512]), None);
}
