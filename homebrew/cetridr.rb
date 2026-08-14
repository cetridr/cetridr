class Cetridr < Formula
  desc "Rule the deep — a single-window command center for DeepSeek Harness agents"
  homepage "https://github.com/cetridr/cetridr"
  url "https://registry.npmjs.org/@cetridr/cetridr/-/cetridr-0.2.0-alpha.0.tgz"
  sha256 "0f92965ea39aa3110c664a9cd1388148fb4104551630589b48c02dd6e3a120bc"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink libexec/"bin"/"cetridr"
  end

  test do
    assert_match "Usage: cetridr", shell_output("#{bin}/cetridr --help")
  end
end
