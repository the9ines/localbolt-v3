//! LocalBolt Signaling Server — canonical bolt-rendezvous wrapper.
//!
//! This crate re-exports the canonical [`bolt_rendezvous::SignalingServer`] as the
//! single source of truth for LocalBolt signaling. No independent protocol
//! handling is implemented here.
//!
//! # Example
//!
//! ```rust,no_run
//! use localbolt_signal::SignalingServer;
//! use std::net::SocketAddr;
//!
//! #[tokio::main]
//! async fn main() {
//!     let addr: SocketAddr = "0.0.0.0:3001".parse().unwrap();
//!     let server = SignalingServer::new(addr);
//!     server.run().await.unwrap();
//! }
//! ```

pub use bolt_rendezvous::protocol;
pub use bolt_rendezvous::room;
pub use bolt_rendezvous::server;
pub use bolt_rendezvous::SignalingServer;

#[cfg(test)]
mod tests {
    use bolt_rendezvous::protocol::{ClientMessage, DeviceType, PeerData, ServerMessage};
    use bolt_rendezvous::room::{PeerInfo, RoomManager};
    use bolt_rendezvous::server::{
        validate_device_name, validate_message_size, validate_peer_code, validate_signal_target,
        RateLimit, MAX_DEVICE_NAME_BYTES, MAX_MESSAGE_BYTES, MAX_PEER_CODE_BYTES,
        RATE_LIMIT_CLOSE_THRESHOLD, RATE_LIMIT_PER_SECOND,
    };

    // ── Wire-format parity tests ────────────────────────────────
    // Verify canonical bolt-rendezvous-protocol types serialize/deserialize
    // correctly when consumed through the wrapper.

    #[test]
    fn wire_deserialize_register() {
        let json = r#"{"type":"register","peer_code":"ABC123","device_name":"iPhone 15","device_type":"phone"}"#;
        let msg: ClientMessage = serde_json::from_str(json).unwrap();
        match msg {
            ClientMessage::Register {
                peer_code,
                device_name,
                device_type,
            } => {
                assert_eq!(peer_code, "ABC123");
                assert_eq!(device_name, "iPhone 15");
                assert_eq!(device_type, DeviceType::Phone);
            }
            _ => panic!("expected Register"),
        }
    }

    #[test]
    fn wire_deserialize_signal() {
        let json = r#"{"type":"signal","to":"XYZ789","payload":{"sdp":"..."}}"#;
        let msg: ClientMessage = serde_json::from_str(json).unwrap();
        match msg {
            ClientMessage::Signal { to, payload } => {
                assert_eq!(to, "XYZ789");
                assert!(payload.get("sdp").is_some());
            }
            _ => panic!("expected Signal"),
        }
    }

    #[test]
    fn wire_deserialize_ping() {
        let json = r#"{"type":"ping"}"#;
        let msg: ClientMessage = serde_json::from_str(json).unwrap();
        assert!(matches!(msg, ClientMessage::Ping));
    }

