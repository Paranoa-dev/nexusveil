use soroban_sdk::{Bytes, Env};

use crate::types::Error;

const MAGIC: [u8; 4] = [0x53, 0x52, 0x50, 0x00];
const FLAG_AMOUNT: u8 = 1;
const SUPPORTED_FLAGS: u8 = FLAG_AMOUNT;
const VERSION_OFFSET: u32 = 4;
const FLAGS_OFFSET: u32 = 5;
const RESERVED_OFFSET: u32 = 6;
const AMOUNT_OFFSET: u32 = 8;
const NONCE_OFFSET: u32 = 24;
const LENGTH_OFFSET: u32 = 56;

pub const PAYLOAD_ENVELOPE_VERSION: u8 = 1;
pub const PAYLOAD_HEADER_BYTES: u32 = 60;
pub const MAX_APPLICATION_PAYLOAD_BYTES: u32 = 2048;
pub const MAX_ENVELOPE_BYTES: u32 = PAYLOAD_HEADER_BYTES + MAX_APPLICATION_PAYLOAD_BYTES;

pub struct DecodedPayload {
    pub amount: Option<i128>,
}

fn byte(bytes: &Bytes, index: u32) -> Result<u8, Error> {
    bytes.get(index).ok_or(Error::MalformedPayload)
}

/// Strictly validate the canonical V1 payload envelope shared with
/// `@sub-rosa/tlock`. The commitment always covers the complete envelope;
/// contract logic only interprets the optional economic amount.
pub fn decode_envelope(_env: &Env, bytes: &Bytes) -> Result<DecodedPayload, Error> {
    if bytes.len() < PAYLOAD_HEADER_BYTES || bytes.len() > MAX_ENVELOPE_BYTES {
        return Err(Error::MalformedPayload);
    }

    for i in 0..4u32 {
        if byte(bytes, i)? != MAGIC[i as usize] {
            return Err(Error::MalformedPayload);
        }
    }
    if byte(bytes, VERSION_OFFSET)? != PAYLOAD_ENVELOPE_VERSION {
        return Err(Error::UnsupportedVersion);
    }

    let flags = byte(bytes, FLAGS_OFFSET)?;
    if flags & !SUPPORTED_FLAGS != 0 {
        return Err(Error::MalformedPayload);
    }
    if byte(bytes, RESERVED_OFFSET)? != 0 || byte(bytes, RESERVED_OFFSET + 1)? != 0 {
        return Err(Error::MalformedPayload);
    }

    let payload_len = u32::from_be_bytes([
        byte(bytes, LENGTH_OFFSET)?,
        byte(bytes, LENGTH_OFFSET + 1)?,
        byte(bytes, LENGTH_OFFSET + 2)?,
        byte(bytes, LENGTH_OFFSET + 3)?,
    ]);
    if payload_len > MAX_APPLICATION_PAYLOAD_BYTES
        || bytes.len() != PAYLOAD_HEADER_BYTES + payload_len
    {
        return Err(Error::MalformedPayload);
    }

    let has_amount = flags & FLAG_AMOUNT != 0;
    let mut amount_bytes = [0u8; 16];
    for i in 0..16u32 {
        amount_bytes[i as usize] = byte(bytes, AMOUNT_OFFSET + i)?;
    }
    if !has_amount && amount_bytes.iter().any(|value| *value != 0) {
        return Err(Error::MalformedPayload);
    }

    // Touch the complete fixed-width nonce so truncated headers cannot be
    // accepted if the layout changes later.
    for i in NONCE_OFFSET..LENGTH_OFFSET {
        byte(bytes, i)?;
    }

    Ok(DecodedPayload {
        amount: if has_amount {
            Some(i128::from_be_bytes(amount_bytes))
        } else {
            None
        },
    })
}
