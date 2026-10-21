use std::collections::HashSet;
use zswap_core::near::{near_signing_key, slip10_ed25519};
use zswap_core::*;

const SEED: [u8; 32] = [7; 32]; // public test fixture, never a live wallet seed

#[test]
fn slip10_ed25519_matches_the_published_test_vector() {
    // SLIP-0010 test vector 1 (ed25519), seed 000102…0f
    let seed = hex::decode("000102030405060708090a0b0c0d0e0f").unwrap();
    assert_eq!(hex::encode(slip10_ed25519(&seed, &[])), "2b4be7f19ee27bbf30c667b642d5f4aa69fd169872f8fc3059c08ebae2eb19e7");
    assert_eq!(hex::encode(slip10_ed25519(&seed, &[0])), "68e0fe46dfb67e368c75379acec591dad19df3cde26e63b93a8e704f1dade7a3");
    assert_eq!(hex::encode(slip10_ed25519(&seed, &[0, 1, 2, 2, 1_000_000_000])), "8f94d394a8e8fd6b1bc2f3f49f5c47e385281d5c17e65324b0f62483e37e8793");
}

#[test]
fn every_swap_gets_its_own_near_implicit_account_and_the_seed_alone_rederives_it() {
    let mut ids = HashSet::new();
    for i in 0..64u32 {
        let (id, pk) = near_recipient(&SEED, i);
        assert_eq!(id.len(), 64);
        assert!(id.chars().all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase()), "implicit ids are lowercase hex");
        assert_eq!(hex::decode(&id).unwrap(), bs58::decode(pk.strip_prefix("ed25519:").unwrap()).into_vec().unwrap(), "id = hex(public key)");
        assert!(ids.insert(id), "index {i} repeats a recipient");
        assert_eq!(near_recipient(&SEED, i), near_recipient(&SEED, i), "deterministic");
    }
    assert_ne!(near_recipient(&SEED, 0), near_recipient(&[8; 32], 0), "another seed, another account");
    assert_eq!(near_path(3), "m/44'/397'/1'/3'");
}

#[test]
fn credentials_file_holds_the_matching_keypair() {
    let j: serde_json::Value = serde_json::from_str(&near_credentials_json(&SEED, 5)).unwrap();
    let (id, pk) = near_recipient(&SEED, 5);
    assert_eq!(j["account_id"], id);
    assert_eq!(j["public_key"], pk);
    let kp = bs58::decode(j["private_key"].as_str().unwrap().strip_prefix("ed25519:").unwrap()).into_vec().unwrap();
    assert_eq!(kp.len(), 64);
    assert_eq!(&kp[32..], &hex::decode(&id).unwrap()[..], "keypair ends with the public key");
    assert_eq!(kp[..32], near_signing_key(&SEED, 5).to_bytes());
}
