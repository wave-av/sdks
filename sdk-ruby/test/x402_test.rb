# frozen_string_literal: true

# Conformance tests for Wave::X402 (EIP-3009 "exact" scheme signing). Asserts byte-for-byte parity with
# WAVE's reference TypeScript x402 signer via the shared vector (testdata/x402_exact_vector.json) the
# facilitator verifies. Skips cleanly if the optional `eth` gem is not installed (the base SDK and the
# offline smoke suite do not depend on it).

require "minitest/autorun"
require "json"
require_relative "../lib/wave/x402"

begin
  require "eth"
  ETH_AVAILABLE = true
rescue LoadError
  ETH_AVAILABLE = false
end

class X402ConformanceTest < Minitest::Test
  def setup
    skip "eth gem not installed (gem install eth)" unless ETH_AVAILABLE
    path = File.join(__dir__, "..", "..", "testdata", "x402_exact_vector.json")
    @vector = JSON.parse(File.read(path))
  end

  def test_signature_and_header_byte_identical
    @vector["vectors"].each do |v|
      a = v["authorization"]
      payload = Wave::X402.sign_exact_authorization(
        private_key: @vector["payerPrivateKey"],
        network: v["network"],
        to: a["to"],
        value: a["value"],
        valid_before: a["validBefore"],
        valid_after: a["validAfter"],
        nonce: a["nonce"]
      )
      assert_equal v["signature"], payload["signature"], "#{v['network']} signature"
      assert_equal a, payload["authorization"], "#{v['network']} authorization wire shape"
      assert_equal v["header"], Wave::X402.encode_exact_payment_header(v["network"], payload),
                   "#{v['network']} header"
    end
  end

  def test_derives_payer_and_defaults
    a = @vector["vectors"][0]["authorization"]
    payload = Wave::X402.sign_exact_authorization(
      private_key: @vector["payerPrivateKey"], network: "base",
      to: a["to"], value: 1000, valid_before: 1_900_000_600, nonce: a["nonce"]
    )
    assert_equal @vector["payerAddress"].downcase, payload["authorization"]["from"].downcase
    assert_equal "0", payload["authorization"]["validAfter"]
    assert_equal "1000", payload["authorization"]["value"]
  end

  def test_random_nonce_is_bytes32_hex
    n = Wave::X402.random_nonce
    assert n.start_with?("0x")
    assert_equal 66, n.length
    refute_equal Wave::X402.random_nonce, Wave::X402.random_nonce
  end

  def test_guards
    a = @vector["vectors"][0]["authorization"]
    assert_raises(ArgumentError) do
      Wave::X402.sign_exact_authorization(
        private_key: @vector["payerPrivateKey"], network: "base", to: a["to"],
        value: "1", valid_before: "1900000600",
        from: "0x0000000000000000000000000000000000000001"
      )
    end
    assert_raises(ArgumentError) do
      Wave::X402.sign_exact_authorization(
        private_key: @vector["payerPrivateKey"], network: "ethereum", to: a["to"],
        value: "1", valid_before: "1900000600"
      )
    end
  end
end
