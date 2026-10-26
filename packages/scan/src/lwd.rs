//! Minimal lightwalletd gRPC client over tonic (TLS for `https://` URLs, webpki roots).

use std::time::Duration;

use tonic::transport::{Channel, ClientTlsConfig, Endpoint};
use zcash_client_backend::proto::service::{
    compact_tx_streamer_client::CompactTxStreamerClient, ChainSpec, Empty, TxFilter,
};
use zcash_protocol::{consensus::BlockHeight, TxId};

pub const DEFAULT_LWD_URL: &str = "https://testnet.zec.rocks:443";
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);

pub type Client = CompactTxStreamerClient<Channel>;

#[derive(Debug)]
pub enum LwdError {
    BadUrl(String),
    Connect(String),
    Rpc(tonic::Status),
}

impl std::fmt::Display for LwdError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LwdError::BadUrl(e) => write!(f, "invalid lightwalletd URL: {e}"),
            LwdError::Connect(e) => write!(f, "cannot connect to lightwalletd: {e}"),
            LwdError::Rpc(s) => write!(f, "lightwalletd RPC failed: {:?}: {}", s.code(), s.message()),
        }
    }
}

impl std::error::Error for LwdError {}

/// Connect eagerly so an unreachable server fails here, not on the first request.
pub async fn connect(url: &str) -> Result<Client, LwdError> {
    let mut ep = Endpoint::from_shared(url.to_string())
        .map_err(|e| LwdError::BadUrl(e.to_string()))?
        .connect_timeout(CONNECT_TIMEOUT)
        .timeout(Duration::from_secs(60));
    if url.starts_with("https://") {
        ep = ep
            .tls_config(ClientTlsConfig::new().with_webpki_roots())
            .map_err(|e| LwdError::Connect(e.to_string()))?;
    }
    // Endpoint's connector timeout does not cover every phase (notably a stalled TLS
    // handshake). Bound the whole eager connection, including DNS, TCP and TLS.
    let channel = tokio::time::timeout(CONNECT_TIMEOUT, ep.connect())
        .await
        .map_err(|_| LwdError::Connect(format!("{url}: connection did not finish in 10 s")))?
        .map_err(|e| LwdError::Connect(format!("{url}: {e}")))?;
    Ok(CompactTxStreamerClient::new(channel).max_decoding_message_size(32 * 1024 * 1024))
}

#[derive(Debug, Clone)]
pub struct ServerInfo {
    pub chain_name: String,
    pub block_height: u64,
    pub vendor: String,
    pub version: String,
}

pub async fn info(client: &mut Client) -> Result<ServerInfo, LwdError> {
    let i = client.get_lightd_info(Empty {}).await.map_err(LwdError::Rpc)?.into_inner();
    Ok(ServerInfo { chain_name: i.chain_name, block_height: i.block_height, vendor: i.vendor, version: i.version })
}

pub async fn chain_tip(client: &mut Client) -> Result<BlockHeight, LwdError> {
    let b = client.get_latest_block(ChainSpec {}).await.map_err(LwdError::Rpc)?.into_inner();
    let h = u32::try_from(b.height).map_err(|_| LwdError::Rpc(tonic::Status::internal("tip height overflows u32")))?;
    Ok(BlockHeight::from_u32(h))
}

/// Where lightwalletd says a transaction is (`RawTransaction.height` semantics).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TxLocation {
    Mempool,
    Mined(BlockHeight),
    /// Mined only on a fork that is not the main chain.
    Orphaned,
}

impl TxLocation {
    pub fn from_raw_height(h: u64) -> Self {
        match h {
            0 => TxLocation::Mempool,
            u64::MAX => TxLocation::Orphaned,
            h => match u32::try_from(h) {
                Ok(h) => TxLocation::Mined(BlockHeight::from_u32(h)),
                Err(_) => TxLocation::Orphaned,
            },
        }
    }
}

pub enum FetchedTx {
    Found { data: Vec<u8>, location: TxLocation },
    NotFound,
}

/// `GetTransaction` by txid. lightwalletd and Zaino both report an unknown txid as an RPC
/// error rather than an empty result, so map the known "not found" shapes to `NotFound`.
pub async fn get_transaction(client: &mut Client, txid: &TxId) -> Result<FetchedTx, LwdError> {
    let filter = TxFilter { block: None, index: 0, hash: txid.as_ref().to_vec() };
    match client.get_transaction(filter).await {
        Ok(r) => {
            let raw = r.into_inner();
            if raw.data.is_empty() {
                return Ok(FetchedTx::NotFound);
            }
            Ok(FetchedTx::Found { location: TxLocation::from_raw_height(raw.height), data: raw.data })
        }
        Err(s) if is_not_found(&s) => Ok(FetchedTx::NotFound),
        Err(s) => Err(LwdError::Rpc(s)),
    }
}

fn is_not_found(s: &tonic::Status) -> bool {
    if s.code() == tonic::Code::NotFound {
        return true;
    }
    let m = s.message().to_ascii_lowercase();
    m.contains("no such mempool or blockchain transaction") || m.contains("not found") || m.contains("no such transaction")
}

/// Parse a display-order (block-explorer) txid.
pub fn parse_txid(s: &str) -> Option<TxId> {
    TxId::from_hex(s.trim())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn stalled_tls_handshake_obeys_connection_timeout() {
        // Accept a real TCP connection and leave TLS unanswered; no wallet/key or RPC is needed.
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("https://localhost:{}", listener.local_addr().unwrap().port());
        let started = tokio::time::Instant::now();
        let attempt = tokio::spawn(async move { connect(&url).await });
        let (_socket, _) = tokio::time::timeout(Duration::from_secs(5), listener.accept()).await.unwrap().unwrap();
        let result = tokio::time::timeout(CONNECT_TIMEOUT + Duration::from_secs(3), attempt).await.unwrap().unwrap();
        let error = match result {
            Err(error) => error,
            Ok(_) => panic!("an unanswered TLS handshake must not connect"),
        };
        assert!(matches!(error, LwdError::Connect(_)));
        assert!(error.to_string().contains("connection did not finish in 10 s"));
        assert!(started.elapsed() >= CONNECT_TIMEOUT);
        assert!(started.elapsed() < CONNECT_TIMEOUT + Duration::from_secs(3));
    }
}
