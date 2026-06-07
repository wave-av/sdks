package wave

// x402 "exact" scheme signing (EIP-3009 TransferWithAuthorization).
//
// Lets a Go agent pay a WAVE x402 facilitator (gateway.wave.online): sign a USDC
// TransferWithAuthorization as EIP-712 typed data, then build the X-Payment header. The signature is
// bound to the payer's wallet; the WAVE facilitator (not your server) broadcasts the on-chain pull.
//
// Byte-for-byte compatible with WAVE's reference TypeScript x402 signer — verified against the shared
// conformance vector (testdata/x402_exact_vector.json). This file is NOT codegen output; keep it.

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum/common/math"
	ethcrypto "github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/signer/core/apitypes"
)

// NetworkConfig is the USDC EIP-712 domain for a supported network.
type NetworkConfig struct {
	ChainID       int64
	USDC          string
	DomainName    string
	DomainVersion string
}

// x402Networks holds the USDC EIP-712 domains. The domain name differs by chain (mainnet "USD Coin"
// vs Sepolia "USDC"), both version "2" — so the typed-data hash, and the signature, is chain-specific.
var x402Networks = map[string]NetworkConfig{
	"base":         {ChainID: 8453, USDC: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", DomainName: "USD Coin", DomainVersion: "2"},
	"base-sepolia": {ChainID: 84532, USDC: "0x036cbd53842c5426634e7929541ec2318f3dcf7e", DomainName: "USDC", DomainVersion: "2"},
}

// NetworkConfigFor returns a copy of the config for network ("base" | "base-sepolia"), ok=false if unknown.
func NetworkConfigFor(network string) (NetworkConfig, bool) {
	c, ok := x402Networks[network]
	return c, ok
}

// ExactAuthorization is the EIP-3009 authorization, wire shape (numeric fields are decimal strings,
// nonce is 0x + 64 hex). Field order matches the reference signer's JSON for byte-identical headers.
type ExactAuthorization struct {
	From        string `json:"from"`
	To          string `json:"to"`
	Value       string `json:"value"`
	ValidAfter  string `json:"validAfter"`
	ValidBefore string `json:"validBefore"`
	Nonce       string `json:"nonce"`
}

// ExactPayload is the signed authorization the facilitator's /verify and /settle accept.
type ExactPayload struct {
	Signature     string             `json:"signature"`
	Authorization ExactAuthorization `json:"authorization"`
}

// SignExactParams are the inputs to SignExactAuthorization.
type SignExactParams struct {
	PrivateKey  string // 0x + 64 hex; the agent wallet key (becomes Authorization.From)
	Network     string // "base" | "base-sepolia"
	To          string // recipient / payTo (merchant treasury)
	Value       string // atomic USDC, decimal (must be >= the requirement)
	ValidBefore string // unix seconds — authorization expires at/after this
	ValidAfter  string // unix seconds; defaults to "0"
	From        string // optional; MUST equal the signer address; defaults to the signer
	Nonce       string // optional; defaults to a fresh random bytes32
}

var x402TransferWithAuthorizationTypes = []apitypes.Type{
	{Name: "from", Type: "address"},
	{Name: "to", Type: "address"},
	{Name: "value", Type: "uint256"},
	{Name: "validAfter", Type: "uint256"},
	{Name: "validBefore", Type: "uint256"},
	{Name: "nonce", Type: "bytes32"},
}

// RandomNonce returns a fresh random bytes32 nonce as 0x + 64 lowercase hex (single-use, enforced
// on-chain by USDC at settle).
func RandomNonce() string {
	var b [32]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic("wave/x402: crypto/rand failed: " + err.Error()) // a broken CSPRNG must never silently produce a weak nonce
	}
	return "0x" + hex.EncodeToString(b[:])
}

