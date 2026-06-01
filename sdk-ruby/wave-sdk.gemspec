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

  spec.metadata = {
    "source_code_uri" => "https://github.com/wave-av/sdks",
    "homepage_uri" => "https://wave.online",
    "rubygems_mfa_required" => "true"
  }
end