    #[test]
    fn wire_serialize_peers() {
        let msg = ServerMessage::Peers {
            peers: vec![PeerData {
                peer_code: "ABC123".into(),
                device_name: "MacBook".into(),
                device_type: DeviceType::Laptop,
            }],
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains(r#""type":"peers""#));
        assert!(json.contains(r#""peer_code":"ABC123""#));
    }

    #[test]
    fn wire_serialize_peer_joined() {
        let msg = ServerMessage::PeerJoined {
            peer: PeerData {
                peer_code: "DEF456".into(),
                device_name: "iPad".into(),
                device_type: DeviceType::Tablet,
            },
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains(r#""type":"peer_joined""#));
    }

    #[test]
    fn wire_serialize_peer_left() {
        let msg = ServerMessage::PeerLeft {
            peer_code: "ABC123".into(),
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains(r#""type":"peer_left""#));
        assert!(json.contains(r#""peer_code":"ABC123""#));
    }

    #[test]
    fn wire_serialize_signal_relay() {
        let msg = ServerMessage::Signal {
            from: "ABC123".into(),
            payload: serde_json::json!({"sdp": "offer-data"}),
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains(r#""type":"signal""#));
        assert!(json.contains(r#""from":"ABC123""#));
    }

    #[test]
    fn wire_serialize_error() {
        let msg = ServerMessage::Error {
            message: "bad request".into(),
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains(r#""type":"error""#));
        assert!(json.contains(r#""message":"bad request""#));
    }

    // ── Validation function tests ───────────────────────────────

    #[test]
    fn message_size_within_limit() {
        assert!(validate_message_size(0).is_ok());
        assert!(validate_message_size(1024).is_ok());
        assert!(validate_message_size(MAX_MESSAGE_BYTES).is_ok());
    }

    #[test]
    fn message_size_exceeds_limit() {
        let result = validate_message_size(MAX_MESSAGE_BYTES + 1);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("message too large"));
    }

    #[test]
    fn message_size_boundary() {
        assert!(validate_message_size(MAX_MESSAGE_BYTES).is_ok());
        assert!(validate_message_size(MAX_MESSAGE_BYTES + 1).is_err());
    }

    #[test]
    fn device_name_within_limit() {
        assert!(validate_device_name("iPhone 15").is_ok());
        assert!(validate_device_name(&"x".repeat(MAX_DEVICE_NAME_BYTES)).is_ok());
    }

    #[test]
    fn device_name_exceeds_limit() {
        let result = validate_device_name(&"x".repeat(MAX_DEVICE_NAME_BYTES + 1));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("device_name too long"));
    }

    #[test]
    fn device_name_empty_is_ok() {
        assert!(validate_device_name("").is_ok());
    }

    #[test]
    fn signal_target_valid() {
        assert!(validate_signal_target("ABC123").is_ok());
        assert!(validate_signal_target("X").is_ok());
        assert!(validate_signal_target(&"A".repeat(MAX_PEER_CODE_BYTES)).is_ok());
    }

    #[test]
    fn signal_target_empty() {
        assert!(validate_signal_target("").is_err());
    }

    #[test]
    fn signal_target_too_long() {
        assert!(validate_signal_target(&"A".repeat(MAX_PEER_CODE_BYTES + 1)).is_err());
    }

    #[test]
    fn signal_target_non_alphanumeric() {
        assert!(validate_signal_target("ABC-123").is_err());
        assert!(validate_signal_target("ABC 123").is_err());
    }

    #[test]
    fn peer_code_valid() {
        assert!(validate_peer_code("ABC123").is_ok());
        assert!(validate_peer_code(&"Z".repeat(MAX_PEER_CODE_BYTES)).is_ok());
    }

    #[test]
    fn peer_code_empty() {
        assert!(validate_peer_code("").is_err());
    }

    #[test]
    fn peer_code_too_long() {
        assert!(validate_peer_code(&"A".repeat(MAX_PEER_CODE_BYTES + 1)).is_err());
    }

    #[test]
    fn peer_code_non_alphanumeric() {
        assert!(validate_peer_code("AB!C").is_err());
    }

    // ── Rate limit tests ────────────────────────────────────────

    #[tokio::test]
    async fn rate_limit_allows_within_budget() {
        tokio::time::pause();
        let mut rl = RateLimit::new();
        for _ in 0..RATE_LIMIT_PER_SECOND {
            assert!(rl.check().is_ok());
        }
    }

    #[tokio::test]
    async fn rate_limit_rejects_over_budget() {
        tokio::time::pause();
        let mut rl = RateLimit::new();
        for _ in 0..RATE_LIMIT_PER_SECOND {
            let _ = rl.check();
        }
        assert_eq!(rl.check(), Err(false));
    }

    #[tokio::test]
    async fn rate_limit_closes_after_threshold() {
        tokio::time::pause();
        let mut rl = RateLimit::new();
        for _ in 0..RATE_LIMIT_PER_SECOND {
            let _ = rl.check();
        }
        for _ in 0..(RATE_LIMIT_CLOSE_THRESHOLD - 1) {
            assert_eq!(rl.check(), Err(false));
        }
        assert_eq!(rl.check(), Err(true));
    }

    #[tokio::test]
    async fn rate_limit_resets_after_window() {
        tokio::time::pause();
        let mut rl = RateLimit::new();
        for _ in 0..RATE_LIMIT_PER_SECOND {
            let _ = rl.check();
        }
        assert!(rl.check().is_err());
        tokio::time::advance(std::time::Duration::from_secs(2)).await;
        assert!(rl.check().is_ok());
    }

    #[tokio::test]
    async fn rate_limit_violation_count_resets_on_success() {
        tokio::time::pause();
        let mut rl = RateLimit::new();
        for _ in 0..RATE_LIMIT_PER_SECOND {
            let _ = rl.check();
        }
        assert_eq!(rl.check(), Err(false));
        assert_eq!(rl.check(), Err(false));
        tokio::time::advance(std::time::Duration::from_secs(2)).await;
        assert!(rl.check().is_ok());
        for _ in 1..RATE_LIMIT_PER_SECOND {
            let _ = rl.check();
        }
        assert_eq!(rl.check(), Err(false));
    }

    // ── Trust boundary constants ────────────────────────────────

    #[test]
    fn trust_boundary_constants() {
        assert_eq!(MAX_MESSAGE_BYTES, 1_048_576);
        assert_eq!(MAX_DEVICE_NAME_BYTES, 256);
        assert_eq!(MAX_PEER_CODE_BYTES, 16);
        assert_eq!(RATE_LIMIT_PER_SECOND, 50);
        assert_eq!(RATE_LIMIT_CLOSE_THRESHOLD, 3);
    }

    // ── Room management tests ───────────────────────────────────

    #[test]
    fn room_manager_add_and_find_peer() {
        let rm = RoomManager::new();
        let (tx, _rx) = tokio::sync::mpsc::unbounded_channel();
        let peer = PeerInfo {
            peer_code: "ABC123".into(),
            device_name: "MacBook".into(),
            device_type: DeviceType::Laptop,
            sender: tx,
        };
        let result = rm.add_peer("127.0.0.1", peer);
        assert!(result.is_ok());
        assert!(rm.find_peer("ABC123").is_some());
    }

    #[test]
    fn room_manager_remove_peer_cleanup() {
        let rm = RoomManager::new();
        let (tx, _rx) = tokio::sync::mpsc::unbounded_channel();
        let peer = PeerInfo {
            peer_code: "ABC123".into(),
            device_name: "MacBook".into(),
            device_type: DeviceType::Laptop,
            sender: tx,
        };
        rm.add_peer("127.0.0.1", peer).unwrap();
        rm.remove_peer("127.0.0.1", "ABC123");
        assert!(rm.find_peer("ABC123").is_none());
        assert_eq!(rm.room_count(), 0);
    }

    #[test]
    fn room_manager_counts() {
        let rm = RoomManager::new();
        assert_eq!(rm.room_count(), 0);
        assert_eq!(rm.peer_count(), 0);

        let (tx1, _rx1) = tokio::sync::mpsc::unbounded_channel();
        rm.add_peer(
            "10.0.0.1",
            PeerInfo {
                peer_code: "A1".into(),
                device_name: "Dev1".into(),
                device_type: DeviceType::Desktop,
                sender: tx1,
            },
        )
        .unwrap();

        let (tx2, _rx2) = tokio::sync::mpsc::unbounded_channel();
        rm.add_peer(
            "10.0.0.2",
            PeerInfo {
                peer_code: "B2".into(),
                device_name: "Dev2".into(),
                device_type: DeviceType::Phone,
                sender: tx2,
            },
        )
        .unwrap();

        assert_eq!(rm.room_count(), 2);
        assert_eq!(rm.peer_count(), 2);
    }

    #[test]
    fn room_manager_duplicate_peer_code_rejected() {
        let rm = RoomManager::new();
        let (tx1, _rx1) = tokio::sync::mpsc::unbounded_channel();
        rm.add_peer(
            "127.0.0.1",
            PeerInfo {
                peer_code: "DUP1".into(),
                device_name: "Dev1".into(),
                device_type: DeviceType::Desktop,
                sender: tx1,
            },
        )
        .unwrap();

        let (tx2, _rx2) = tokio::sync::mpsc::unbounded_channel();
        let result = rm.add_peer(
            "127.0.0.1",
            PeerInfo {
                peer_code: "DUP1".into(),
                device_name: "Dev2".into(),
                device_type: DeviceType::Phone,
                sender: tx2,
            },
        );
        assert!(result.is_err());
    }

    // ── Peer code parity tests (bolt-core dev-dep) ──────────────

    #[test]
    fn server_accepts_codes_bolt_core_rejects() {
        assert!(validate_peer_code("IL0O1X").is_ok());
        assert!(!bolt_core::peer_code::is_valid_peer_code("IL0O1X"));

        assert!(validate_peer_code("ABCDEF1234567890").is_ok());
        assert!(!bolt_core::peer_code::is_valid_peer_code(
            "ABCDEF1234567890"
        ));

        assert!(validate_peer_code("a1b2c3").is_ok());
        assert!(!bolt_core::peer_code::is_valid_peer_code("a1b2c3"));
    }

    #[test]
    fn canonical_codes_accepted_by_both() {
        assert!(validate_peer_code("ABCDEF").is_ok());
        assert!(bolt_core::peer_code::is_valid_peer_code("ABCDEF"));

        assert!(validate_peer_code("ABCDEFGH").is_ok());
        assert!(bolt_core::peer_code::is_valid_peer_code("ABCDEFGH"));
    }

    #[test]
    fn both_reject_empty() {
        assert!(validate_peer_code("").is_err());
        assert!(!bolt_core::peer_code::is_valid_peer_code(""));
    }
}
