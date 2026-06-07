# frozen_string_literal: true

require "base64"
require "json"
require "securerandom"

module Wave
  # x402 "exact" scheme signing (EIP-3009 TransferWithAuthorization).
  #
  # Lets a Ruby agent pay a WAVE x402 facilitator (gateway.wave.online): sign a USDC
  # TransferWithAuthorization as EIP-712 typed data, then build the X-Payment header. The signature is
  # bound to the payer's wallet; the WAVE facilitator (not your server) broadcasts the on-chain pull.
  #
  # Byte-for-byte compatible with WAVE's reference TypeScript x402 signer — verified against the shared
  # conformance vector (testdata/x402_exact_vector.json). This file is hand-written, not codegen output.
  #
  # Signing needs the optional `eth` gem (lazily required), which the base SDK does NOT depend on:
  #
  #   gem install eth   # or add `gem "eth"` to your Gemfile
  #
  # Example:
  #   payload = Wave::X402.sign_exact_authorization(
  #     private_key: payer_key,            # 0x + 64 hex; never leaves the client
  #     network: "base",                   # or "base-sepolia"
  #     to: requirement["payTo"],          # merchant treasury
  #     value: requirement["maxAmountRequired"], # atomic USDC (>= the requirement)
  #     valid_before: Time.now.to_i + 600,
  #   )
  #   header = Wave::X402.encode_exact_payment_header("base", payload)
  module X402
    # USDC EIP-712 domains. The domain name differs by chain (mainnet "USD Coin" vs Sepolia "USDC"),
    # both version "2" — so the typed-data hash, and the signature, is chain-specific.
    NETWORKS = {
      "base" => {
        chain_id: 8453,
        usdc: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        domain_name: "USD Coin",
        domain_version: "2"
      },
      "base-sepolia" => {
        chain_id: 84_532,
        usdc: "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
        domain_name: "USDC",
        domain_version: "2"
      }
    }.freeze

    EIP712_DOMAIN_TYPE = [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" }
    ].freeze

    TRANSFER_WITH_AUTHORIZATION_TYPE = [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" }
    ].freeze

    module_function

    # Returns a copy of the network config for +network+ ("base" | "base-sepolia"), or nil if unknown.
    def network_config(network)
      cfg = NETWORKS[network]
      cfg&.dup
    end

    # A fresh random bytes32 nonce as "0x" + 64 lowercase hex (single-use, enforced on-chain by USDC).
    def random_nonce
      "0x#{SecureRandom.bytes(32).unpack1('H*')}"
    end

    # Sign a USDC EIP-3009 TransferWithAuthorization for the x402 "exact" scheme. Returns a Hash:
    #   { "signature" => "0x...", "authorization" => { from, to, value, validAfter, validBefore, nonce } }
    # Raises LoadError-derived RuntimeError if the `eth` gem is missing, ArgumentError on an unsupported
    # network or a +from+ that does not match the signing key.
    def sign_exact_authorization(private_key:, network:, to:, value:, valid_before:,
                                 valid_after: "0", from: nil, nonce: nil)
      eth = load_eth!
      net = NETWORKS[network] or raise ArgumentError, "unsupported network: #{network}"

      key = eth::Key.new(priv: private_key)
      signer = key.address.to_s
      from ||= signer
      unless from.downcase == signer.downcase
        raise ArgumentError, "from does not match the signing key"
      end

      nonce ||= random_nonce
      value_i = Integer(value)
      valid_after_i = Integer(valid_after)
      valid_before_i = Integer(valid_before)

      typed_data = {
        types: {
          EIP712Domain: EIP712_DOMAIN_TYPE,
          TransferWithAuthorization: TRANSFER_WITH_AUTHORIZATION_TYPE
        },
        primaryType: "TransferWithAuthorization",
        domain: {
          name: net[:domain_name],
          version: net[:domain_version],
          chainId: net[:chain_id],
          verifyingContract: net[:usdc]
        },
        message: {
          from: from,
          to: to,
          value: value_i,
          validAfter: valid_after_i,
          validBefore: valid_before_i,
          nonce: nonce
        }
      }

      hash = eth::Eip712.hash(typed_data)
      sig = key.sign(hash) # hex; v normalized to {27,28} when no chain_id is given
      sig = "0x#{sig}" unless sig.start_with?("0x")

      {
        "signature" => sig,
        "authorization" => {
          "from" => from,
          "to" => to,
          "value" => value_i.to_s,
          "validAfter" => valid_after_i.to_s,
          "validBefore" => valid_before_i.to_s,
          "nonce" => nonce
        }
      }
    end

    # Base64-encode the X-Payment envelope { x402Version: 1, scheme: "exact", network, payload }.
    # Standard base64, matching the reference btoa(JSON.stringify(...)).
    def encode_exact_payment_header(network, payload)
      envelope = {
        "x402Version" => 1,
        "scheme" => "exact",
        "network" => network,
        "payload" => payload
      }
      Base64.strict_encode64(JSON.generate(envelope))
    end

    # Lazily load the optional `eth` gem, with a clear message if it is missing.
    def load_eth!
      require "eth"
      ::Eth
    rescue LoadError
      raise "x402 signing requires the 'eth' gem. Install it with: gem install eth"
    end
  end
end
