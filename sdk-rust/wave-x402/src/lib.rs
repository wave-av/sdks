//! WAVE x402 "exact" scheme signing (EIP-3009 `TransferWithAuthorization`).
//!
//! Lets a Rust agent pay a WAVE x402 facilitator (`gateway.wave.online`): sign a USDC
//! `TransferWithAuthorization` as EIP-712 typed data, then build the `X-Payment` header. The signature
//! is bound to the payer's wallet; the WAVE facilitator (not your server) broadcasts the on-chain pull.
//!
//! Byte-for-byte compatible with WAVE's reference TypeScript x402 signer — verified against the shared
//! conformance vector (`testdata/x402_exact_vector.json`). This crate is hand-written, not codegen output.
//!
//! ```no_run
//! # fn main() -> Result<(), wave_x402::X402Error> {
//! let private_key = "0x..."; // the agent wallet key — never leaves the client
//! let payload = wave_x402::sign_exact_authorization(wave_x402::SignExactParams {
//!     private_key,
//!     network: "base",                 // or "base-sepolia"
//!     to: "0xMerchantTreasury",        // requirement.payTo
//!     value: "1000",                   // atomic USDC, decimal (>= the requirement)
//!     valid_before: "1900000600",      // unix seconds
//!     valid_after: None,
//!     from: None,
//!     nonce: None,
//! })?;
//! let _header = wave_x402::encode_exact_payment_header("base", &payload);
//! # Ok(())
//! # }
//! ```

use alloy::primitives::{Address, B256, U256};
use alloy::signers::local::PrivateKeySigner;
use alloy::signers::SignerSync;
use alloy::sol;
use alloy::sol_types::{Eip712Domain, SolStruct};
use base64::Engine;
use rand::RngCore;
use serde::Serialize;
use std::str::FromStr;

sol! {
    struct TransferWithAuthorization {
        address from;
        address to;
        uint256 value;
        uint256 validAfter;
        uint256 validBefore;
        bytes32 nonce;
    }
}

/// USDC EIP-712 domain for a supported network.
#[derive(Clone, Copy, Debug)]
pub struct NetworkConfig {
    pub chain_id: u64,
    pub usdc: &'static str,
    pub domain_name: &'static str,
    pub domain_version: &'static str,
}

/// Network config for `network` ("base" | "base-sepolia"), or `None` if unsupported. The domain name
/// differs by chain (mainnet "USD Coin" vs Sepolia "USDC"), so the typed-data hash is chain-specific.
pub fn network_config(network: &str) -> Option<NetworkConfig> {
    match network {
        "base" => Some(NetworkConfig {
            chain_id: 8453,
            usdc: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
            domain_name: "USD Coin",
            domain_version: "2",
        }),
        "base-sepolia" => Some(NetworkConfig {
            chain_id: 84532,
            usdc: "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
            domain_name: "USDC",
            domain_version: "2",
        }),
        _ => None,
    }
}

/// The EIP-3009 authorization, wire shape (numeric fields decimal strings; nonce 0x + 64 hex).
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ExactAuthorization {
    pub from: String,
    pub to: String,
    pub value: String,
    #[serde(rename = "validAfter")]
    pub valid_after: String,
    #[serde(rename = "validBefore")]
    pub valid_before: String,
    pub nonce: String,
}

/// Signed authorization the WAVE facilitator's /verify and /settle accept.
#[derive(Debug, Clone, Serialize)]
pub struct ExactPayload {
    pub signature: String,
    pub authorization: ExactAuthorization,
}

/// Inputs to [`sign_exact_authorization`]. `valid_after` defaults to "0", `from` to the signer, `nonce`
/// to a fresh random bytes32.
pub struct SignExactParams<'a> {
    pub private_key: &'a str,
    pub network: &'a str,
    pub to: &'a str,
    pub value: &'a str,
    pub valid_before: &'a str,
    pub valid_after: Option<&'a str>,
    pub from: Option<&'a str>,
    pub nonce: Option<&'a str>,
}