// SignExactAuthorization signs a USDC EIP-3009 TransferWithAuthorization for the x402 "exact" scheme.
func SignExactAuthorization(p SignExactParams) (ExactPayload, error) {
	net, ok := x402Networks[p.Network]
	if !ok {
		return ExactPayload{}, fmt.Errorf("wave/x402: unsupported network: %s", p.Network)
	}
	key, err := ethcrypto.HexToECDSA(strings.TrimPrefix(p.PrivateKey, "0x"))
	if err != nil {
		return ExactPayload{}, fmt.Errorf("wave/x402: invalid private key: %w", err)
	}
	signer := ethcrypto.PubkeyToAddress(key.PublicKey).Hex()
	from := p.From
	if from == "" {
		from = signer
	}
	if !strings.EqualFold(from, signer) {
		return ExactPayload{}, fmt.Errorf("wave/x402: from does not match the signing key")
	}
	validAfter := p.ValidAfter
	if validAfter == "" {
		validAfter = "0"
	}
	nonce := p.Nonce
	if nonce == "" {
		nonce = RandomNonce()
	}

	value, ok := new(big.Int).SetString(p.Value, 10)
	if !ok {
		return ExactPayload{}, fmt.Errorf("wave/x402: value is not a decimal integer: %q", p.Value)
	}
	va, ok := new(big.Int).SetString(validAfter, 10)
	if !ok {
		return ExactPayload{}, fmt.Errorf("wave/x402: validAfter is not a decimal integer: %q", validAfter)
	}
	vb, ok := new(big.Int).SetString(p.ValidBefore, 10)
	if !ok {
		return ExactPayload{}, fmt.Errorf("wave/x402: validBefore is not a decimal integer: %q", p.ValidBefore)
	}

	typedData := apitypes.TypedData{
		Types: apitypes.Types{
			"EIP712Domain": []apitypes.Type{
				{Name: "name", Type: "string"},
				{Name: "version", Type: "string"},
				{Name: "chainId", Type: "uint256"},
				{Name: "verifyingContract", Type: "address"},
			},
			"TransferWithAuthorization": x402TransferWithAuthorizationTypes,
		},
		PrimaryType: "TransferWithAuthorization",
		Domain: apitypes.TypedDataDomain{
			Name:              net.DomainName,
			Version:           net.DomainVersion,
			ChainId:           math.NewHexOrDecimal256(net.ChainID),
			VerifyingContract: net.USDC,
		},
		Message: apitypes.TypedDataMessage{
			"from":        from,
			"to":          p.To,
			"value":       (*math.HexOrDecimal256)(value),
			"validAfter":  (*math.HexOrDecimal256)(va),
			"validBefore": (*math.HexOrDecimal256)(vb),
			"nonce":       nonce,
		},
	}

	hash, _, err := apitypes.TypedDataAndHash(typedData)
	if err != nil {
		return ExactPayload{}, fmt.Errorf("wave/x402: typed-data hash: %w", err)
	}
	sig, err := ethcrypto.Sign(hash, key)
	if err != nil {
		return ExactPayload{}, fmt.Errorf("wave/x402: sign: %w", err)
	}
	sig[64] += 27 // recovery id 0/1 -> 27/28 (EIP-155-free, matches the reference signer)

	return ExactPayload{
		Signature: "0x" + hex.EncodeToString(sig),
		Authorization: ExactAuthorization{
			From:        from,
			To:          p.To,
			Value:       value.String(),
			ValidAfter:  va.String(),
			ValidBefore: vb.String(),
			Nonce:       nonce,
		},
	}, nil
}

// EncodeExactPaymentHeader base64-encodes the X-Payment envelope:
// {x402Version:1, scheme:"exact", network, payload}. Standard base64, matching the reference btoa(JSON).
func EncodeExactPaymentHeader(network string, payload ExactPayload) (string, error) {
	envelope := struct {
		X402Version int          `json:"x402Version"`
		Scheme      string       `json:"scheme"`
		Network     string       `json:"network"`
		Payload     ExactPayload `json:"payload"`
	}{X402Version: 1, Scheme: "exact", Network: network, Payload: payload}

	// json.Marshal is compact and field-ordered; no HTML chars appear in addresses/hex/decimals, so this
	// reproduces the reference JSON.stringify output byte-for-byte (no SetEscapeHTML needed here).
	b, err := json.Marshal(envelope)
	if err != nil {
		return "", fmt.Errorf("wave/x402: marshal payment header: %w", err)
	}
	return base64.StdEncoding.EncodeToString(b), nil
}
