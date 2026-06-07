package wave

// Conformance tests for x402 "exact" signing. Asserts byte-for-byte parity with WAVE's reference
// TypeScript signer via the shared vector (testdata/x402_exact_vector.json) the facilitator verifies.

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type x402Vector struct {
	PayerPrivateKey string `json:"payerPrivateKey"`
	PayerAddress    string `json:"payerAddress"`
	Vectors         []struct {
		Network       string             `json:"network"`
		Authorization ExactAuthorization `json:"authorization"`
		Signature     string             `json:"signature"`
		Header        string             `json:"header"`
	} `json:"vectors"`
}

func loadX402Vector(t *testing.T) x402Vector {
	t.Helper()
	b, err := os.ReadFile(filepath.Join("..", "..", "testdata", "x402_exact_vector.json"))
	if err != nil {
		t.Fatalf("read vector: %v", err)
	}
	var v x402Vector
	if err := json.Unmarshal(b, &v); err != nil {
		t.Fatalf("parse vector: %v", err)
	}
	return v
}

func TestSignExactAuthorization_ByteIdenticalToReference(t *testing.T) {
	v := loadX402Vector(t)
	for _, vec := range v.Vectors {
		a := vec.Authorization
		payload, err := SignExactAuthorization(SignExactParams{
			PrivateKey:  v.PayerPrivateKey,
			Network:     vec.Network,
			To:          a.To,
			Value:       a.Value,
			ValidBefore: a.ValidBefore,
			ValidAfter:  a.ValidAfter,
			Nonce:       a.Nonce,
		})
		if err != nil {
			t.Fatalf("[%s] sign: %v", vec.Network, err)
		}
		if payload.Signature != vec.Signature {
			t.Errorf("[%s] signature mismatch\n got %s\nwant %s", vec.Network, payload.Signature, vec.Signature)
		}
		if payload.Authorization != a {
			t.Errorf("[%s] authorization wire shape mismatch: %+v vs %+v", vec.Network, payload.Authorization, a)
		}
		hdr, err := EncodeExactPaymentHeader(vec.Network, payload)
		if err != nil {
			t.Fatalf("[%s] header: %v", vec.Network, err)
		}
		if hdr != vec.Header {
			t.Errorf("[%s] header mismatch\n got %s\nwant %s", vec.Network, hdr, vec.Header)
		}
	}
}

func TestSignExactAuthorization_DerivesPayer(t *testing.T) {
	v := loadX402Vector(t)
	payload, err := SignExactAuthorization(SignExactParams{
		PrivateKey: v.PayerPrivateKey, Network: "base",
		To: v.Vectors[0].Authorization.To, Value: "1000", ValidBefore: "1900000600",
		Nonce: v.Vectors[0].Authorization.Nonce,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.EqualFold(payload.Authorization.From, v.PayerAddress) {
		t.Errorf("from: got %s want %s", payload.Authorization.From, v.PayerAddress)
	}
	if payload.Authorization.ValidAfter != "0" {
		t.Errorf("validAfter default: got %s", payload.Authorization.ValidAfter)
	}
}

func TestRandomNonce_Bytes32Hex(t *testing.T) {
	n := RandomNonce()
	if !strings.HasPrefix(n, "0x") || len(n) != 66 {
		t.Fatalf("nonce format: %s", n)
	}
	if RandomNonce() == RandomNonce() {
		t.Error("nonce not fresh per call")
	}
}

func TestSignExactAuthorization_Guards(t *testing.T) {
	v := loadX402Vector(t)
	if _, err := SignExactAuthorization(SignExactParams{
		PrivateKey: v.PayerPrivateKey, Network: "base", To: v.Vectors[0].Authorization.To,
		Value: "1", ValidBefore: "1900000600", From: "0x0000000000000000000000000000000000000001",
	}); err == nil {
		t.Error("expected error on from-mismatch")
	}
	if _, err := SignExactAuthorization(SignExactParams{
		PrivateKey: v.PayerPrivateKey, Network: "ethereum", To: v.Vectors[0].Authorization.To,
		Value: "1", ValidBefore: "1900000600",
	}); err == nil {
		t.Error("expected error on unsupported network")
	}
}