/// Errors from signing.
#[derive(Debug)]
pub enum X402Error {
    UnsupportedNetwork(String),
    FromMismatch,
    Parse(String),
    Sign(String),
}

impl std::fmt::Display for X402Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            X402Error::UnsupportedNetwork(n) => write!(f, "unsupported network: {n}"),
            X402Error::FromMismatch => write!(f, "from does not match the signing key"),
            X402Error::Parse(e) => write!(f, "parse error: {e}"),
            X402Error::Sign(e) => write!(f, "sign error: {e}"),
        }
    }
}
impl std::error::Error for X402Error {}

/// A fresh random bytes32 nonce as 0x + 64 lowercase hex (single-use, enforced on-chain by USDC at settle).
pub fn random_nonce() -> String {
    let mut b = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut b);
    format!("0x{}", alloy::hex::encode(b))
}

/// Sign a USDC EIP-3009 `TransferWithAuthorization` for the x402 "exact" scheme.
pub fn sign_exact_authorization(p: SignExactParams) -> Result<ExactPayload, X402Error> {
    let net = network_config(p.network)
        .ok_or_else(|| X402Error::UnsupportedNetwork(p.network.to_string()))?;

    let signer = PrivateKeySigner::from_str(p.private_key)
        .map_err(|e| X402Error::Parse(format!("private key: {e}")))?;
    let signer_addr = signer.address();

    let from_addr = match p.from {
        Some(f) => Address::from_str(f).map_err(|e| X402Error::Parse(format!("from: {e}")))?,
        None => signer_addr,
    };
    if from_addr != signer_addr {
        return Err(X402Error::FromMismatch);
    }

    let valid_after = p.valid_after.unwrap_or("0");
    let nonce_str = p.nonce.map(str::to_string).unwrap_or_else(random_nonce);

    let to_addr = Address::from_str(p.to).map_err(|e| X402Error::Parse(format!("to: {e}")))?;
    let value = U256::from_str(p.value).map_err(|e| X402Error::Parse(format!("value: {e}")))?;
    let va =
        U256::from_str(valid_after).map_err(|e| X402Error::Parse(format!("validAfter: {e}")))?;
    let vb = U256::from_str(p.valid_before)
        .map_err(|e| X402Error::Parse(format!("validBefore: {e}")))?;
    let nonce = B256::from_str(&nonce_str).map_err(|e| X402Error::Parse(format!("nonce: {e}")))?;

    let twa = TransferWithAuthorization {
        from: from_addr,
        to: to_addr,
        value,
        validAfter: va,
        validBefore: vb,
        nonce,
    };

    let domain = Eip712Domain {
        name: Some(net.domain_name.into()),
        version: Some(net.domain_version.into()),
        chain_id: Some(U256::from(net.chain_id)),
        verifying_contract: Some(
            Address::from_str(net.usdc).map_err(|e| X402Error::Parse(format!("usdc: {e}")))?,
        ),
        salt: None,
    };

    let hash = twa.eip712_signing_hash(&domain);
    let sig = signer
        .sign_hash_sync(&hash)
        .map_err(|e| X402Error::Sign(e.to_string()))?;
    let mut bytes = sig.as_bytes(); // [r(32), s(32), v(1)]
    if bytes[64] < 27 {
        bytes[64] += 27; // recovery id 0/1 -> 27/28 (matches the reference signer)
    }

    // Wire shape mirrors the reference signer: derived `from` is the EIP-55 checksummed signer address;
    // an explicit `from`/`to` is kept exactly as passed (so the header is byte-identical to JS).
    let from_wire = p
        .from
        .map(str::to_string)
        .unwrap_or_else(|| signer_addr.to_checksum(None));

    Ok(ExactPayload {
        signature: format!("0x{}", alloy::hex::encode(bytes)),
        authorization: ExactAuthorization {
            from: from_wire,
            to: p.to.to_string(),
            value: value.to_string(),
            valid_after: va.to_string(),
            valid_before: vb.to_string(),
            nonce: nonce_str,
        },
    })
}

