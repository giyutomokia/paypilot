
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: { toString(): string };

  connect(options?: { onlyIfTrusted?: boolean }): Promise<{
    publicKey: { toString(): string };
  }>;

  disconnect(): Promise<void>;

  signAndSendTransaction(
    tx: Transaction
  ): Promise<{ signature: string }>;

  on?(
    event: "connect" | "disconnect",
    callback: (key?: { toString(): string }) => void
  ): void;

  removeListener?(
    event: "connect" | "disconnect",
    callback: (key?: { toString(): string }) => void
  ): void;
};

declare global {
  interface Window {
    solana?: PhantomProvider;
    phantom?: {
      solana?: PhantomProvider;
    };
  }
}

type ParsedPayment = {
  recipient: string;
  amount: number;
  explanation: string;
};

const DEVNET = "https://api.devnet.solana.com";

function getPhantomProvider(): PhantomProvider | null {
  if (typeof window === "undefined") return null;

  const provider = window.phantom?.solana ?? window.solana;

  return provider?.isPhantom ? provider : null;
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [wallet, setWallet] = useState("");
  const [payment, setPayment] = useState<ParsedPayment | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [signature, setSignature] = useState("");
  const [error, setError] = useState("");
  const [usedAI, setUsedAI] = useState(false);

  const shortWallet = useMemo(
    () =>
      wallet
        ? `${wallet.slice(0, 5)}...${wallet.slice(-5)}`
        : "",
    [wallet]
  );

  // Automatically detect and restore Phantom connection.
  useEffect(() => {
    const provider = getPhantomProvider();

    if (!provider) return;

    const handleConnect = (key?: { toString(): string }) => {
      const address =
        key?.toString() || provider.publicKey?.toString();

      if (address) {
        setWallet(address);
        setStatus("Phantom wallet connected.");
      }
    };

    const handleDisconnect = () => {
      setWallet("");
      setStatus("Wallet disconnected.");
    };

    provider.on?.("connect", handleConnect);
    provider.on?.("disconnect", handleDisconnect);

    if (provider.publicKey) {
      setWallet(provider.publicKey.toString());
    } else {
      provider
        .connect({ onlyIfTrusted: true })
        .then((result) => {
          handleConnect(result.publicKey);
        })
        .catch(() => {
          // User has not authorized automatic reconnection.
        });
    }

    return () => {
      provider.removeListener?.("connect", handleConnect);
      provider.removeListener?.("disconnect", handleDisconnect);
    };
  }, []);

  // Connect Phantom wallet.
  async function connectWallet() {
    setError("");
    setStatus("");

    const provider = getPhantomProvider();

    if (!provider) {
      setError(
        "Phantom was not detected. Unlock the Phantom extension and refresh this page."
      );
      return;
    }

    try {
      const result = await provider.connect();
      const address = result.publicKey.toString();

      setWallet(address);
      setStatus(
        "Wallet connected to PayPilot. Transactions will use Solana Devnet."
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Wallet connection was cancelled or failed."
      );
    }
  }

  // Disconnect Phantom wallet.
  async function disconnectWallet() {
    try {
      await getPhantomProvider()?.disconnect();
    } catch (e) {
      console.error("Wallet disconnect error:", e);
    }

    setWallet("");
    setStatus("");
    setPayment(null);
    setSignature("");
    setError("");
  }

  // Interpret natural-language payment request.
  async function interpretRequest() {
    setError("");
    setStatus("");
    setSignature("");
    setPayment(null);

    if (!prompt.trim()) {
      setError("Describe the payment first.");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/api/interpret", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not understand that payment."
        );
      }

      const amount = Number(data.amount);

      if (
        !Number.isFinite(amount) ||
        amount <= 0 ||
        amount > 10
      ) {
        throw new Error(
          "For this demo, enter an amount greater than 0 and no more than 10 SOL."
        );
      }

      const recipient = String(data.recipient || "").trim();

      try {
        new PublicKey(recipient);
      } catch {
        throw new Error(
          "I couldn't find a valid Solana wallet address. Include the full recipient address."
        );
      }

      setPayment({
        recipient,
        amount,
        explanation:
          data.explanation ||
          "Payment details extracted. Review them before signing.",
      });

      setUsedAI(Boolean(data.usedAI));

      setStatus(
        "Payment draft created. Nothing has been sent yet."
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong."
      );
    } finally {
      setBusy(false);
    }
  }

  // Build, sign and send Solana Devnet transaction.
  async function sendPayment() {
    setError("");
    setSignature("");

    if (!wallet || !payment) {
      setError(
        "Connect your wallet and prepare a payment first."
      );
      return;
    }

    if (payment.recipient === wallet) {
      setError(
        "The recipient is your connected wallet. Choose a different address."
      );
      return;
    }

    setBusy(true);
    setStatus("Preparing your Devnet transaction...");

    try {
      const provider = getPhantomProvider();

      if (!provider?.signAndSendTransaction) {
        throw new Error(
          "Phantom wallet is unavailable. Reconnect your wallet."
        );
      }

      const connection = new Connection(
        DEVNET,
        "confirmed"
      );

      const sender = new PublicKey(wallet);
      const recipient = new PublicKey(payment.recipient);

      const latest = await connection.getLatestBlockhash(
        "confirmed"
      );

      const tx = new Transaction({
        feePayer: sender,
        recentBlockhash: latest.blockhash,
      }).add(
        SystemProgram.transfer({
          fromPubkey: sender,
          toPubkey: recipient,
          lamports: Math.round(
            payment.amount * LAMPORTS_PER_SOL
          ),
        })
      );

      setStatus(
        "Please review and approve the transaction in Phantom. This uses Devnet test SOL."
      );

      // User explicitly approves through Phantom.
      const result = await provider.signAndSendTransaction(tx);

      setSignature(result.signature);

      setStatus(
        "Transaction submitted. Waiting for Devnet confirmation..."
      );

      await connection.confirmTransaction(
        {
          signature: result.signature,
          ...latest,
        },
        "confirmed"
      );

      setStatus("Payment confirmed on Solana Devnet!");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Transaction failed or was rejected."
      );

      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <nav className="nav">
        <a className="brand" href="#">
          <span className="brand-mark">P</span> paypilot
          <span className="brand-ai">AI</span>
        </a>

        <div className="nav-right">
          <span className="network">
            <i /> SOLANA DEVNET
          </span>

          {wallet ? (
            <button
              className="wallet-btn connected"
              onClick={disconnectWallet}
            >
              {shortWallet} · Disconnect
            </button>
          ) : (
            <button
              className="wallet-btn"
              onClick={connectWallet}
            >
              Connect Phantom ↗
            </button>
          )}
        </div>
      </nav>

      <section className="hero">
        <div className="eyebrow">
          <span className="spark">✦</span>
          AI-POWERED PAYMENTS ON SOLANA
        </div>

        <h1>
          Money moves at
          <br />
          <span>the speed of thought.</span>
        </h1>

        <p className="hero-copy">
          Tell PayPilot what you want to pay. AI turns your
          words into a clear transaction, and you stay in
          control before anything is sent.
        </p>
      </section>

      <section className="workspace">
        <div className="section-heading">
          <div>
            <span className="step">01</span>
            <h2>Describe your payment</h2>
          </div>

          <span className="hint">
            Natural language · Your choice
          </span>
        </div>

        <div className="composer">
          <label htmlFor="payment-prompt">
            WHAT WOULD YOU LIKE TO DO?
          </label>

          <textarea
            id="payment-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Send 0.02 SOL to a full wallet address for lunch"
            rows={3}
          />

          <div className="composer-bottom">
            <span>
              ✦ AI will extract the recipient and amount
            </span>

            <button
              className="primary"
              disabled={busy}
              onClick={interpretRequest}
            >
              {busy ? "Working..." : "Understand payment ↗"}
            </button>
          </div>
        </div>

        <div className="examples">
          <span>TRY AN EXAMPLE</span>

          <button
            onClick={() =>
              setPrompt(
                "Send 0.01 SOL to 11111111111111111111111111111111 for a demo transfer"
              )
            }
          >
            Demo transfer
          </button>

          <button
            onClick={() =>
              setPrompt(
                "Pay 0.02 SOL to 11111111111111111111111111111111 for coffee"
              )
            }
          >
            Coffee payment
          </button>
        </div>

        {payment && (
          <div className="review">
            <div className="review-top">
              <div>
                <span className="step">02</span>
                <h2>Review your payment</h2>
              </div>

              <span className="draft">
                DRAFT · NOT SENT
              </span>
            </div>

            <p className="explanation">
              {payment.explanation}
            </p>

            <div className="details">
              <div>
                <span>YOU ARE SENDING</span>
                <strong>
                  {payment.amount} <small>SOL</small>
                </strong>
              </div>

              <div>
                <span>TO WALLET</span>
                <code>{payment.recipient}</code>
              </div>

              <div>
                <span>NETWORK</span>
                <b>Solana Devnet · Test SOL</b>
              </div>
            </div>

            <div className="safety">
              ⌁ Nothing happens until you approve the
              transaction in your wallet.
            </div>

            <button
              className="primary send"
              disabled={busy || !wallet}
              onClick={sendPayment}
            >
              {busy
                ? "Processing..."
                : wallet
                  ? "Approve & send with Phantom ↗"
                  : "Connect Phantom to continue"}
            </button>

            {!wallet && (
              <p className="wallet-note">
                Connect your Phantom wallet above. Get free
                Devnet SOL from a Solana faucet before testing.
              </p>
            )}

            {usedAI && (
              <span className="ai-badge">
                ✦ Parsed with AI
              </span>
            )}
          </div>
        )}

        {(status || error) && (
          <div className={error ? "notice error" : "notice"}>
            {error || status}
          </div>
        )}

        {signature && (
          <div className="success-card">
            <span className="success-icon">✓</span>

            <div>
              <strong>Transaction submitted</strong>

              <p>
                <a
                  href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View transaction on Solana Explorer ↗
                </a>
              </p>

              <code>{signature}</code>
            </div>
          </div>
        )}
      </section>

      <section className="how">
        <div className="section-heading">
          <div>
            <span className="step">03</span>
            <h2>Simple by design</h2>
          </div>
        </div>

        <div className="how-grid">
          <article>
            <span>✦</span>
            <h3>Understand</h3>
            <p>
              AI converts a plain-language request into
              structured payment details.
            </p>
          </article>

          <article>
            <span>◎</span>
            <h3>Review</h3>
            <p>
              You see the amount, recipient and network
              before approving anything.
            </p>
          </article>

          <article>
            <span>↗</span>
            <h3>Settle</h3>
            <p>
              Phantom signs your transaction and Solana
              Devnet records it.
            </p>
          </article>
        </div>
      </section>

      <footer>
        <a className="brand" href="#">
          <span className="brand-mark">P</span> paypilot
          <span className="brand-ai">AI</span>
        </a>

        <span>Built for the Solana Hackathon · Devnet demo</span>
        <span>AI assists. You approve.</span>
      </footer>
    </main>
  );
}
