# frozen_string_literal: true

require_relative "lib/wave/version"

Gem::Specification.new do |spec|
  spec.name = "wave-sdk"
  spec.version = Wave::VERSION
  spec.summary = "Official WAVE API SDK for Ruby"
  spec.description = "Typed-ergonomic Ruby client for the WAVE API, generated from the gateway OpenAPI contract."
  spec.authors = ["WAVE Inc."]
  spec.email = ["sdk@wave.online"]
  spec.homepage = "https://wave.online"
  spec.license = "MIT"
  spec.required_ruby_version = ">= 3.0"

  spec.files = Dir["lib/**/*.rb", "README.md", "LICENSE"]
  spec.require_paths = ["lib"]

  # Optional: x402 agent-payment signing (lib/wave/x402.rb) needs the `eth` gem for EIP-712/EIP-3009.
  # The base SDK does NOT require it; users who sign payments add `gem "eth"`. Declared here as a dev
  # dependency so the conformance test (test/x402_test.rb) can run.
  spec.add_development_dependency "eth", "~> 0.5"

  spec.metadata = {
    "source_code_uri" => "https://github.com/wave-av/sdks",
    "homepage_uri" => "https://wave.online",
    "rubygems_mfa_required" => "true"
  }
end