/// Base64-encode the X-Payment envelope `{x402Version:1, scheme:"exact", network, payload}`. Standard
/// base64, matching the reference `btoa(JSON.stringify(...))`.
pub fn encode_exact_payment_header(network: &str, payload: &ExactPayload) -> String {
    #[derive(Serialize)]
    struct Envelope<'a> {
        #[serde(rename = "x402Version")]
        x402_version: u8,
        scheme: &'a str,
        network: &'a str,
        payload: &'a ExactPayload,
    }
    let env = Envelope {
        x402_version: 1,
        scheme: "exact",
        network,
        payload,
    };
    // serde_json is compact and field-ordered; no HTML escaping — reproduces JSON.stringify byte-for-byte.
    let json = serde_json::to_vec(&env).expect("envelope serializes");
    base64::engine::general_purpose::STANDARD.encode(json)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(serde::Deserialize)]
    struct Vector {
        #[serde(rename = "payerPrivateKey")]
        payer_private_key: String,
        #[serde(rename = "payerAddress")]
        payer_address: String,
        vectors: Vec<Case>,
    }
    #[derive(serde::Deserialize)]
    struct Case {
        network: String,
        authorization: WireAuth,
        signature: String,
        header: String,
    }
    #[derive(serde::Deserialize)]
    struct WireAuth {
        to: String,
        value: String,
        #[serde(rename = "validAfter")]
        valid_after: String,
        #[serde(rename = "validBefore")]
        valid_before: String,
        nonce: String,
    }

    fn load() -> Vector {
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../testdata/x402_exact_vector.json"
        );
        let raw = std::fs::read_to_string(path).expect("read vector");
        serde_json::from_str(&raw).expect("parse vector")
    }

    #[test]
    fn byte_identical_to_reference() {
        let v = load();
        for c in &v.vectors {
            let payload = sign_exact_authorization(SignExactParams {
                private_key: &v.payer_private_key,
                network: &c.network,
                to: &c.authorization.to,
                value: &c.authorization.value,
                valid_before: &c.authorization.valid_before,
                valid_after: Some(&c.authorization.valid_after),
                from: None,
                nonce: Some(&c.authorization.nonce),
            })
            .expect("sign");
            assert_eq!(payload.signature, c.signature, "[{}] signature", c.network);
            assert_eq!(
                encode_exact_payment_header(&c.network, &payload),
                c.header,
                "[{}] header",
                c.network
            );
            assert!(
                payload
                    .authorization
                    .from
                    .eq_ignore_ascii_case(&v.payer_address),
                "[{}] from",
                c.network
            );
        }
    }

    #[test]
    fn random_nonce_is_bytes32_hex() {
        let n = random_nonce();
        assert!(n.starts_with("0x") && n.len() == 66);
        assert_ne!(random_nonce(), random_nonce());
    }

    #[test]
    fn guards() {
        let v = load();
        let to = &v.vectors[0].authorization.to;
        assert!(matches!(
            sign_exact_authorization(SignExactParams {
                private_key: &v.payer_private_key,
                network: "base",
                to,
                value: "1",
                valid_before: "1900000600",
                valid_after: None,
                from: Some("0x0000000000000000000000000000000000000001"),
                nonce: None,
            }),
            Err(X402Error::FromMismatch)
        ));
        assert!(matches!(
            sign_exact_authorization(SignExactParams {
                private_key: &v.payer_private_key,
                network: "ethereum",
                to,
                value: "1",
                valid_before: "1900000600",
                valid_after: None,
                from: None,
                nonce: None,
            }),
            Err(X402Error::UnsupportedNetwork(_))
        ));
    }
}
